import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RepoIntelService } from '../src/modules/repo-intel/service.js';
import type { RepoBasics } from '../src/modules/repo-intel/repository.js';
import type { Container } from '../src/platform/container.js';
import { MockCodeParser } from '../src/adapters/mocks.js';

/**
 * Phantom-API gate (`getUnresolvedReferences`) over the `CodeParser` port.
 * The parser is the deterministic fake, so this pins the service's rule —
 * a bare invocation is phantom unless declared, imported or a known global —
 * independently of what ast-grep extracts (that is `astgrep.test.ts`).
 * The clone is a temp dir: the service still reads files with `node:fs`.
 */

let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'repo-intel-phantom-'));
  await mkdir(join(root, 'src'), { recursive: true });
  await writeFile(join(root, 'src/a.ts'), '// content is ignored by the fake parser\n');
  await writeFile(join(root, 'README.md'), '# not parsed\n');
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

function makeService(parser: MockCodeParser): RepoIntelService {
  const container = {
    config: { repoIntelEnabled: true },
    db: {}, // never queried — service.repo is overridden below
    codeParser: parser,
  } as unknown as Container;
  const svc = new RepoIntelService(container);
  const basics: RepoBasics = {
    id: 'r1',
    owner: 'o',
    name: 'n',
    defaultBranch: 'main',
    clonePath: root,
  };
  (svc as unknown as { repo: Record<string, unknown> }).repo = {
    getRepoBasics: async () => basics,
  };
  return svc;
}

describe('RepoIntelService.getUnresolvedReferences with a fake CodeParser', () => {
  it('flags only heads that are not declared, imported or a known global', async () => {
    const parser = new MockCodeParser({
      symbols: {
        'src/a.ts': [
          { name: 'local', kind: 'function', line: 1, endLine: 3, exported: false, signature: 'function local()' },
        ],
      },
      imports: { 'src/a.ts': [{ name: 'dep', source: './dep', isType: false }] },
      heads: {
        'src/a.ts': [
          { name: 'local', line: 5, kind: 'call' },
          { name: 'dep', line: 6, kind: 'call' },
          { name: 'console', line: 7, kind: 'call' },
          { name: 'ghost', line: 8, kind: 'call' },
          { name: 'Phantom', line: 9, kind: 'new' },
        ],
      },
    });

    const refs = await makeService(parser).getUnresolvedReferences('r1', ['src/a.ts', 'README.md']);

    expect(refs).toEqual([
      { refFile: 'src/a.ts', refLine: 8, symbolName: 'ghost', declFile: null },
      { refFile: 'src/a.ts', refLine: 9, symbolName: 'Phantom', declFile: null },
    ]);
  });

  it('skips a file the clone does not contain', async () => {
    const parser = new MockCodeParser({
      heads: { 'src/gone.ts': [{ name: 'ghost', line: 1, kind: 'call' }] },
    });
    await expect(
      makeService(parser).getUnresolvedReferences('r1', ['src/gone.ts']),
    ).resolves.toEqual([]);
  });
});
