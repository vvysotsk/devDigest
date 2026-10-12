import { describe, expect, it } from 'vitest';
import { splitFrontmatter } from '../src/modules/skills/import/frontmatter.js';

/**
 * `trimBody` (frontmatter.ts:64) is private; both exits of `splitFrontmatter`
 * run the body through it — the no-frontmatter return (`:19`) and the
 * frontmatter one (`:59`) — so every case below is asserted on both paths.
 */
const FM = '---\nname: x\n---\n';

const bodyOf = (source: string): string => {
  const r = splitFrontmatter(source);
  if (!r.ok) throw new Error(`unexpected failure: ${r.code}`);
  return r.body;
};

const cases: Array<{ name: string; input: string; expected: string }> = [
  { name: 'drops trailing spaces', input: 'Body.   ', expected: 'Body.' },
  { name: 'drops trailing newlines', input: 'Body.\n\n\n', expected: 'Body.' },
  { name: 'drops trailing CRLF and tabs', input: 'Body.\t \r\n\r\n', expected: 'Body.' },
  { name: 'keeps inner whitespace and blank lines', input: 'a  b\n\n\n  c \n', expected: 'a  b\n\n\n  c' },
  { name: 'drops leading blank lines, keeps indentation of the first text line', input: '\n  \n\t\n  indented\n', expected: '  indented' },
  { name: 'returns an empty body for whitespace only', input: ' \n\t\n  ', expected: '' },
  { name: 'keeps a 100k-space run that is followed by a letter', input: ' '.repeat(100_000) + 'x', expected: ' '.repeat(100_000) + 'x' },
  { name: 'drops a 100k-space run at the end', input: 'x' + ' '.repeat(100_000), expected: 'x' },
  { name: 'drops a 100k-space run between a letter and a newline at the end', input: 'x' + ' '.repeat(100_000) + '\n', expected: 'x' },
];

describe('splitFrontmatter — body trimming (trimBody)', () => {
  for (const c of cases) {
    it(`${c.name} — without frontmatter`, () => {
      const r = splitFrontmatter(c.input);
      expect(r.ok && r.present).toBe(false);
      expect(bodyOf(c.input)).toBe(c.expected);
    });
    it(`${c.name} — with frontmatter`, () => {
      const r = splitFrontmatter(FM + c.input);
      expect(r.ok && r.present).toBe(true);
      expect(bodyOf(FM + c.input)).toBe(c.expected);
    });
  }

  it('strips a BOM before an unfenced body', () => {
    expect(bodyOf('﻿Body.\n')).toBe('Body.');
  });
});
