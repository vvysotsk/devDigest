import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * True when the module whose `import.meta.url` is `moduleUrl` is the process
 * entry point (`node script.ts` / `tsx script.ts`).
 *
 * `process.argv[1]` may be relative (`tsx src/db/migrate.ts`, as the package
 * scripts run it) or a Windows path (`C:\…\migrate.ts`). Comparing it with
 * `file://${argv[1]}` only works for absolute POSIX paths — on Windows the
 * CLI branch never ran and `pnpm db:migrate` exited 0 without migrating.
 * Normalising through `pathToFileURL(resolve(argv1)).href` fixes both cases.
 */
export function isEntryPoint(moduleUrl: string, argv1: string | undefined = process.argv[1]): boolean {
  if (!argv1) return false;
  return pathToFileURL(resolve(argv1)).href === moduleUrl;
}
