import type {
  AuthProvider,
  SecretsProvider,
  GitHubClient,
  GitClient,
  CodeIndex,
  Embedder,
  LLMProvider,
} from '@devdigest/shared';
import type { AppConfig } from './config.js';
import type { Db } from '../db/client.js';
import { JobRunner } from './jobs.js';
import { runBus, type RunBus } from './sse.js';
import { LocalSecretsProvider } from '../adapters/secrets/local.js';
import { LocalNoAuthProvider } from '../adapters/auth/local.js';
import { OctokitGitHubClient } from '../adapters/github/octokit.js';
import { SimpleGitClient } from '../adapters/git/simple-git.js';
import { RipgrepCodeIndex } from '../adapters/codeindex/ripgrep.js';
import { FetchUrlFetcher } from '../adapters/http/url-fetcher.js';
import { OpenAIProvider } from '../adapters/llm/openai.js';
import { AnthropicProvider } from '../adapters/llm/anthropic.js';
import { OpenAIEmbedder } from '../adapters/embedder/openai.js';
import { OpenRouterProvider } from '@devdigest/reviewer-core';
import { estimateCost } from '../adapters/llm/pricing.js';
import { PriceBook } from './price-book.js';
import { ConfigError } from './errors.js';
import { AgentsRepository } from '../modules/agents/repository.js';
import { SkillsRepository } from '../modules/skills/repository.js';
import { SkillsService } from '../modules/skills/service.js';
import type { SkillsPort, UrlFetcher } from '../modules/skills/types.js';
import { ConventionsRepository } from '../modules/conventions/repository.js';
import { resolveFeatureModel } from '../modules/settings/feature-models.js';
import type { FeatureModelResolver } from '../modules/settings/types.js';
import { ReviewRepository } from '../modules/reviews/repository.js';
import { PullsRepository } from '../modules/pulls/repository.js';
import { RepoRepository } from '../modules/repos/repository.js';
import { RepoIntelRepository } from '../modules/repo-intel/repository.js';
import type { CodeParser, DepGraph, RepoIntel, Tokenizer } from '../modules/repo-intel/types.js';
import { RepoIntelService } from '../modules/repo-intel/service.js';
import { DepCruiseGraph } from '../adapters/depgraph/index.js';
import { TiktokenTokenizer } from '../adapters/tokenizer/index.js';
import { AstGrepCodeParser } from '../adapters/astgrep/index.js';

/**
 * DI container. One per app instance. Holds config, db, the JobRunner,
 * the SSE bus, and lazily-constructed adapters resolved through SecretsProvider.
 *
 * Tests construct a container with `overrides` to inject mock adapters; the
 * Services depend on these interfaces, not the concrete classes.
 */
export interface ContainerOverrides {
  secrets?: SecretsProvider;
  auth?: AuthProvider;
  github?: GitHubClient;
  git?: GitClient;
  codeIndex?: CodeIndex;
  embedder?: Embedder;
  /** Pre-built providers by id (skip key lookup). */
  llm?: Partial<Record<'openai' | 'anthropic' | 'openrouter', LLMProvider>>;
  /** repo-intel facade (T1.1+) — tests inject mock RepoIntel implementations. */
  repoIntel?: RepoIntel;
  /** repo-intel T3 adapters — only the indexer pipeline reads these. */
  depgraph?: DepGraph;
  tokenizer?: Tokenizer;
  /** repo-intel TS/JS parser (facade + indexer pipeline). */
  codeParser?: CodeParser;
  /** Outbound HTTP of the skill URL import (HW02 D21); tests inject `MockUrlFetcher`. */
  urlFetcher?: UrlFetcher;
}

export class Container {
  readonly config: AppConfig;
  readonly db: Db;
  readonly secrets: SecretsProvider;
  readonly auth: AuthProvider;
  readonly jobs: JobRunner;
  readonly runBus: RunBus;

  private _git?: GitClient;
  private _github?: GitHubClient;
  private _codeIndex?: CodeIndex;
  private _urlFetcher?: UrlFetcher;
  private _embedder?: Embedder;
  private llmCache = new Map<string, LLMProvider>();

  // Shared repositories for cross-cutting entities (agents, reviews/pulls,
  // runs). Constructed here, in the composition root, so consuming modules use
  // `container.agentsRepo` instead of reaching into another module's folder.
  private _agentsRepo?: AgentsRepository;
  private _skillsRepo?: SkillsRepository;
  private _skillsService?: SkillsService;
  private _conventionsRepo?: ConventionsRepository;
  private _featureModels?: FeatureModelResolver;
  private _reviewRepo?: ReviewRepository;
  private _pullsRepo?: PullsRepository;
  private _reposRepo?: RepoRepository;
  private _repoIntelRepo?: RepoIntelRepository;
  private _repoIntelService?: RepoIntelService;
  private _depgraph?: DepGraph;
  private _tokenizer?: Tokenizer;
  private _codeParser?: CodeParser;
  private _priceBook?: PriceBook;

