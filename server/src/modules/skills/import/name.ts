/**
 * Kebab-case normalisation for imported skill names ("API Deprecation_Policy"
 * → "api-deprecation-policy"). The result may still be empty; the save step
 * validates the final name against `SkillName`.
 */
const NAME_MAX = 64;
const COMBINING_MARKS = /[\u0300-\u036F]/g;

export function toKebabName(input: string): string {
  const kebab = input
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '') // strip diacritics
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2') // camelCase → camel-Case
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return kebab.slice(0, NAME_MAX).replace(/-+$/, '');
}

/** The last path segment (`/` or `\` separators). */
export function lastSegment(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? '';
}

/** File or folder name without directories and without a `.md` / `.zip` extension. */
export function baseName(path: string): string {
  return lastSegment(path).replace(/\.(md|zip)$/i, '');
}
