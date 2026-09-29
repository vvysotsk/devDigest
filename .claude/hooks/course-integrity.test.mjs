// node --test ".claude/hooks/*.test.mjs"  (a bare directory is not expanded on Node >= 21)
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { check, BLOCKED_SHAS } from "./course-integrity.mjs";

const HOOK = fileURLToPath(new URL("./course-integrity.mjs", import.meta.url));

const blocked = [
  ["a 7-char prefix of a blocked SHA", "git show 641b637 --stat"],
  ["a 12-char blocked SHA", "git diff c6af1e452969^ c6af1e452969"],
  ["an upper-case prefix", "git cherry-pick 93119A5E"],
  ["a prefix inside a range", "git log --oneline 66727c8..c6af1e4"],
  ["a prefix after a path separator", "git checkout 0953fdc -- server/src"],
  ["git --all", "git log --all --oneline"],
  ["git --all after global options", "git -C server --no-pager log --all -5"],
  ["git --all=<value>", "git branch --all=x"],
  ["git log -p without a range", "git log -p"],
  ["git log --patch on a path", "git log --patch -- server/src/db/seed.ts"],
  ["git log -S", "git log -S SEED_SKILLS"],
  ["git log -G (attached)", "git log -Gpage_size"],
  ["git log -L", "git log -L 1,20:server/src/app.ts"],
  ["git log -u (alias of -p)", "git log -u -3"],
  ["a ../path is not a range", "git log -p -- ../server/src/app.ts"],
  ["git log -p in a compound command", "cd server && git log -p -- src"],
];

const allowed = [
  "git log --oneline 8ae46a9..HEAD",
  "git log -p 8ae46a9..HEAD",
  "git show HEAD",
  "git diff main...HEAD",
  "git status",
  "git log --oneline -5",
  "echo deadbeef12 && ls",
  "git log --all-match --grep=skills --oneline 8ae46a9..HEAD",
];

for (const [name, command] of blocked) {
  test(`blocks: ${name}`, () => {
    assert.match(check(command) ?? "", /Course integrity \(hard rule\)/);
  });
}

for (const command of allowed) {
  test(`allows: ${command}`, () => {
    assert.equal(check(command), null);
  });
}

test("keeps the 16 SHAs of git rev-list 66727c8..c6af1e4", () => {
  assert.equal(BLOCKED_SHAS.length, 16);
  assert.equal(new Set(BLOCKED_SHAS).size, 16);
  for (const sha of BLOCKED_SHAS) assert.match(sha, /^[0-9a-f]{12}$/);
});

const run = (command) =>
  spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
    encoding: "utf8",
  });

test("as a hook: exit 2 with the reason on stderr for a blocked command", () => {
  const r = run("git show 641b637 --stat");
  assert.equal(r.status, 2);
  assert.match(r.stderr, /CLAUDE\.md/);
});

test("as a hook: exit 0 for an allowed command", () => {
  const r = run("git log -p 8ae46a9..HEAD");
  assert.equal(r.status, 0);
  assert.equal(r.stderr, "");
});