  constructor(config: AppConfig, db: Db, private overrides: ContainerOverrides = {}) {
    this.config = config;
    this.db = db;
    this.secrets = overrides.secrets ?? new LocalSecretsProvider(config.secretsPath);
    this.auth = overrides.auth ?? new LocalNoAuthProvider(db);
    this.runBus = runBus;
    this.jobs = new JobRunner(db);
  }

  get git(): GitClient {
    if (this.overrides.git) return this.overrides.git;
    this._git ??= new SimpleGitClient(this.config.cloneDir);
    return this._git;
  }

  /** Owner of `agents` / `agent_versions`; reads skill links through `skillsRepo`. */
  get agentsRepo(): AgentsRepository {
    return (this._agentsRepo ??= new AgentsRepository(this.db, this.skillsRepo));
  }

  /**
   * The skills module's own repository (`skills`, `skill_versions`,
   * `agent_skills`) — for the skills module ONLY. Other modules use the
   * `skillsRepo` port.
   */
  get skillsModuleRepo(): SkillsRepository {
    return (this._skillsRepo ??= new SkillsRepository(this.db));
  }

  /**
   * Cross-module port onto skills and agent links (L02, D16): skill counts,
   * version-snapshot links, a run's effective skills, workspace skill names.
   */
  get skillsRepo(): SkillsPort {
    return this.skillsModuleRepo;
  }

  /**
   * The skills module's use cases for OTHER modules (HW02 D18: the conventions
   * extractor creates / versions the `repo-conventions` skill and links it to
   * an agent through `setAgentSkills`). Consumers type it structurally
   * (`SkillsWriter` in `modules/conventions/types.ts`). The skills routes keep
   * their own instance; the service is stateless, so two are fine.
   */
  get skillsService(): SkillsService {
    return (this._skillsService ??= new SkillsService(this, {
      skills: this.skillsModuleRepo,
      agents: this.agentsRepo,
    }));
  }

  /** Owner of `convention_scans` / `conventions` (conventions module); the boot reaper reads it too. */
  get conventionsRepo(): ConventionsRepository {
    return (this._conventionsRepo ??= new ConventionsRepository(this.db));
  }

  /**
   * The settings module's feature-model port (HW02 D8, #53): the provider and
   * model a system feature runs with — the workspace override, else the
   * `FEATURE_MODELS` default. Consumers call `container.featureModels.resolve`
   * instead of importing `modules/settings`.
   */
  get featureModels(): FeatureModelResolver {
    return (this._featureModels ??= {
      resolve: (workspaceId, id) => resolveFeatureModel(this, workspaceId, id),
    });
  }

  get reviewRepo(): ReviewRepository {
    return (this._reviewRepo ??= new ReviewRepository(this.db));
  }

  /** Owner of pull_requests / pr_files / pr_commits (pulls module). */
  get pullsRepo(): PullsRepository {
    return (this._pullsRepo ??= new PullsRepository(this.db));
  }

  /** Owner of `repos` (repos module) — other modules read repo coordinates here. */
  get reposRepo(): RepoRepository {
    return (this._reposRepo ??= new RepoRepository(this.db));
  }

  /** repo-intel's own tables (symbols, file_rank, repo_index_state, …). */
  get repoIntelRepo(): RepoIntelRepository {
    return (this._repoIntelRepo ??= new RepoIntelRepository(this.db));
  }

  get codeIndex(): CodeIndex {
    if (this.overrides.codeIndex) return this.overrides.codeIndex;
    this._codeIndex ??= new RipgrepCodeIndex(this.git);
    return this._codeIndex;
  }

  /** The skill URL import's outbound HTTP port (HW02 D21): https only, SSRF-checked, streamed and capped. */
  get urlFetcher(): UrlFetcher {
    if (this.overrides.urlFetcher) return this.overrides.urlFetcher;
    this._urlFetcher ??= new FetchUrlFetcher();
    return this._urlFetcher;
  }

  /**
   * The one real `RepoIntelService`. The repo-intel route plugin registers the
   * index/refresh/resync job handlers on it at boot; readers use `repoIntel`.
   */
  get repoIntelService(): RepoIntelService {
    return (this._repoIntelService ??= new RepoIntelService(this));
  }

