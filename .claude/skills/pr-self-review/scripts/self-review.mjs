#!/usr/bin/env node
// pr-self-review — deterministic half of the skill (no LLM, no network, no deps).
//
//   plan    [--base <ref>] [--mode full|blocking] [--skills a,b] [--full]   scope, guards, routing, batches, estimate
//   record-mech --run <dir> --package <p> --command <c> --result pass|fail [--summary <s>]
//   ground  --run <dir>                  grounds batch-NN.findings.json, writes check/finding records
//   report  --run <dir> [--pr-body]      verdict + terminal report (+ PR body), writes a run record
//   dismiss <finding-id> --reason <text> dismiss a skill finding for the current file content
//
// Journal: <git-common-dir>/devdigest/pr-self-review/journal.jsonl (never committed).
// Run dir: <journal dir>/runs/<timestamp>/ (plan.json, batch-NN.json, batch-NN.findings.json,
// verify.json, ground.json).

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

// ---------- basics ----------

const git = (args, opts = {}) =>
  execFileSync('git', ['-c', 'core.quotepath=off', ...args], {
    encoding: 'utf8',
    maxBuffer: 512 << 20,
    stdio: ['pipe', 'pipe', 'ignore'],
    ...opts,
  });
const tryGit = (args, opts) => {
  try {
    return git(args, opts);
  } catch {
    return null;
  }
};
const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const ROOT = git(['rev-parse', '--show-toplevel']).trim();
process.chdir(ROOT);
const COMMON = path.resolve(git(['rev-parse', '--git-common-dir']).trim());
const JDIR = path.join(COMMON, 'devdigest', 'pr-self-review');
const JOURNAL = path.join(JDIR, 'journal.jsonl');
const SKILLS_DIR = '.claude/skills';
const SELF = 'pr-self-review';

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      out[k] = v;
    } else out._.push(a);
  }
  return out;
}

function readJournal() {
  if (!fs.existsSync(JOURNAL)) return [];
  const out = [];
  for (const line of fs.readFileSync(JOURNAL, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* tolerant reader: skip bad lines */
    }
  }
  return out;
}
function append(records) {
  fs.mkdirSync(JDIR, { recursive: true });
  const at = new Date().toISOString();
  fs.appendFileSync(JOURNAL, records.map((r) => JSON.stringify({ v: 1, at, ...r })).join('\n') + '\n');
}
function compactJournal() {
  if (!fs.existsSync(JOURNAL) || fs.statSync(JOURNAL).size < 5 * 1024 * 1024) return;
  const recs = readJournal();
  const keep = new Map();
  const cutoff = Date.now() - 90 * 864e5;
  const keyOf = (r) =>
    r.kind === 'check' ? `c|${r.skill}|${r.skill_rev}|${r.path}|${r.blob}`
    : r.kind === 'mech' ? `m|${r.package}|${r.command}|${r.fingerprint}`
    : r.kind === 'finding' ? `f|${r.id}|${r.blob}`
    : r.kind === 'dismissal' ? (Date.parse(r.at) > cutoff ? `d|${r.finding_id}|${r.blob}` : null)
    : r.kind === 'run' ? `r|${r.at}` : null;
  for (const r of recs) {
    const k = keyOf(r);
    if (k) keep.set(k, r);
  }
  const runs = [...keep.values()].filter((r) => r.kind === 'run').slice(-50);
  const rest = [...keep.values()].filter((r) => r.kind !== 'run');
  fs.writeFileSync(JOURNAL, [...rest, ...runs].map((r) => JSON.stringify(r)).join('\n') + '\n');
}

// ---------- globs (comma-separated string, `!` excludes, no braces) ----------

