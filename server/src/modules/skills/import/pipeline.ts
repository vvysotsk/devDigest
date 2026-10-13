/**
 * Skill import pipeline (L02 D3/D4) — pure functions, no I/O. The preview
 * route and the save route both run `buildImportPreview` on the uploaded file;
 * the save then applies only the user's overrides with `resolveImportSave`.
 */
import {
  SKILL_BODY_MAX,
  SKILL_DESCRIPTION_MAX,
  SKILL_IMPORT_MAX_BYTES,
  SkillName,
  SkillType,
  type SkillImportFile,
  type SkillImportPreview,
  type SkillImportSave,
  type SkillImportWarning,
} from '@devdigest/shared';
import { splitFrontmatter } from './frontmatter.js';
import { baseName, lastSegment, toKebabName } from './name.js';
import { fail, type ImportFailure, type ImportResult } from './types.js';
import { scanContentWarnings } from './warnings.js';
import { readZip, type ZipFile } from './zip.js';

export type { ImportFailure } from './types.js';

export const SKILL_FILE = 'SKILL.md';
export const REASON_IMPORTED = 'imported as the skill body';
export const REASON_REFERENCE = 'not imported (v1)';
export const REASON_SKIPPED = 'skipped — never executed or stored';

const REFERENCE_PATH = /^references\/(?:[^/]+\/)*[^/]+\.md$/;
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * base64 → bytes, capped at SKILL_IMPORT_MAX_BYTES (`import_too_large`).
 * Malformed base64 → `import_bad_archive`.
 */
export function decodeImportBase64(contentBase64: string): ImportResult<{ bytes: Uint8Array }> {
  const b64 = contentBase64.trim();
  if (b64.length > Math.ceil(SKILL_IMPORT_MAX_BYTES / 3) * 4) {
    return fail('import_too_large', `The file is larger than ${SKILL_IMPORT_MAX_BYTES} bytes.`, {
      limit: SKILL_IMPORT_MAX_BYTES,
    });
  }
  if (b64.length % 4 !== 0 || !BASE64.test(b64)) {
    return fail('import_bad_archive', 'The upload is not valid base64.');
  }
  const bytes = new Uint8Array(Buffer.from(b64, 'base64'));
  if (bytes.length > SKILL_IMPORT_MAX_BYTES) {
    return fail('import_too_large', `The file is ${bytes.length} bytes; the limit is ${SKILL_IMPORT_MAX_BYTES}.`, {
      bytes: bytes.length,
      limit: SKILL_IMPORT_MAX_BYTES,
    });
  }
  return { ok: true, bytes };
}

export type BuildPreviewResult = { ok: true; preview: SkillImportPreview } | ImportFailure;

/**
 * Parses an uploaded `.md` or `.zip` into a preview. Stores nothing.
 * `existingNames` = the workspace's skill names (for the `name_exists` warning).
 */
export function buildImportPreview(
  input: { filename: string; bytes: Uint8Array },
  existingNames: ReadonlySet<string>,
): BuildPreviewResult {
  const filename = input.filename;
  if (input.bytes.length > SKILL_IMPORT_MAX_BYTES) {
    return fail('import_too_large', `The file is ${input.bytes.length} bytes; the limit is ${SKILL_IMPORT_MAX_BYTES}.`, {
      bytes: input.bytes.length,
      limit: SKILL_IMPORT_MAX_BYTES,
    });
  }
  const ext = /\.([^./\\]+)$/.exec(filename)?.[1]?.toLowerCase();

  let skillBytes: Uint8Array;
  let fallbackName: string;
  let files: SkillImportFile[];
  if (ext === 'md') {
    skillBytes = input.bytes;
    fallbackName = baseName(filename);
    files = [{ path: lastSegment(filename), status: 'imported', reason: REASON_IMPORTED, size: input.bytes.length }];
  } else if (ext === 'zip') {
    const zip = readZip(input.bytes);
    if (!zip.ok) return zip;
    const located = locateSkillMd(zip.files);
    if (!located.ok) return located;
    skillBytes = located.skill.data;
    fallbackName = located.root ? located.root : baseName(filename);
    files = classifyFiles(zip.files, located.skill.path, located.root);
  } else {
    return fail('import_unsupported_file', 'Only .md and .zip files can be imported.', { filename });
  }

  let raw: string;
  try {
    raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(skillBytes);
  } catch {
    return fail('import_bad_archive', `${SKILL_FILE} is not UTF-8 text.`);
  }

  const split = splitFrontmatter(raw);
  if (!split.ok) return split;
  const fm = split.frontmatter;

  const warnings: SkillImportWarning[] = [];

  // First in the list: the file is probably not a SKILL.md at all (a README, notes…).
  // The per-field warnings below still follow; the import is not blocked.
  if (!split.present) {
    warnings.push({
      kind: 'no_frontmatter',
      line: null,
      detail:
        'This file has no frontmatter — it does not look like a SKILL.md (a README or notes?). Skills start with --- name / description ---.',
    });
  }

  const fmName = scalarString(fm.name);
  const name = toKebabName(fmName ?? fallbackName);
  if (fmName !== undefined && name !== fmName) {
    warnings.push({ kind: 'name_normalized', line: null, detail: `"${fmName}" was rewritten to "${name}".` });
  }
  if (existingNames.has(name)) {
    warnings.push({ kind: 'name_exists', line: null, detail: `A skill named "${name}" already exists.` });
  }

  const fmType = scalarString(fm.type);
  const parsedType = SkillType.safeParse(fmType);
  const type = parsedType.success ? parsedType.data : 'custom';
  if (!parsedType.success) {
    warnings.push({
      kind: 'type_defaulted',
      line: null,
      detail: fmType === undefined ? 'No type in the frontmatter; using "custom".' : `Unknown type "${fmType}"; using "custom".`,
    });
  }

  const description = scalarString(fm.description) ?? '';
  if (description === '') {
    warnings.push({
      kind: 'description_missing',
      line: null,
      detail: 'No description in the frontmatter; write one before saving.',
    });
  }

  warnings.push(...scanContentWarnings(raw));

  return {
    ok: true,
    preview: {
      filename,
      draft: { name, description, type, body: split.body },
      raw_source: raw,
      frontmatter: fm,
      files,
      warnings,
    },
  };
}

