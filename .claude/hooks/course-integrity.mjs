#!/usr/bin/env node
/**
 * PreToolUse hook (matcher: Bash) — enforces root CLAUDE.md "Course integrity
 * (hard rule)": other students' commits in this fork's history must never be
 * read. Reads the tool call JSON from stdin; exits 2 with a reason on stderr
 * when the Bash command
 *   - names one of BLOCKED_SHAS (any 7+ char prefix, or a longer SHA),
 *   - is a git command with `--all`,
 *   - is `git log` with a patch / pickaxe / line-log flag and no `A..B` range.
 * Otherwise exits 0. No dependencies.
 */
import { pathToFileURL } from "node:url";

/** `git rev-list 66727c8..c6af1e4` — merged and reverted student commits. */
export const BLOCKED_SHAS = [
  "c6af1e452969", "376ac49a98d3", "98eaf5712c84", "2006964c78b7",
  "641b6370a3ff", "56e3eb778ac4", "ae55e4b955d1", "8fa0ad036589",
  "512f3096d441", "84e2c1e69ee4", "ddd833d91dbf", "0953fdceb219",
  "97b6edc7f301", "3b17261d511f", "7641b481ef09", "93119a5e1352",
];

const RULE = 'See "Course integrity (hard rule)" in the root CLAUDE.md.';

// -u is git log's alias of -p.
const PATCH_FLAGS = new Set(["-p", "-u", "--patch", "--patch-with-stat", "--patch-with-raw"]);
const isPatchFlag = (t) => PATCH_FLAGS.has(t) || /^-[SGL]/.test(t);
// A..B / A...B / A.. — not a relative path such as ../x.
const isRange = (t) => /^[^.\s-][^\s]*?\.{2,3}[^.\s]*$/.test(t);

/** Split a shell command into simple-command segments of unquoted tokens. */
function segments(command) {
  return command
    .split(/&&|\|\||[;|\n]/)
    .map((seg) => (seg.match(/"[^"]*"|'[^']*'|\S+/g) ?? []).map((t) => t.replace(/^(["'])(.*)\1$/, "$2")));
}

/** For each `git` invocation: its subcommand and the arguments after it. */
function gitCalls(tokens) {
  const calls = [];
  tokens.forEach((t, i) => {
    if (!/(^|[\\/])git(\.exe)?$/.test(t)) return;
    let j = i + 1;
    while (j < tokens.length && tokens[j].startsWith("-")) {
      j += tokens[j] === "-C" || tokens[j] === "-c" ? 2 : 1;
    }
    calls.push({ sub: tokens[j] ?? "", args: tokens.slice(j + 1), all: tokens.slice(i + 1) });
  });
  return calls;
}

/** The reason to block `command`, or null when it may run. */
export function check(command) {
  for (const m of command.matchAll(/(?<![0-9a-f])[0-9a-f]{7,40}(?![0-9a-f])/gi)) {
    const tok = m[0].toLowerCase();
    const sha = BLOCKED_SHAS.find((s) => s.startsWith(tok) || tok.startsWith(s));
    if (sha) return `Blocked: the command names ${m[0]}, another student's commit (${sha}). ${RULE}`;
  }
  for (const tokens of segments(command)) {
    for (const { sub, args, all } of gitCalls(tokens)) {
      if (all.some((t) => t === "--all" || t.startsWith("--all="))) {
        return `Blocked: \`git ... --all\` reaches other students' commits. ${RULE}`;
      }
      if (sub === "log" || sub === "whatchanged") {
        const end = args.indexOf("--");
        const revs = end === -1 ? args : args.slice(0, end);
        if (revs.some(isPatchFlag) && !revs.some(isRange)) {
          return `Blocked: \`git ${sub}\` with -p/-S/-G/-L needs a range on our lineage (e.g. \`git log -p 8ae46a9..HEAD\`). ${RULE}`;
        }
      }
    }
  }
  return null;
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  let command = "";
  try {
    command = JSON.parse(raw)?.tool_input?.command ?? "";
  } catch {
    process.exit(0); // not a tool call payload
  }
  const reason = check(String(command));
  if (reason) {
    process.stderr.write(reason + "\n");
    process.exit(2);
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
