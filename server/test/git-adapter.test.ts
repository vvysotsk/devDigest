import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SimpleGitClient } from '../src/adapters/git/simple-git.js';

/**
 * HW02 2b — `GitClient.listRootFiles` (D15 sampling): the regular files
 * directly in the clone root, non-recursive, no directories, no dotfile
 * filtering; `[]` when the clone does not exist. No git command runs here.
 */
describe('SimpleGitClient.listRootFiles', () => {
  let cloneDir: string;
  const repo = { owner: 'acme', name: 'root-files' };

  beforeAll(async () => {
    cloneDir = await mkdtemp(join(tmpdir(), 'git-adapter-'));
    const root = join(cloneDir, repo.owner, repo.name);
    await mkdir(join(root, 'src'), { recursive: true });
    await mkdir(join(root, 'tsconfig'), { recursive: true }); // a directory with a config-like name
    await writeFile(join(root, 'tsconfig.json'), '{}\n');
    await writeFile(join(root, '.prettierrc'), '{}\n');
    await writeFile(join(root, 'package.json'), '{}\n');
    await writeFile(join(root, 'src', 'index.ts'), 'export {};\n');
    await writeFile(join(root, 'src', 'tsconfig.json'), '{}\n');
  });
  afterAll(async () => {
    await rm(cloneDir, { recursive: true, force: true });
  });

  it('lists only the regular files of the root, dotfiles included, nothing nested', async () => {
    const git = new SimpleGitClient(cloneDir);
    const names = (await git.listRootFiles(repo)).sort();
    expect(names).toEqual(['.prettierrc', 'package.json', 'tsconfig.json']);
  });

  it('returns [] for a repo that was never cloned', async () => {
    const git = new SimpleGitClient(cloneDir);
    expect(await git.listRootFiles({ owner: 'acme', name: 'missing' })).toEqual([]);
  });
});