export type ImportSaveOverrides = Partial<Pick<SkillImportSave, 'name' | 'description' | 'type'>>;

export type ResolvedImportSkill = { name: SkillName; description: string; type: SkillType; body: string };

/**
 * The skill an import save creates: overrides win over the draft; the body is
 * ALWAYS the parsed body (never an override).
 */
export function resolveImportSave(
  preview: SkillImportPreview,
  overrides: ImportSaveOverrides,
): { ok: true; skill: ResolvedImportSkill } | ImportFailure {
  const parsedName = SkillName.safeParse(overrides.name ?? preview.draft.name);
  if (!parsedName.success) {
    return fail('import_invalid_name', 'The skill name must be kebab-case, 1–64 characters.', {
      name: overrides.name ?? preview.draft.name,
    });
  }
  const description = (overrides.description ?? preview.draft.description).trim();
  if (description === '') {
    return fail('import_description_missing', 'The file has no description; provide one.');
  }
  // The same limits as SkillInput — the file can break them, the client cannot fix the body.
  if (description.length > SKILL_DESCRIPTION_MAX) {
    return fail(
      'import_invalid_field',
      `The description is longer than ${SKILL_DESCRIPTION_MAX} characters.`,
      { field: 'description', limit: SKILL_DESCRIPTION_MAX },
    );
  }
  const body = preview.draft.body;
  if (body.trim() === '') {
    return fail('import_invalid_field', 'SKILL.md has no body after the frontmatter.', {
      field: 'body',
      limit: 1,
    });
  }
  if (body.length > SKILL_BODY_MAX) {
    return fail('import_invalid_field', `The body is longer than ${SKILL_BODY_MAX} characters.`, {
      field: 'body',
      limit: SKILL_BODY_MAX,
    });
  }
  return {
    ok: true,
    skill: {
      name: parsedName.data,
      description,
      type: overrides.type ?? preview.draft.type,
      body,
    },
  };
}

/** A trimmed string for string / number / boolean frontmatter values; undefined otherwise or when empty. */
function scalarString(v: unknown): string | undefined {
  if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
}

/**
 * SKILL.md must sit at the archive root or directly inside a top-level folder,
 * and there must be exactly ONE such candidate. Several (e.g. two skills in
 * one archive, or a root one plus a folder one) → `import_no_skill_md`: the
 * pipeline never picks one silently. A SKILL.md deeper down is not a candidate.
 */
function locateSkillMd(files: ZipFile[]): ImportResult<{ skill: ZipFile; root: string }> {
  const candidates = files.filter((f) => {
    const parts = f.path.split('/');
    return parts.length <= 2 && parts[parts.length - 1] === SKILL_FILE;
  });
  if (candidates.length === 0) {
    return fail('import_no_skill_md', `No ${SKILL_FILE} at the archive root or in one top-level folder.`);
  }
  if (candidates.length > 1) {
    return fail(
      'import_no_skill_md',
      `Several ${SKILL_FILE} candidates (${candidates.map((c) => c.path).join(', ')}); import one skill per archive.`,
      { candidates: candidates.map((c) => c.path) },
    );
  }
  const skill = candidates[0]!;
  const root = skill.path.includes('/') ? skill.path.slice(0, skill.path.indexOf('/')) : '';
  return { ok: true, skill, root };
}

function classifyFiles(files: ZipFile[], skillPath: string, root: string): SkillImportFile[] {
  const prefix = root ? root + '/' : '';
  return files.map((f): SkillImportFile => {
    if (f.path === skillPath) return { path: f.path, status: 'imported', reason: REASON_IMPORTED, size: f.size };
    const rel = f.path.startsWith(prefix) ? f.path.slice(prefix.length) : null;
    if (rel !== null && REFERENCE_PATH.test(rel)) {
      return { path: f.path, status: 'reference', reason: REASON_REFERENCE, size: f.size };
    }
    return { path: f.path, status: 'skipped', reason: REASON_SKIPPED, size: f.size };
  });
}
