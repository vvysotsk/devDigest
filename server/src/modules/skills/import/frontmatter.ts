/**
 * SKILL.md frontmatter: a `---` fenced YAML block that opens on line 1 (an
 * optional BOM is the only tolerated prefix \u2014 blank lines before `---` mean
 * "no frontmatter", as GitHub and skill tooling read it). Parsed with `yaml`
 * (YAML 1.2 core schema: no custom tags are constructed, alias expansion is
 * capped). `present` tells a missing block from an empty `---\n---` one \u2014
 * both yield `frontmatter: {}`.
 */
import { parseDocument } from 'yaml';
import { fail, type ImportResult } from './types.js';

const OPEN = /^\uFEFF?---[ \t]*\r?\n/;
const CLOSE = /^---[ \t]*$/;

export function splitFrontmatter(
  source: string,
): ImportResult<{ present: boolean; frontmatter: Record<string, unknown>; body: string }> {
  const open = OPEN.exec(source);
  if (!open) return { ok: true, present: false, frontmatter: {}, body: trimBody(source.replace(/^\uFEFF/, '')) };

  const rest = source.slice(open[0].length);
  const lines = rest.split('\n');
  let offset = 0;
  let closeAt = -1;
  let closeLen = 0;
  for (const line of lines) {
    if (CLOSE.test(line.replace(/\r$/, ''))) {
      closeAt = offset;
      closeLen = line.length + 1;
      break;
    }
    offset += line.length + 1;
  }
  if (closeAt < 0) {
    return fail('import_bad_frontmatter', 'The frontmatter opened with `---` is never closed.');
  }

  const yamlText = rest.slice(0, closeAt);
  const doc = parseDocument(yamlText, { uniqueKeys: true });
  if (doc.errors.length > 0) {
    return fail('import_bad_frontmatter', `The frontmatter is not valid YAML: ${doc.errors[0]!.message}`, {
      errors: doc.errors.map((e) => e.message),
    });
  }
  let value: unknown;
  try {
    value = doc.toJS({ maxAliasCount: 100 });
  } catch (err) {
    return fail('import_bad_frontmatter', `The frontmatter is not valid YAML: ${(err as Error).message}`);
  }
  if (value === null || value === undefined) value = {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    return fail('import_bad_frontmatter', 'The frontmatter must be a YAML mapping (key: value).');
  }
  return {
    ok: true,
    present: true,
    frontmatter: value as Record<string, unknown>,
    body: trimBody(rest.slice(Math.min(rest.length, closeAt + closeLen))),
  };
}

/** Drops leading blank lines and trailing whitespace; keeps the body otherwise as written. */
const trimBody = (s: string) => s.replace(/^(?:[ \t]*\r?\n)+/, '').replace(/\s+$/, '');
