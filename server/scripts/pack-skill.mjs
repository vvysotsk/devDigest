#!/usr/bin/env node
// Packs a skill folder into a .zip for the manual import (L02):
//   pnpm skill:pack <dir> <out.zip>
// e.g. pnpm skill:pack test/fixtures/skills/api-deprecation-policy ../api-deprecation-policy.zip
// Entries sit under one top-level folder named after <dir>, with forward-slash
// paths (unlike PowerShell 5.1 Compress-Archive, which writes backslashes).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { zipSync } from 'fflate';

const [dirArg, outArg] = process.argv.slice(2);
if (!dirArg || !outArg) {
  console.error('usage: node scripts/pack-skill.mjs <dir> <out.zip>');
  process.exit(1);
}

const dir = resolve(dirArg);
if (!statSync(dir).isDirectory()) {
  console.error(`not a directory: ${dir}`);
  process.exit(1);
}
const top = basename(dir);

/** @type {Record<string, Uint8Array>} */
const entries = {};
const walk = (abs, rel) => {
  for (const name of readdirSync(abs).sort()) {
    const absChild = join(abs, name);
    const relChild = rel ? `${rel}/${name}` : name;
    const st = statSync(absChild);
    if (st.isDirectory()) walk(absChild, relChild);
    else if (st.isFile()) entries[`${top}/${relChild}`] = new Uint8Array(readFileSync(absChild));
  }
};
walk(dir, '');

const zip = zipSync(entries, { level: 9 });
writeFileSync(resolve(outArg), zip);
console.log(`packed ${Object.keys(entries).length} files from ${dir} → ${resolve(outArg)} (${zip.length} bytes)`);
