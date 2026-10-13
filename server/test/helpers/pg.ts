import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createDb, type DbHandle } from '../../src/db/client.js';
import { runMigrations } from '../../src/db/migrate.js';

/**
 * Testcontainers helper: spin a Postgres + pgvector container, run migrations,
 * return a Drizzle client. Uses the same `pgvector/pgvector:pg16` image as
 * docker-compose so the `vector` extension is available.
 *
 * Integration tests gate on `dockerAvailable()` and skip cleanly when Docker is
 * not reachable (CI/sandbox without a Docker daemon).
 */
export interface PgFixture {
  container: StartedPostgreSqlContainer;
  handle: DbHandle;
  url: string;
  stop: () => Promise<void>;
}

let dockerCache: boolean | undefined;

/**
 * Can we reach a Docker daemon? The timeout is generous on purpose: vitest
 * starts every `*.it.test.ts` file in parallel and each one spins up a
 * container, so under that load `docker info` can take well over 5 s — a
 * timeout here silently SKIPS the whole file (it reports as green).
 *
 * With `DEVDIGEST_REQUIRE_DOCKER=1` (set by CI and by the documented gate
 * command) an unreachable Docker THROWS instead, so the file fails and the gate
 * goes red — a gate must never pass by skipping its integration tests.
 */
export async function dockerAvailable(): Promise<boolean> {
  if (dockerCache === undefined) {
    try {
      const { execSync } = await import('node:child_process');
      execSync('docker info', { stdio: 'ignore', timeout: 30_000 });
      dockerCache = true;
    } catch {
      dockerCache = false;
    }
  }
  if (!dockerCache && process.env.DEVDIGEST_REQUIRE_DOCKER === '1') {
    throw new Error(
      'DEVDIGEST_REQUIRE_DOCKER=1 but the Docker daemon is not reachable — integration tests must run, not skip',
    );
  }
  return dockerCache;
}

export async function startPg(): Promise<PgFixture> {
  const container = await new PostgreSqlContainer('pgvector/pgvector:pg16')
    .withDatabase('devdigest')
    .withUsername('devdigest')
    .withPassword('devdigest')
    .start();
  const url = container.getConnectionUri();
  await runMigrations(url);
  const handle = createDb(url, { max: 5 });
  return {
    container,
    handle,
    url,
    stop: async () => {
      await handle.close();
      await container.stop();
    },
  };
}