function globRe(g) {
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') {
        i++;
        if (g[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else re += '.*';
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
function parseAppliesTo(s) {
  const parts = s.split(',').map((p) => p.trim()).filter(Boolean);
  return {
    inc: parts.filter((p) => !p.startsWith('!')).map(globRe),
    exc: parts.filter((p) => p.startsWith('!')).map((p) => globRe(p.slice(1))),
  };
}
const matches = (m, p) => m.inc.some((r) => r.test(p)) && !m.exc.some((r) => r.test(p));

// ---------- skills ----------

function frontmatter(text) {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---/);
  const fm = { metadata: {} };
  if (!m) return fm;
  let inMeta = false;
  for (const line of m[1].split('\n')) {
    const top = line.match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (top) {
      inMeta = top[1] === 'metadata';
      if (!inMeta) fm[top[1]] = unquote(top[2]);
      continue;
    }
    const sub = inMeta && line.match(/^\s+([A-Za-z_-]+):\s*(.*)$/);
    if (sub) fm.metadata[sub[1]] = unquote(sub[2]);
  }
  return fm;
}
function unquote(v) {
  v = v.trim();
  return /^(["']).*\1$/.test(v) ? v.slice(1, -1) : v;
}

function loadSkills() {
  const out = [];
  for (const name of fs.readdirSync(SKILLS_DIR)) {
    const file = `${SKILLS_DIR}/${name}/SKILL.md`;
    if (name === SELF || !fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const fm = frontmatter(text);
    const version = fm.metadata.version || null;
    const applies = fm.metadata.applies_to || null;
    const s = {
      name,
      file,
      version,
      rev: version ? `v${version}` : `h${sha1(text).slice(0, 12)}`,
      blocking: fm.metadata.blocking === 'true',
      bytes: Buffer.byteLength(text),
      applies_to: applies,
      problem: null,
    };
    if (applies && applies.startsWith('[')) s.problem = 'applies_to is a YAML list; it must be a comma-separated string';
    else if (applies) s.matcher = parseAppliesTo(applies);
    out.push(s);
  }
  return out;
}

// ---------- scope ----------

const EXCLUDE = [
  [/(^|\/)(pnpm-lock\.yaml|package-lock\.json)$/, 'lock file'],
  [/(^|\/)pnpm-workspace\.yaml$/, 'pnpm-workspace.yaml (never committed)'],
  [/^server\/src\/db\/migrations\/meta\//, 'drizzle-kit meta'],
  [/^client\/src\/vendor\/shared\//, 'vendor/shared copy (reviewed via server master + mirror guard)'],
  [/(^|\/)(dist|\.next|build|out|coverage|node_modules)\//, 'build output'],
  [/\.(png|jpe?g|gif|webp|ico|svg|mp4|mov|webm|wav|mp3|m4a|pdf|zip|woff2?|ttf)$/i, 'binary/media'],
];
const isTest = (p) => /\.(it\.)?test\.tsx?$/.test(p);
const PACKAGES = ['server', 'client', 'reviewer-core', 'e2e'];
const pkgOf = (p) => PACKAGES.find((k) => p.startsWith(`${k}/`)) || null;
const isCode = (p) => !/\.md$/i.test(p);

function resolveBase(explicit) {
  const ref = explicit || (tryGit(['rev-parse', '--verify', '-q', 'origin/main']) ? 'origin/main' : 'main');
  const mb = git(['merge-base', 'HEAD', ref]).trim();
  let fetchAgeH = null;
  const fh = path.join(COMMON, 'FETCH_HEAD');
  if (fs.existsSync(fh)) fetchAgeH = Math.round((Date.now() - fs.statSync(fh).mtimeMs) / 36e5);
  return { ref, mb, short: mb.slice(0, 7), fetchAgeH, head: git(['rev-parse', 'HEAD']).trim() };
}

function parseHunks(diffText) {
  // path -> { added: {line: text}, deleted: n, diff: string }
  const files = new Map();
  let cur = null;
  let newLine = 0;
  for (const line of diffText.split('\n')) {
    if (line.startsWith('diff --git ')) {
      cur = { added: {}, deleted: 0, diff: line + '\n', path: null };
      continue;
    }
    if (!cur) continue;
    cur.diff += line + '\n';
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).replace(/\t.*$/, '');
      if (p !== '/dev/null') {
        cur.path = p.replace(/^b\//, '');
        files.set(cur.path, cur);
      }
      continue;
    }
    if (line.startsWith('--- ')) continue;
    const h = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (h) {
      newLine = +h[1];
      continue;
    }
    if (line.startsWith('+')) cur.added[newLine++] = line.slice(1);
    else if (line.startsWith('-')) cur.deleted++;
    else if (line.startsWith(' ')) newLine++;
  }
  return files;
}

function buildScope(base) {
  const files = [];
  const ns = git(['diff', '--name-status', '-z', '-M', base.mb]).split('\0');
  for (let i = 0; i < ns.length - 1; ) {
    const st = ns[i++];
    if (!st) continue;
    if (st[0] === 'R' || st[0] === 'C') files.push({ status: st[0], score: st.slice(1), old_path: ns[i++], path: ns[i++] });
    else files.push({ status: st[0], path: ns[i++] });
  }
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean);
  for (const p of untracked) files.push({ status: 'A', path: p, untracked: true });

  const hunks = parseHunks(git(['diff', '-U0', '-M', '--no-color', base.mb]));
  const ctx = parseHunks(git(['diff', '-U3', '-M', '--no-color', base.mb]));
  const dirty = new Set(
    git(['status', '--porcelain', '-z', '-uall']).split('\0').filter(Boolean).map((l) => l.slice(3)),
  );

  const live = files.filter((f) => f.status !== 'D');
  const blobs = live.length
    ? git(['hash-object', '--stdin-paths'], { input: live.map((f) => f.path).join('\n') + '\n' }).trim().split('\n')
    : [];
  live.forEach((f, i) => (f.blob = blobs[i]));

  for (const f of files) {
    f.excluded = f.status === 'D' ? 'deleted' : (EXCLUDE.find(([re]) => re.test(f.path)) || [])[1] || null;
    f.uncommitted = dirty.has(f.path) || !!f.untracked;
    if (f.untracked) {
      let text = '';
      try {
        const buf = fs.readFileSync(f.path);
        text = buf.includes(0) ? '' : buf.toString('utf8');
      } catch {}
      const lines = text.replace(/\r\n/g, '\n').split('\n');
      if (lines.at(-1) === '') lines.pop();
      f.added = Object.fromEntries(lines.map((t, i) => [i + 1, t]));
      f.deleted = 0;
      f.diff = `new untracked file ${f.path}\n` + lines.map((t, i) => `${i + 1}: +${t}`).join('\n') + '\n';
    } else {
      const h = hunks.get(f.path);
      f.added = h ? h.added : {};
      f.deleted = h ? h.deleted : 0;
      f.diff = ctx.get(f.path)?.diff || '';
    }
    f.changed = Object.keys(f.added).length + f.deleted;
  }
  return files;
}

// ---------- mechanical guards ----------

function mech(sev, rule, p, line, title, fix, extra = {}) {
  return { id: `m-${sha1(`${rule}|${p}|${line}|${title}`).slice(0, 8)}`, source: 'mechanical', severity: sev, rule, path: p, start_line: line, title, fix, dismissible: false, ...extra };
}
const showAt = (rev, p) => tryGit(['show', `${rev}:${p}`]);

function guards(scope, base, skills) {
  const out = [];
  const notes = [];
  const inScope = new Map(scope.map((f) => [f.path, f]));

  for (const f of scope) {
    const p = f.path;
    const old = f.old_path || p;
    // 1. applied migrations are immutable; _journal.json append-only
    if (/^server\/src\/db\/migrations\//.test(old) && f.status !== 'A') {
      if (old.endsWith('meta/_journal.json') && f.status === 'M') {
        const a = JSON.parse(showAt(base.mb, old) || '{"entries":[]}');
        const b = JSON.parse(fs.readFileSync(p, 'utf8'));
        const prefixOk = a.entries.every((e, i) => JSON.stringify(e) === JSON.stringify(b.entries?.[i]));
        const { entries: _a, ...ra } = a;
        const { entries: _b, ...rb } = b;
        if (!prefixOk || JSON.stringify(ra) !== JSON.stringify(rb))
          out.push(mech('CRITICAL', 'do-not-touch: migrations journal is append-only', p, 1, 'Existing _journal.json entries changed', 'Restore the existing entries; only drizzle-kit may append.'));
      } else
        out.push(mech('CRITICAL', 'do-not-touch: applied migration', f.status === 'D' ? old : p, 1, `Applied migration ${f.status === 'D' ? 'deleted' : f.status === 'R' ? 'renamed' : 'edited'}`, 'Restore it; change src/db/schema/* and run pnpm db:generate for a new migration.'));
    }
    // 2. lock file only together with its package.json
    if (/(^|\/)(pnpm-lock\.yaml|package-lock\.json)$/.test(p) && f.status !== 'D') {
      const pj = path.posix.join(path.posix.dirname(p), 'package.json');
      if (!inScope.has(pj)) out.push(mech('CRITICAL', 'do-not-touch: lock file', p, 1, `Lock file changed without ${pj}`, 'Revert the lock file, or make the intended package.json change and reinstall.'));
    }
    // 3. pnpm-workspace.yaml is never committed
    if (/(^|\/)pnpm-workspace\.yaml$/.test(p)) {
      if (f.untracked) notes.push(`${p} is untracked (auto-created by pnpm) — do not \`git add -A\``);
      else out.push(mech('CRITICAL', 'do-not-touch: pnpm-workspace.yaml', p, 1, 'pnpm-workspace.yaml is committed', 'git rm --cached it; the repo is deliberately not a workspace.'));
    }
    // 4. shared contracts mirror
    let m = p.match(/^server\/src\/vendor\/shared\/(.+)$/);
    if (m && !inScope.has(`client/src/vendor/shared/${m[1]}`))
      out.push(mech('CRITICAL', 'mirror: vendor/shared', p, 1, `Not mirrored to client/src/vendor/shared/${m[1]}`, 'Mirror the touched part (only that part: the copies already drift).'));
    m = p.match(/^client\/src\/vendor\/shared\/(.+)$/);
    if (m && !inScope.has(`server/src/vendor/shared/${m[1]}`))
      out.push(mech('CRITICAL', 'mirror: vendor/shared', p, 1, 'Client copy edited without the server master', 'Edit server/src/vendor/shared first, then mirror.'));
    // 5. dependency-cruiser baseline may only lose entries (onion-architecture check 12)
    if (p === 'server/.dependency-cruiser-known-violations.json' && f.status !== 'D') {
      const key = (e) => `${e.from} -> ${e.to} [${e.rule?.name}]`;
      const now = JSON.parse(fs.readFileSync(p, 'utf8')).map(key);
      if (f.status === 'A')
        out.push(mech('WARNING', 'onion-architecture check 12', p, 1, `Baseline introduced with ${now.length} known violations`, 'Reviewers must accept the initial baseline explicitly; from then on it may only lose entries.'));
      else {
        const before = new Set(JSON.parse(showAt(base.mb, p) || '[]').map(key));
        for (const k of now.filter((k) => !before.has(k)))
          out.push(mech('CRITICAL', 'onion-architecture check 12', p, 1, `Baseline gained an entry: ${k}`, 'Fix the violation, or record an Architecture decision first; never accept it via deps:baseline alone.'));
      }
    }
    if (f.excluded) continue;
    // 6. process.env in feature code, 7. secrets
    const feature = /^(server\/src\/modules\/|reviewer-core\/src\/|client\/src\/)/.test(p) && !isTest(p);
    for (const [ln, text] of Object.entries(f.added)) {
      const t = text.trim();
      if (feature && /process\.env/.test(text) && !/^(\/\/|\*|\/\*)/.test(t))
        out.push(mech('CRITICAL', 'convention: no process.env in feature code', p, +ln, 'process.env read in feature code', 'Go through SecretsProvider / platform config.'));
      if (/-----BEGIN [A-Z ]*PRIVATE KEY-----|\bghp_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{50,}|\bsk-(?:ant-|or-)?[A-Za-z0-9_-]{24,}|\bAKIA[0-9A-Z]{16}\b|\bxox[baprs]-[A-Za-z0-9-]{10,}/.test(text))
        out.push(mech(isTest(p) ? 'WARNING' : 'CRITICAL', 'security: secret in diff', p, +ln, 'Secret-shaped string in an added line', 'Remove it and rotate the key if it is real; secrets live in ~/.devdigest/secrets.json.'));
    }
  }
  // 8. docs/specs rule (package-docs)
  for (const pkg of PACKAGES) {
    const code = scope.some((f) => pkgOf(f.path) === pkg && !f.excluded && isCode(f.path));
    const docs = scope.some((f) => f.path.startsWith(`${pkg}/docs/`) || f.path.startsWith(`${pkg}/specs/`));
    if (code && !docs) out.push(mech('WARNING', 'package-docs: docs/specs', `${pkg}/`, 0, `${pkg} code changed, docs/ and specs/ did not`, 'Update them, or state "docs/specs: no change needed — <reason>" in the PR body.'));
  }
  // 9. skill edited without a version bump (D8)
  for (const s of skills) {
    const f = inScope.get(s.file);
    if (!f || f.status !== 'M') continue;
    const before = frontmatter(showAt(base.mb, s.file) || '').metadata.version;
    if (before && before === s.version)
      out.push(mech('WARNING', 'D8: skill version', s.file, 1, `${s.name} edited without a version bump (still ${s.version})`, 'Bump metadata.version per the skill README and add a Changelog line.'));
  }
  // 10. reviewed state must be the PR state (D9)
  const dirty = scope.filter((f) => f.uncommitted && !/(^|\/)pnpm-workspace\.yaml$/.test(f.path));
  if (dirty.length)
    out.push(mech('CRITICAL', 'D9: uncommitted changes', dirty[0].path, 0, `${dirty.length} changed file(s) are not committed (${dirty.filter((f) => f.untracked).length} untracked)`, 'Commit them (or drop them) and re-run; the PR must equal the reviewed state.', { files: dirty.map((f) => f.path) }));
  return { findings: out, notes };
}

// ---------- packages and commands (D1) ----------

const COMMANDS = {
  server: [['pnpm typecheck', 'typecheck'], ["pnpm exec vitest run --exclude '**/*.it.test.ts'", 'unit tests']],
  client: [['pnpm typecheck', 'typecheck'], ['pnpm test', 'tests']],
  'reviewer-core': [['npm run typecheck', 'typecheck'], ['npm test', 'tests']],
  e2e: [['npm run typecheck', 'typecheck']],
};

function commandsFor(scope) {
  const code = scope.filter((f) => !f.excluded && isCode(f.path) || (/(^|\/)package\.json$/.test(f.path)));
  const touched = new Set(code.map((f) => pkgOf(f.path)).filter(Boolean));
  if (touched.has('reviewer-core')) touched.add('server'); // imported through a path alias
  if (code.some((f) => f.path.startsWith('server/src/vendor/shared/'))) {
    touched.add('client'); // mirror
    touched.add('reviewer-core'); // @devdigest/shared alias
  }
  const inputs = (pkg) =>
    scope.filter((f) => f.status !== 'D' && (pkgOf(f.path) === pkg || (pkg === 'server' && pkgOf(f.path) === 'reviewer-core') || (pkg !== 'server' && f.path.startsWith('server/src/vendor/shared/'))));
  const journal = readJournal();
  const cmds = [];
  for (const pkg of PACKAGES.filter((p) => touched.has(p)))
    for (const [command, label] of COMMANDS[pkg]) {
      const fingerprint = sha1(inputs(pkg).map((f) => `${f.path}:${f.blob}`).sort().join('\n')).slice(0, 16);
      const cached = journal.some((r) => r.kind === 'mech' && r.package === pkg && r.command === command && r.fingerprint === fingerprint && r.result === 'pass');
      cmds.push({ package: pkg, cwd: pkg, command, label, fingerprint, cached });
    }
  const dbCode = scope.some((f) => /^server\/src\/db\//.test(f.path) || /^server\/src\/modules\/.+\/repository/.test(f.path));
  let docker = null;
  let agentBrowser = null;
  if (dbCode) {
    docker = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 8000, encoding: 'utf8' }).status === 0;
    // e2e:hermetic drives a browser through the global agent-browser CLI; without it every flow fails.
    agentBrowser = spawnSync('agent-browser --version', { timeout: 8000, encoding: 'utf8', shell: true }).status === 0;
    const heavy = (pkg, command, label, files) => {
      const fingerprint = sha1(files.map((f) => `${f.path}:${f.blob}`).sort().join('\n')).slice(0, 16);
      const cached = journal.some((r) => r.kind === 'mech' && r.package === pkg && r.command === command && r.fingerprint === fingerprint && r.result === 'pass');
      cmds.push({ package: pkg, cwd: pkg, command, label, fingerprint, cached });
    };
    if (docker) heavy('server', 'pnpm exec vitest run .it.test', 'integration (Docker)', inputs('server'));
    if (docker && agentBrowser) heavy('e2e', 'npm run e2e:hermetic', 'e2e hermetic (Docker)', scope.filter((f) => f.status !== 'D'));
  }
  return { cmds, dbCode, docker, agentBrowser };
}

// ---------- transcripts (hints only; never unblock) ----------

function transcriptHints(todoPairs, base, scopeByPath) {
  const res = { status: 'none usable', sessions: 0, likely: new Set() };
  try {
    const cfg = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
    const roots = new Set([ROOT]);
    for (const l of (tryGit(['worktree', 'list', '--porcelain']) || '').split('\n'))
      if (l.startsWith('worktree ')) roots.add(l.slice(9).trim());
    const enc = (p) => path.resolve(p).replace(/[^a-zA-Z0-9]/g, '-');
    const since = +git(['show', '-s', '--format=%ct', base.mb]).trim() * 1000;
    const files = [];
    for (const r of roots) {
      const dir = path.join(cfg, 'projects', enc(r));
      if (!fs.existsSync(dir)) continue;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isFile() && e.name.endsWith('.jsonl')) files.push(path.join(dir, e.name));
        if (e.isDirectory()) {
          const sub = path.join(dir, e.name, 'subagents');
          if (fs.existsSync(sub)) for (const s of fs.readdirSync(sub)) if (s.endsWith('.jsonl')) files.push(path.join(sub, s));
        }
      }
    }
    const recent = files.filter((f) => fs.statSync(f).mtimeMs >= since);
    const rootsNorm = [...roots].map((r) => path.resolve(r).replace(/\\/g, '/').toLowerCase() + '/');
    const rel = (p) => {
      const n = String(p).replace(/\\/g, '/');
      const low = n.toLowerCase();
      for (const r of rootsNorm) if (low.startsWith(r)) return n.slice(r.length);
      return null;
    };
    const calls = []; // {skill, t, session}
    const touches = []; // {file, t, session, attr}
    for (const file of recent) {
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (!line.includes('"Skill"') && !line.includes('file_path') && !line.includes('<command-name>')) continue;
        let o;
        try {
          o = JSON.parse(line);
        } catch {
          continue;
        }
        const t = Date.parse(o.timestamp);
        const session = o.sessionId;
        if (!t || !session || (o.cwd && rel(o.cwd + '/') === null)) continue;
        const content = o.message?.content;
        const blocks = Array.isArray(content) ? content : [];
        const texts = typeof content === 'string' ? [content] : blocks.filter((b) => b?.type === 'text').map((b) => b.text);
        for (const b of blocks) {
          if (b?.type !== 'tool_use') continue;
          if (b.name === 'Skill' && b.input?.skill) calls.push({ skill: String(b.input.skill).split(':').pop(), t, session });
          if (['Read', 'Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(b.name) && b.input?.file_path) {
            const r = rel(b.input.file_path);
            if (r) touches.push({ file: r, t, session, attr: o.attributionSkill ? String(o.attributionSkill).split(':').pop() : null });
          }
        }
        for (const tx of texts) {
          const m = String(tx).match(/<command-name>\/([^<]+)<\/command-name>/);
          if (m) calls.push({ skill: m[1].split(':').pop(), t, session });
        }
      }
    }
    res.sessions = new Set([...calls, ...touches].map((x) => x.session)).size;
    res.status = recent.length ? `${recent.length} transcript file(s) scanned` : 'no transcripts since the merge-base';
    const lastChange = new Map();
    const lc = (p) => {
      if (!lastChange.has(p)) {
        let m = 0;
        try {
          m = fs.statSync(p).mtimeMs;
        } catch {}
        const c = +(tryGit(['log', '-1', '--format=%ct', '--', p]) || '0').trim() * 1000;
        lastChange.set(p, Math.max(m, c));
      }
      return lastChange.get(p);
    };
    for (const { skill, path: p } of todoPairs) {
      const low = p.toLowerCase();
      const after = lc(p);
      const hit = calls.some(
        (c) => c.skill === skill && c.t > after && touches.some((x) => x.session === c.session && x.file.toLowerCase() === low && x.t >= c.t),
      ) || touches.some((x) => x.attr === skill && x.file.toLowerCase() === low && x.t > after);
      if (hit) res.likely.add(`${skill}|${p}`);
    }
  } catch (e) {
    res.status = `none usable (${e.message.split('\n')[0]})`;
  }
  return res;
}

// ---------- plan ----------

const BATCH_FILES = 15;
const BATCH_LINES = 800;
const LARGE_BATCHES = 12;
const LARGE_TOKENS = 600_000;

function cmdPlan(a) {
  compactJournal();
  const base = resolveBase(a.base);
  const mode = a.mode === 'blocking' ? 'blocking' : 'full';
  const skills = loadSkills();
  const scope = buildScope(base);
  const byPath = new Map(scope.map((f) => [f.path, f]));
  const { findings: guardFindings, notes } = guards(scope, base, skills);
  const { cmds, dbCode, docker, agentBrowser } = commandsFor(scope);

  const routed = skills.filter((s) => s.matcher);
  const notRouted = skills.filter((s) => !s.matcher).map((s) => s.problem ? `${s.name} (${s.problem})` : s.name);
  const only = typeof a.skills === 'string' ? new Set(a.skills.split(',').map((s) => s.trim())) : null;
  const active = (mode === 'blocking' ? routed.filter((s) => s.blocking) : routed).filter((s) => !only || only.has(s.name));
  const reviewable = scope.filter((f) => !f.excluded);
  const pairs = [];
  for (const f of reviewable) for (const s of routed) if (matches(s.matcher, f.path)) pairs.push({ skill: s.name, path: f.path });
  const journal = readJournal();
  const done = new Set(journal.filter((r) => r.kind === 'check').map((r) => `${r.skill}|${r.skill_rev}|${r.path}|${r.blob}`));
  const rev = Object.fromEntries(skills.map((s) => [s.name, s.rev]));
  const activeNames = new Set(active.map((s) => s.name));
  const fromJournal = a.full ? [] : pairs.filter((p) => done.has(`${p.skill}|${rev[p.skill]}|${p.path}|${byPath.get(p.path).blob}`));
  const fromJournalSet = new Set(fromJournal.map((p) => `${p.skill}|${p.path}`));
  const open = pairs.filter((p) => !fromJournalSet.has(`${p.skill}|${p.path}`));
  const todo = open.filter((p) => activeNames.has(p.skill));
  const skippedByMode = open.filter((p) => !activeNames.has(p.skill));
  const hints = transcriptHints(todo, base, byPath);

  // batches: per skill, ≤ BATCH_FILES files or ≤ BATCH_LINES changed lines
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(JDIR, 'runs', runId);
  fs.mkdirSync(runDir, { recursive: true });
  const batches = [];
  for (const s of active) {
    const files = todo.filter((p) => p.skill === s.name).map((p) => byPath.get(p.path)).sort((x, y) => x.path.localeCompare(y.path));
    let cur = null;
    for (const f of files) {
      if (!cur || cur.files.length >= BATCH_FILES || (cur.lines + f.changed > BATCH_LINES && cur.files.length)) {
        cur = { skill: s.name, skill_rev: s.rev, files: [], lines: 0, bytes: 0 };
        batches.push(cur);
      }
      cur.files.push(f);
      cur.lines += f.changed;
      cur.bytes += Buffer.byteLength(f.diff);
    }
  }
  const skillBytes = Object.fromEntries(skills.map((s) => [s.name, s.bytes]));
  let estimate = 0;
  batches.forEach((b, i) => {
    b.id = String(i + 1).padStart(2, '0');
    b.tokens = Math.round(30000 + (skillBytes[b.skill] * 1.3) / 3.5 + b.bytes / 3.5 + b.files.length * 1500);
    estimate += b.tokens;
    const file = path.join(runDir, `batch-${b.id}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify(
        {
          run: runDir,
          batch: b.id,
          skill: b.skill,
          instructions: `${SKILLS_DIR}/${SELF}/checker.md`,
          findings_file: path.join(runDir, `batch-${b.id}.findings.json`),
          files: b.files.map((f) => ({ path: f.path, status: f.status, untracked: !!f.untracked, added_lines: Object.keys(f.added).map(Number), diff: f.diff })),
        },
        null,
        1,
      ),
    );
    b.file = file;
  });
  const verifyReserve = batches.length ? 40000 : 0;
  estimate += verifyReserve;

  const coveredBy = new Map();
  for (const p of pairs) coveredBy.set(p.path, [...(coveredBy.get(p.path) || []), p.skill]);
  const uncovered = reviewable.filter((f) => !coveredBy.has(f.path));
  const plan = {
    run: runDir,
    mode,
    full: !!a.full,
    only_skills: only ? [...only] : null,
    base,
    scope: {
      total: scope.length,
      reviewable: reviewable.length,
      untracked: scope.filter((f) => f.untracked).map((f) => f.path),
      excluded: scope.filter((f) => f.excluded).map((f) => ({ path: f.path, reason: f.excluded })),
      files: scope.map((f) => ({ path: f.path, status: f.status, blob: f.blob || null, excluded: f.excluded, changed: f.changed })),
    },
    skills: { routed: routed.map((s) => ({ name: s.name, rev: s.rev, blocking: s.blocking })), not_routed: notRouted, active: [...activeNames] },
    pairs: { total: pairs.length, from_journal: fromJournal.length, todo: todo.length, skipped_by_mode: skippedByMode.length, likely_checked: hints.likely.size },
    skipped_by_mode: skippedByMode,
    pairs_list: pairs.map((p) => ({ ...p, rev: rev[p.skill], blob: byPath.get(p.path).blob })),
    transcripts: { status: hints.status, sessions: hints.sessions, likely: [...hints.likely] },
    uncovered: {
      markdown: uncovered.filter((f) => !isCode(f.path)).length,
      code: uncovered.filter((f) => isCode(f.path)).map((f) => f.path),
      e2e_gap: scope.some((f) => pkgOf(f.path) === 'e2e' && !f.excluded),
    },
    guards: guardFindings,
    notes,
    commands: cmds,
    db_code_changed: dbCode,
    docker_up: docker,
    agent_browser: agentBrowser,
    batches: batches.map((b) => ({ id: b.id, skill: b.skill, files: b.files.length, lines: b.lines, tokens: b.tokens, file: b.file })),
    estimate_tokens: estimate,
    large: batches.length > LARGE_BATCHES || estimate > LARGE_TOKENS,
  };
  fs.writeFileSync(path.join(runDir, 'plan.json'), JSON.stringify(plan, null, 1));
  printPlan(plan);
}

function printPlan(p) {
  const L = [];
  const age = p.base.fetchAgeH == null ? 'never fetched' : `last fetch ${p.base.fetchAgeH < 48 ? p.base.fetchAgeH + ' h' : Math.round(p.base.fetchAgeH / 24) + ' d'} ago`;
  L.push(`pr-self-review plan — mode ${p.mode}${p.only_skills ? ` · skills ${p.only_skills.join(', ')}` : ''}${p.full ? ' (--full: journal ignored)' : ''}`);
  L.push(`Base: ${p.base.ref} @ ${p.base.short} (${age}; not fetched by this run)`);
  L.push(`Scope: ${p.scope.total} files · reviewable ${p.scope.reviewable} · excluded ${p.scope.excluded.length} · untracked ${p.scope.untracked.length}`);
  L.push(`Skills routed: ${p.skills.routed.map((s) => s.name + (s.blocking ? '*' : '')).join(', ')}  (* = blocking)`);
  L.push(`Not routed (no applies_to): ${p.skills.not_routed.join(', ') || '—'}`);
  L.push(`Pairs: ${p.pairs.total} · from journal ${p.pairs.from_journal} · to run ${p.pairs.todo} · skipped by mode ${p.pairs.skipped_by_mode} · likely checked (transcripts) ${p.pairs.likely_checked}`);
  L.push(`Transcripts: ${p.transcripts.status}`);
  L.push(`Batches: ${p.batches.length} · estimate ~${Math.round(p.estimate_tokens / 1000)}k tokens${p.large ? '  ⚠ LARGE — ask before spawning' : ''}`);
  for (const b of p.batches) L.push(`  ${b.id} ${b.skill} · ${b.files} files · ${b.lines} lines · ~${Math.round(b.tokens / 1000)}k`);
  L.push(`Commands (${p.commands.length}):`);
  for (const c of p.commands) L.push(`  [${c.cached ? 'cached pass' : 'run'}] ${c.cwd}: ${c.command}  (fp ${c.fingerprint})`);
  if (p.db_code_changed && !p.docker_up) L.push('  Docker suites needed (DB code changed) but Docker is not up → WARNING "integration not run"');
  if (p.db_code_changed && p.docker_up && !p.agent_browser) L.push('  e2e hermetic needed but agent-browser is not installed → WARNING "e2e not run"');
  L.push(`Guards: ${p.guards.length ? p.guards.map((g) => `${g.severity} ${g.rule} ${g.path}`).join(' | ') : 'clean'}`);
  for (const n of p.notes) L.push(`Note: ${n}`);
  L.push(`Uncovered: ${p.uncovered.code.length} code file(s), ${p.uncovered.markdown} Markdown file(s)${p.uncovered.e2e_gap ? ' · e2e/ has no checker skill (D11)' : ''}`);
  L.push(`Run dir: ${p.run}`);
  console.log(L.join('\n'));
}

// ---------- record-mech ----------

function loadPlan(a) {
  if (!a.run) throw new Error('--run <dir> is required');
  return JSON.parse(fs.readFileSync(path.join(a.run, 'plan.json'), 'utf8'));
}

function cmdRecordMech(a) {
  const plan = loadPlan(a);
  const c = plan.commands.find((x) => x.package === a.package && x.command === a.command);
  if (!c) throw new Error(`no such command in plan: ${a.package} / ${a.command}`);
  append([{ kind: 'mech', package: c.package, command: c.command, fingerprint: c.fingerprint, result: a.result === 'pass' ? 'pass' : 'fail', summary: typeof a.summary === 'string' ? a.summary.replace(/\x1b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim().slice(0, 300) : '' }]);
  console.log(`recorded ${c.package}: ${c.command} → ${a.result}`);
}

// ---------- ground ----------

const SEVS = ['CRITICAL', 'WARNING', 'SUGGESTION'];

function cmdGround(a) {
  const plan = loadPlan(a);
  const base = plan.base;
  const scope = buildScope({ ...base });
  const byPath = new Map(scope.map((f) => [f.path, f]));
  const skills = Object.fromEntries(loadSkills().map((s) => [s.name, s]));
  const kept = [];
  const dropped = [];
  const records = [];
  const missing = [];
  const incomplete = [];
  for (const b of plan.batches) {
    const fFile = path.join(plan.run, `batch-${b.id}.findings.json`);
    if (!fs.existsSync(fFile)) {
      missing.push(b.id);
      continue;
    }
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(fFile, 'utf8'));
    } catch (e) {
      missing.push(`${b.id} (bad JSON)`);
      continue;
    }
    const batch = JSON.parse(fs.readFileSync(b.file, 'utf8'));
    const batchPaths = batch.files.map((f) => f.path);
    // The reply must say what was covered: {checked_files, rules_applied, findings}. A 'check' is
    // journaled only for files the checker lists as checked, so an empty or partial reply never
    // counts as coverage.
    if (!raw || Array.isArray(raw) || !Array.isArray(raw.checked_files) || !Array.isArray(raw.findings)) {
      incomplete.push({ batch: b.id, skill: b.skill, reason: 'reply is not {checked_files, rules_applied, findings}', files: batchPaths });
      continue;
    }
    const rules = (Array.isArray(raw.rules_applied) ? raw.rules_applied : []).map(String).filter((r) => r.trim());
    const checked = new Set(rules.length ? raw.checked_files.map((p) => String(p).replace(/\\/g, '/')).filter((p) => batchPaths.includes(p)) : []);
    const unchecked = batchPaths.filter((p) => !checked.has(p));
    if (unchecked.length)
      incomplete.push({ batch: b.id, skill: b.skill, reason: rules.length ? `${unchecked.length}/${batchPaths.length} file(s) not in checked_files` : 'rules_applied is empty', files: unchecked });
    const perFile = new Map(batchPaths.map((p) => [p, []]));
    for (const f of raw.findings) {
      const why = groundOne(f, b.skill, byPath, perFile);
      if (why) dropped.push({ batch: b.id, skill: b.skill, title: f.title || '(untitled)', path: f.path, reason: why });
    }
    for (const [p, list] of perFile) {
      const file = byPath.get(p);
      if (!file || !checked.has(p)) continue;
      records.push({ kind: 'check', skill: b.skill, skill_rev: skills[b.skill]?.rev || b.skill_rev, path: p, blob: file.blob, base: base.mb, head: base.head, result: list.length ? 'findings' : 'clean', finding_ids: list.map((x) => x.id), rules_applied: rules });
      for (const x of list) {
        kept.push(x);
        records.push({ kind: 'finding', id: x.id, severity: x.severity, skill: x.skill, rule: x.rule, path: x.path, start_line: x.start_line, end_line: x.end_line, line_hash: x.line_hash, blob: file.blob, title: x.title, explanation: x.explanation || '', fix: x.fix || '' });
      }
    }
  }
  if (records.length) append(records);
  const out = { kept, dropped, missing_batches: missing, incomplete };
  fs.writeFileSync(path.join(plan.run, 'ground.json'), JSON.stringify(out, null, 1));
  console.log(`grounded: kept ${kept.length} · dropped ${dropped.length}${missing.length ? ` · missing batches ${missing.join(', ')}` : ''}${incomplete.length ? ` · incomplete batches ${incomplete.map((x) => x.batch).join(', ')}` : ''}`);
  for (const x of incomplete) console.log(`  incomplete ${x.batch} (${x.skill}): ${x.reason} — ${x.files.join(', ')}`);
  for (const d of dropped) console.log(`  dropped "${d.title}" (${d.skill}, ${d.path}): ${d.reason}`);
}

function groundOne(f, skill, byPath, perFile) {
  if (!SEVS.includes(f.severity)) return `bad severity '${f.severity}'`;
  if (f.confidence === 'low') return 'confidence low';
  if (!f.rule || !String(f.rule).trim()) return 'no rule named';
  const file = byPath.get(f.path);
  if (!file || file.excluded || !perFile.has(f.path)) return `file '${f.path}' not in this batch's scope`;
  const s = Math.min(+f.start_line, +(f.end_line ?? f.start_line));
  const e = Math.max(+f.start_line, +(f.end_line ?? f.start_line));
  if (!Number.isFinite(s)) return 'no line';
  let lineText = null;
  if (f.kind === 'placement') {
    if (!(file.status === 'A' || file.status === 'R' || file.untracked)) return 'placement finding on a file that was not added or moved';
    lineText = `placement:${f.path}`;
  } else {
    const ev = norm(String(f.evidence || '').split('\n').find((l) => l.trim()) || '');
    for (let ln = s; ln <= e; ln++) {
      const t = file.added[ln];
      if (t === undefined) continue;
      if (!ev || norm(t).includes(ev) || (ev.includes(norm(t)) && norm(t).length > 3)) {
        lineText = norm(t);
        break;
      }
    }
    if (lineText === null) {
      const anyAdded = Object.keys(file.added).some((k) => +k >= s && +k <= e);
      return anyAdded ? 'evidence not found on the cited added lines' : `lines ${s}-${e} do not intersect any added line in '${f.path}'`;
    }
  }
  const id = sha1(`${skill}|${f.rule}|${f.path}|${lineText}`).slice(0, 8);
  perFile.get(f.path).push({ ...f, skill, start_line: s, end_line: e, id, line_hash: sha1(lineText).slice(0, 12) });
  return null;
}

// ---------- report ----------

function cmdReport(a) {
  const plan = loadPlan(a);
  const journal = readJournal();
  const g = fs.existsSync(path.join(plan.run, 'ground.json')) ? JSON.parse(fs.readFileSync(path.join(plan.run, 'ground.json'), 'utf8')) : { kept: [], dropped: [], missing_batches: plan.batches.map((b) => b.id) };
  const verify = fs.existsSync(path.join(plan.run, 'verify.json')) ? JSON.parse(fs.readFileSync(path.join(plan.run, 'verify.json'), 'utf8')) : [];
  const vmap = new Map(verify.map((v) => [v.id, v]));
  const scopeBlob = new Map(plan.scope.files.map((f) => [f.path, f.blob]));

  const findings = [];
  // mechanical
  for (const m of plan.guards) findings.push({ ...m });
  for (const c of plan.commands) {
    const r = [...journal].reverse().find((x) => x.kind === 'mech' && x.package === c.package && x.command === c.command && x.fingerprint === c.fingerprint);
    if (!r) findings.push(mech('CRITICAL', 'verification: not run', `${c.package}/`, 0, `${c.label} not run: ${c.command}`, 'Run it and record the result.'));
    else if (r.result !== 'pass') findings.push(mech('CRITICAL', 'verification: failed', `${c.package}/`, 0, `${c.label} failed: ${c.command}`, (r.summary || 'See the command output.').replace(/\x1b\[[0-9;]*m/g, '')));
  }
  if (plan.db_code_changed && !plan.docker_up) findings.push(mech('WARNING', 'verification: integration not run', 'server/', 0, 'DB code changed but Docker is not up: integration and e2e suites not run', 'Start Docker and re-run, or run them in CI.'));
  if (plan.db_code_changed && plan.docker_up && plan.agent_browser === false) findings.push(mech('WARNING', 'verification: e2e not run', 'e2e/', 0, 'DB code changed but agent-browser is not installed: e2e hermetic not run', 'npm i -g agent-browser && agent-browser install, then re-run.'));
  if (g.missing_batches?.length) findings.push(mech('CRITICAL', 'self-review incomplete', '-', 0, `Checker batches without results: ${g.missing_batches.join(', ')}`, 'Re-run those batches.'));
  for (const x of g.incomplete || [])
    findings.push(mech('CRITICAL', 'self-review incomplete', '-', 0, `Batch ${x.batch} (${x.skill}): ${x.reason}`, 'Re-run pr-self-review: files without a journal check are planned again.', { files: x.files }));
  // skill findings: verify + dismissals (D12)
  const dismissals = journal.filter((r) => r.kind === 'dismissal');
  const dismissedList = [];
  // Open skill findings = the latest journal check of every current (skill, rev, path, blob) pair,
  // so pairs served from the journal keep their findings; fall back to this run's ground output.
  let skillFindings = g.kept;
  if (plan.pairs_list) {
    const checks = new Map();
    const found = new Map();
    for (const r of journal) {
      if (r.kind === 'check') checks.set(`${r.skill}|${r.skill_rev}|${r.path}|${r.blob}`, r);
      if (r.kind === 'finding') found.set(`${r.id}|${r.blob}`, r);
    }
    skillFindings = [];
    for (const p of plan.pairs_list) {
      const c = checks.get(`${p.skill}|${p.rev}|${p.path}|${p.blob}`);
      for (const id of c?.finding_ids || []) {
        const f = found.get(`${id}|${p.blob}`);
        if (f) skillFindings.push(f);
      }
    }
  }
  for (const f0 of skillFindings) {
    const f = { ...f0, source: 'skill', dismissible: true };
    const v = vmap.get(f.id);
    if (f.severity === 'CRITICAL' && v?.verdict === 'disproved') {
      f.severity = 'WARNING';
      f.note = `downgraded by verify: ${v.reason}`;
    }
    const blob = scopeBlob.get(f.path);
    const exact = dismissals.find((d) => d.finding_id === f.id && d.blob === blob);
    const earlier = dismissals.find((d) => d.finding_id === f.id && d.blob !== blob);
    if (exact) {
      dismissedList.push({ ...f, reason: exact.reason, by: exact.by });
      continue;
    }
    if (earlier) f.note = `previously dismissed (file changed since): ${earlier.reason}${f.severity === 'CRITICAL' ? ' — blocks again' : ''}`;
    findings.push(f);
  }
  const rank = { CRITICAL: 0, WARNING: 1, SUGGESTION: 2 };
  findings.sort((x, y) => rank[x.severity] - rank[y.severity] || x.path.localeCompare(y.path));
  const counts = Object.fromEntries(SEVS.map((s) => [s, findings.filter((f) => f.severity === s).length]));
  const verdict = counts.CRITICAL ? 'BLOCKED' : 'PASS';
  const tree = sha1(plan.scope.files.map((f) => `${f.path}:${f.blob}`).sort().join('\n')).slice(0, 16);
  append([{ kind: 'run', base: plan.base.mb, head: plan.base.head, tree, mode: plan.mode, verdict: verdict.toLowerCase(), counts }]);

  const age = plan.base.fetchAgeH == null ? 'never fetched' : `last fetch ${plan.base.fetchAgeH < 48 ? plan.base.fetchAgeH + ' h' : Math.round(plan.base.fetchAgeH / 24) + ' d'} ago`;
  const branch = (tryGit(['rev-parse', '--abbrev-ref', 'HEAD']) || '').trim();
  const L = [];
  L.push(`pr-self-review — ${branch} vs ${plan.base.ref} (${plan.base.short}, ${age}) · mode ${plan.mode} · ${verdict}`);
  L.push(`Scope: ${plan.scope.total} files (${plan.scope.untracked.length} untracked) · excluded ${plan.scope.excluded.length}`);
  L.push(`Checks: ${plan.skills.active.length} skill(s) · ${plan.pairs.total} pairs · ${plan.pairs.from_journal} from journal · ${plan.pairs.todo} run now (${plan.pairs.likely_checked} likely checked in transcripts)${plan.pairs.skipped_by_mode ? ` · ${plan.pairs.skipped_by_mode} not checked in this mode` : ''}`);
  L.push(`Mechanical: ${plan.commands.map((c) => `${c.package} ${c.label} ${statusOf(journal, c)}`).join(' · ') || 'no package code changed'} · guards ${plan.guards.filter((x) => x.severity === 'CRITICAL').length ? '✗' : '✓'}`);
  L.push(`Findings: ${counts.CRITICAL} CRITICAL · ${counts.WARNING} WARNING · ${counts.SUGGESTION} SUGGESTION · ${dismissedList.length} dismissed · ${g.dropped.length} dropped by grounding`);
  L.push(`Not routed: ${plan.skills.not_routed.join(', ') || '—'}`);
  L.push(`Not covered by any skill: ${plan.uncovered.code.length} code file(s)${plan.uncovered.code.length ? ' (' + plan.uncovered.code.slice(0, 8).join(', ') + (plan.uncovered.code.length > 8 ? ', …' : '') + ')' : ''}, ${plan.uncovered.markdown} Markdown${plan.uncovered.e2e_gap ? ' · e2e/: no checker skill (D11)' : ''}`);
  for (const sev of SEVS) {
    const list = findings.filter((f) => f.severity === sev);
    if (!list.length) continue;
    L.push(sev);
    list.forEach((f, i) => {
      const loc = f.start_line ? `${f.path}:${f.start_line}` : f.path;
      L.push(`  ${i + 1}. [${f.id}] ${loc} — ${f.source === 'skill' ? f.skill + ' · ' : ''}${f.rule}: ${f.title}`);
      if (f.explanation) L.push(`     why: ${f.explanation}`);
      if (f.fix) L.push(`     fix: ${f.fix}`);
      if (f.note) L.push(`     note: ${f.note}`);
      if (f.files) L.push(`     files: ${f.files.slice(0, 10).join(', ')}${f.files.length > 10 ? ', …' : ''}`);
    });
  }
  for (const n of plan.notes) L.push(`Note: ${n}`);
  if (g.dropped.length) L.push(`Dropped by grounding: ${g.dropped.map((d) => `"${d.title}" (${d.reason})`).join('; ')}`);
  L.push(verdict === 'BLOCKED' ? 'Next: fix, or `dismiss <id> --reason "<why>"` (skill findings only), then re-run. No PR while BLOCKED.' : 'No open CRITICAL: a PR may be created from this exact state.');
  console.log(L.join('\n'));

  if (a['pr-body']) {
    const P = [];
    P.push('### Self-review (pr-self-review)');
    P.push(`- Base: ${plan.base.ref} @ ${plan.base.short} · mode ${plan.mode}`);
    P.push(`- Skills: ${plan.skills.active.join(', ')} over ${plan.scope.reviewable} files (${plan.pairs.from_journal} pairs from earlier runs, ${plan.pairs.todo} now)`);
    P.push(`- Verification: ${plan.commands.map((c) => `${c.package} ${c.label} ${statusOf(journal, c)}`).join(' · ') || '—'}`);
    P.push(`- Findings: ${counts.CRITICAL} critical · ${counts.WARNING} warning · ${counts.SUGGESTION} suggestion`);
    for (const f of findings.filter((x) => x.severity !== 'CRITICAL')) P.push(`  - ${f.severity.toLowerCase()} · ${f.path}${f.start_line ? ':' + f.start_line : ''} — ${f.title}`);
    for (const d of dismissedList) P.push(`- Dismissed: [${d.id}] ${d.skill} ${d.rule} at ${d.path}:${d.start_line} — "${d.reason}" (by ${d.by})`);
    if (plan.uncovered.code.length || plan.uncovered.e2e_gap) P.push(`- Not covered by a skill: ${plan.uncovered.code.slice(0, 8).join(', ')}${plan.uncovered.e2e_gap ? ' (e2e/: no checker skill)' : ''}`);
    fs.writeFileSync(path.join(plan.run, 'pr-body.md'), P.join('\n') + '\n');
    console.log('\n' + P.join('\n'));
  }
}
function statusOf(journal, c) {
  const r = [...journal].reverse().find((x) => x.kind === 'mech' && x.package === c.package && x.command === c.command && x.fingerprint === c.fingerprint);
  return !r ? '— not run' : r.result === 'pass' ? '✓' : '✗';
}

// ---------- dismiss ----------

function cmdDismiss(a) {
  const id = a._[1];
  if (!id || typeof a.reason !== 'string' || !a.reason.trim()) throw new Error('usage: dismiss <finding-id> --reason "<why>"');
  if (id.startsWith('m-')) throw new Error('mechanical findings cannot be dismissed (D2): fix them');
  const f = [...readJournal()].reverse().find((r) => r.kind === 'finding' && r.id === id);
  if (!f) throw new Error(`finding ${id} not found in the journal`);
  const blob = fs.existsSync(f.path) ? git(['hash-object', '--', f.path]).trim() : null;
  const by = (tryGit(['config', 'user.name']) || 'unknown').trim();
  append([{ kind: 'dismissal', finding_id: id, blob, line_hash: f.line_hash, severity: f.severity, reason: a.reason.trim(), by }]);
  console.log(`dismissed ${id} (${f.severity} ${f.skill} ${f.path}:${f.start_line}) for blob ${blob?.slice(0, 7)}`);
}

// ---------- main ----------

const a = args(process.argv.slice(2));
const cmd = a._[0];
try {
  if (cmd === 'plan') cmdPlan(a);
  else if (cmd === 'record-mech') cmdRecordMech(a);
  else if (cmd === 'ground') cmdGround(a);
  else if (cmd === 'report') cmdReport(a);
  else if (cmd === 'dismiss') cmdDismiss(a);
  else {
    console.error('usage: self-review.mjs plan|record-mech|ground|report|dismiss (see header)');
    process.exit(2);
  }
} catch (e) {
  console.error(`pr-self-review: ${e.message}`);
  process.exit(1);
}
