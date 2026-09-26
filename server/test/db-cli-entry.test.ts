/**
 * The `pnpm db:migrate` / `pnpm db:seed` CLI entry guard.
 *
 * Both scripts run their CLI branch only when the module is the process entry
 * point. The old guard compared `import.meta.url` with `file://${argv[1]}`,
 * which never matches on Windows (`file:///C:/…` vs `C:\…`) — the scripts then
 * exited 0 WITHOUT migrating or seeding. These tests run the scripts exactly
 * like the package scripts do (`tsx src/db/<script>.ts`, a RELATIVE path, cwd =
 * server/) with an empty DATABASE_URL: the CLI branch must run and fail with
 * "DATABASE_URL is required". Hermetic: no database is touched.
 */
import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isEntryPoint } from '../src/db/cli.js';

const run = promisify(execFile);
const SERVER = resolve(__dirname, '..');
const TSX = resolve(SERVER, 'node_modules/tsx/dist/cli.mjs');

async function runScript(rel: string) {
  try {
    const { stdout, stderr } = await run(process.execPath, [TSX, rel], {
      cwd: SERVER,
      env: { ...process.env, DATABASE_URL: '' }, // present but empty: dotenv will not override it
      timeout: 60_000,
    });
    return { code: 0, out: stdout + stderr };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { code: e.code ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

describe('isEntryPoint', () => {
  const migrateUrl = pathToFileURL(resolve(SERVER, 'src/db/migrate.ts')).href;

  it('matches a relative argv[1], as `tsx src/db/migrate.ts` passes it', () => {
    const cwd = process.cwd();
    process.chdir(SERVER);
    try {
      expect(isEntryPoint(migrateUrl, 'src/db/migrate.ts')).toBe(true);
    } finally {
      process.chdir(cwd);
    }
  });

  it('matches an absolute, platform-native argv[1]', () => {
    expect(isEntryPoint(migrateUrl, resolve(SERVER, 'src/db/migrate.ts'))).toBe(true);
  });

  it('does not match another file or a missing argv[1]', () => {
    expect(isEntryPoint(migrateUrl, resolve(SERVER, 'src/db/seed.ts'))).toBe(false);
    expect(isEntryPoint(migrateUrl, undefined)).toBe(false);
  });
});

describe('db CLI scripts run their CLI branch when invoked like the package scripts', () => {
  it.each(['src/db/migrate.ts', 'src/db/seed.ts'])('%s exits 1 with "DATABASE_URL is required"', async (script) => {
    const { code, out } = await runScript(script);
    expect(out).toContain('DATABASE_URL is required');
    expect(code).toBe(1);
  }, 90_000);
});
