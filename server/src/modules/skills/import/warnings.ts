/**
 * D4 content warnings over `raw_source` (SKILL.md as found, frontmatter
 * included). The text is never stripped or rewritten — only reported.
 */
import type { SkillImportWarning } from '@devdigest/shared';
import { LONG_LINE_CHARS } from './types.js';

// U+200B–U+200F, U+202A–U+202E, U+2066–U+2069, U+FEFF
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

const codepoint = (ch: string) => `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`;

export function scanContentWarnings(raw: string): SkillImportWarning[] {
  const warnings: SkillImportWarning[] = [];
  const lines = raw.split(/\r\n|\n|\r/);
  lines.forEach((text, i) => {
    const line = i + 1;
    if (text.includes('<!--')) {
      warnings.push({
        kind: 'html_comment',
        line,
        detail: 'HTML comment: invisible when rendered, but it reaches the prompt.',
      });
    }
    const invisible = text.match(INVISIBLE);
    if (invisible) {
      const found = [...new Set(invisible.map(codepoint))].join(', ');
      warnings.push({
        kind: 'invisible_char',
        line,
        detail: `Invisible or bidi control character(s): ${found}.`,
      });
    }
    if (text.length > LONG_LINE_CHARS) {
      warnings.push({
        kind: 'long_line',
        line,
        detail: `Line is ${text.length} characters long (more than ${LONG_LINE_CHARS}).`,
      });
    }
  });
  return warnings;
}