  /**
   * The repo-intel facade (T1.1). All higher-level features (reviews,
   * blast/onboarding migrations, phantom-gate) code against this interface.
   * Tests inject a mock via `ContainerOverrides.repoIntel`; the job handlers
   * stay on `repoIntelService` either way.
   */
  get repoIntel(): RepoIntel {
    return this.overrides.repoIntel ?? this.repoIntelService;
  }

  /** Import-graph builder (dependency-cruiser). T3 indexer pipeline only. */
  get depgraph(): DepGraph {
    if (this.overrides.depgraph) return this.overrides.depgraph;
    this._depgraph ??= new DepCruiseGraph();
    return this._depgraph;
  }

  /** Token counter (js-tiktoken) for the repo-map budget search. */
  get tokenizer(): Tokenizer {
    if (this.overrides.tokenizer) return this.overrides.tokenizer;
    this._tokenizer ??= new TiktokenTokenizer();
    return this._tokenizer;
  }

  /** AST parser for TS/JS (ast-grep) used by the repo-intel facade and indexer. */
  get codeParser(): CodeParser {
    if (this.overrides.codeParser) return this.overrides.codeParser;
    this._codeParser ??= new AstGrepCodeParser();
    return this._codeParser;
  }

  /**
   * Live OpenRouter pricing for cost attribution. The lister builds a bare
   * OpenRouter provider just for `/models` (no estimator needed) and degrades to
   * `[]` when no key is configured; the static `estimateCost` table is the
   * fallback for OpenAI/Anthropic and a cold/cold-failed cache.
   */
  get priceBook(): PriceBook {
    this._priceBook ??= new PriceBook(async () => {
      try {
        const key = await this.secrets.get('OPENROUTER_API_KEY');
        if (!key) return [];
        return await new OpenRouterProvider(key).listModels();
      } catch {
        return [];
      }
    }, estimateCost);
    return this._priceBook;
  }

  async github(): Promise<GitHubClient> {
    if (this.overrides.github) return this.overrides.github;
    if (this._github) return this._github;
    const token = await this.secrets.get('GITHUB_TOKEN');
    if (!token) throw new ConfigError('GITHUB_TOKEN is not configured');
    this._github = new OctokitGitHubClient(token);
    return this._github;
  }

  /** Resolve an LLM provider by id; constructs from the secret key, cached. */
  async llm(id: 'openai' | 'anthropic' | 'openrouter'): Promise<LLMProvider> {
    const injected = this.overrides.llm?.[id];
    if (injected) return injected;
    const cached = this.llmCache.get(id);
    if (cached) return cached;
    const provider = await this.buildLlm(id);
    this.llmCache.set(id, provider);
    return provider;
  }

  private async buildLlm(id: 'openai' | 'anthropic' | 'openrouter'): Promise<LLMProvider> {
    if (id === 'openai') {
      const key = await this.secrets.get('OPENAI_API_KEY');
      if (!key) throw new ConfigError('OPENAI_API_KEY is not configured');
      return new OpenAIProvider(key);
    }
    if (id === 'openrouter') {
      // Single OpenRouter provider lives in reviewer-core (shared with the CI
      // runner); inject the PriceBook so cost attribution uses LIVE OpenRouter
      // prices (with the static table as a fallback) rather than a hardcoded one.
      const key = await this.secrets.get('OPENROUTER_API_KEY');
      if (!key) throw new ConfigError('OPENROUTER_API_KEY is not configured');
      return new OpenRouterProvider(key, {
        estimateCost: (model, tokensIn, tokensOut) =>
          this.priceBook.estimate(model, tokensIn, tokensOut),
      });
    }
    const key = await this.secrets.get('ANTHROPIC_API_KEY');
    if (!key) throw new ConfigError('ANTHROPIC_API_KEY is not configured');
    return new AnthropicProvider(key);
  }

  async embedder(): Promise<Embedder> {
    // Injected embedders (tests) always win. Otherwise embeddings are gated by
    // config: when disabled we throw BEFORE constructing the OpenAI client, so
    // the app makes ZERO OpenAI requests. All callers wrap this in try/catch and
    // degrade gracefully (memory/RAG simply returns no hits).
    if (this.overrides.embedder) return this.overrides.embedder;
    if (!this.config.embeddingsEnabled) {
      throw new ConfigError('Embeddings are disabled (set EMBEDDINGS_ENABLED=true to enable memory/RAG)');
    }
    if (this._embedder) return this._embedder;
    const openai = await this.llm('openai');
    this._embedder = new OpenAIEmbedder(openai);
    return this._embedder;
  }

  /**
   * Drop cached provider clients so the next resolve picks up changed secrets.
   * Call after persisting a new API key/PAT via SecretsProvider.set.
   */
  invalidateSecretCaches(): void {
    this.llmCache.clear();
    this._github = undefined;
    this._embedder = undefined;
  }
}
