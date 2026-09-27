import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import {
  INDEX_JOB_KIND,
  REFRESH_JOB_KIND,
  RESYNC_JOB_KIND,
} from '../src/modules/_shared/job-kinds.js';
import type { RepoIntel } from '../src/modules/repo-intel/types.js';

/**
 * One `RepoIntelService` per container: reads (`container.repoIntel`) and the
 * job handlers registered at boot by the repo-intel route plugin use the same
 * instance. No DB: buildApp connects lazily and nothing here queries.
 */
const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
const KINDS = [INDEX_JOB_KIND, REFRESH_JOB_KIND, RESYNC_JOB_KIND];

describe('repo-intel service instance and job registration', () => {
  it('serves reads from the cached instance and registers its three job kinds at boot', async () => {
    const app = await buildApp({ config });
    const c = app.container;

    expect(c.repoIntelService).toBe(c.repoIntelService);
    expect(c.repoIntel).toBe(c.repoIntelService);
    for (const kind of KINDS) expect(c.jobs.hasHandler(kind)).toBe(true);

    await app.close();
  });

  it('gives the service the container-owned RepoIntelRepository', async () => {
    const app = await buildApp({ config });
    const c = app.container;

    expect(c.repoIntelRepo).toBe(c.repoIntelRepo);
    expect((c.repoIntelService as unknown as { repo: unknown }).repo).toBe(c.repoIntelRepo);

    await app.close();
  });

  it('keeps the real handlers when a test overrides the read facade', async () => {
    const fake = {} as RepoIntel;
    const app = await buildApp({ config, overrides: { repoIntel: fake } });
    const c = app.container;

    expect(c.repoIntel).toBe(fake);
    expect(c.repoIntelService).not.toBe(fake);
    for (const kind of KINDS) expect(c.jobs.hasHandler(kind)).toBe(true);

    await app.close();
  });
});
