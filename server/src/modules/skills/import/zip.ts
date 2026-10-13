/**
 * In-memory .zip reader for skill imports (L02 D3). Pure: no fs, no disk
 * writes, nothing executed. The central directory is read and checked BEFORE
 * anything is inflated (entry count, declared sizes, unsafe paths, symlinks),
 * then fflate inflates only the vetted file entries, and the inflated sizes are
 * checked again. fflate inflates each entry into a buffer of its DECLARED size,
 * so a lying header cannot make it allocate more than the declared total.
 */
import { strFromU8, unzipSync } from 'fflate';
import { fail, type ImportResult, ZIP_MAX_ENTRIES, ZIP_MAX_UNCOMPRESSED_BYTES } from './types.js';

export type ZipFile = {
  /** Normalised path: `/` separators, no `.` or empty segments. */
  path: string;
  /** Uncompressed size in bytes (actual inflated length). */
  size: number;
  data: Uint8Array;
};

type CentralEntry = {
  /** Name exactly as fflate decodes it — the key of `unzipSync`'s result. */
  rawName: string;
  path: string;
  isDir: boolean;
  declaredSize: number;
  crc: number;
};

const SIG_EOCD = 0x06054b50;
const SIG_ZIP64_LOCATOR = 0x07064b50;
const SIG_CENTRAL = 0x02014b50;
const MAX_U16 = 0xffff;
const MAX_U32 = 0xffffffff;
const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;
const DOS_DIR_ATTR = 0x10;
const FLAG_ENCRYPTED = 0x1;
const FLAG_UTF8 = 0x800;

const u16 = (d: Uint8Array, o: number) => d[o]! | (d[o + 1]! << 8);
const u32 = (d: Uint8Array, o: number) =>
  (d[o]! | (d[o + 1]! << 8) | (d[o + 2]! << 16) | (d[o + 3]! << 24)) >>> 0;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (zip polynomial) — fflate does not verify it, and it silently truncates to the declared size. */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** `\` → `/`, drops `.` and empty segments; keeps a trailing `/` as a directory marker. */
export function normalizeZipPath(name: string): string {
  const slashed = name.replace(/\\/g, '/');
  const leading = slashed.startsWith('/') ? '/' : '';
  const trailing = slashed.endsWith('/') ? '/' : '';
  const parts = slashed.split('/').filter((s) => s !== '' && s !== '.');
  const body = parts.join('/');
  return body === '' ? leading : leading + body + (trailing && body ? trailing : '');
}

/** Reason the (already `\`-normalised) path is unsafe, or null. */
export function unsafePathReason(path: string): string | null {
  if (path.includes('\u0000')) return 'contains a NUL character';
  if (path.startsWith('/')) return 'is an absolute path';
  if (/^[A-Za-z]:/.test(path)) return 'is a drive-letter path';
  if (path.split('/').includes('..')) return 'contains a `..` segment';
  return null;
}

function readCentralDirectory(bytes: Uint8Array): ImportResult<{ entries: CentralEntry[] }> {
  if (bytes.length < 22) return fail('import_bad_archive', 'Not a zip archive: the file is too short.');
  let eocd = -1;
  const stop = Math.max(0, bytes.length - 22 - MAX_U16);
  for (let i = bytes.length - 22; i >= stop; i--) {
    if (u32(bytes, i) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return fail('import_bad_archive', 'Not a zip archive: no end-of-central-directory record.');
  if (eocd >= 20 && u32(bytes, eocd - 20) === SIG_ZIP64_LOCATOR) {
    return fail('import_bad_archive', 'ZIP64 archives are not supported.');
  }

  const count = u16(bytes, eocd + 10);
  const cdOffset = u32(bytes, eocd + 16);
  if (count === MAX_U16 || cdOffset === MAX_U32) {
    return fail('import_bad_archive', 'ZIP64 archives are not supported.');
  }
  if (count > ZIP_MAX_ENTRIES) {
    return fail('import_too_large', `The archive has ${count} entries; the limit is ${ZIP_MAX_ENTRIES}.`, {
      entries: count,
      limit: ZIP_MAX_ENTRIES,
    });
  }

  const entries: CentralEntry[] = [];
  let o = cdOffset;
  for (let i = 0; i < count; i++) {
    if (o + 46 > eocd || u32(bytes, o) !== SIG_CENTRAL) {
      return fail('import_bad_archive', 'Unreadable zip: corrupt central directory.');
    }
    const flags = u16(bytes, o + 8);
    const crc = u32(bytes, o + 16);
    const compressedSize = u32(bytes, o + 20);
    const declaredSize = u32(bytes, o + 24);
    const nameLen = u16(bytes, o + 28);
    const extraLen = u16(bytes, o + 30);
    const commentLen = u16(bytes, o + 32);
    const extAttr = u32(bytes, o + 38);
    const next = o + 46 + nameLen + extraLen + commentLen;
    if (next > eocd) return fail('import_bad_archive', 'Unreadable zip: corrupt central directory.');
    if (compressedSize === MAX_U32 || declaredSize === MAX_U32) {
      return fail('import_bad_archive', 'ZIP64 archives are not supported.');
    }
    if (flags & FLAG_ENCRYPTED) {
      return fail('import_bad_archive', 'Encrypted zip entries are not supported.');
    }

    // Same decoding as fflate (UTF-8 flag → UTF-8, else latin1) so names match its result keys.
    const rawName = strFromU8(bytes.subarray(o + 46, o + 46 + nameLen), !(flags & FLAG_UTF8));
    const path = normalizeZipPath(rawName);
    const unsafe = path === '' ? null : unsafePathReason(path);
    if (unsafe) {
      return fail('import_unsafe_path', `Unsafe entry "${rawName}": it ${unsafe}.`, { path: rawName });
    }
    // Unix mode bits live in the high 16 bits of the external attributes;
    // checked whatever the "made by" host is (DOS hosts leave them 0).
    if (((extAttr >>> 16) & S_IFMT) === S_IFLNK) {
      return fail('import_unsafe_path', `Unsafe entry "${rawName}": symbolic links are not allowed.`, {
        path: rawName,
      });
    }
    const isDir = path === '' || path.endsWith('/') || ((extAttr & DOS_DIR_ATTR) !== 0 && declaredSize === 0);
    entries.push({ rawName, path: path.replace(/\/$/, ''), isDir, declaredSize, crc });
    o = next;
  }
  return { ok: true, entries };
}

/**
 * Reads every file entry of a zip into memory. Directory entries are dropped.
 * Errors: `import_bad_archive`, `import_too_large`, `import_unsafe_path`.
 */
export function readZip(bytes: Uint8Array): ImportResult<{ files: ZipFile[] }> {
  const cd = readCentralDirectory(bytes);
  if (!cd.ok) return cd;

  const fileEntries = cd.entries.filter((e) => !e.isDir);
  const declaredTotal = fileEntries.reduce((sum, e) => sum + e.declaredSize, 0);
  if (declaredTotal > ZIP_MAX_UNCOMPRESSED_BYTES) {
    return tooLarge(declaredTotal);
  }

  const byRawName = new Map<string, CentralEntry>();
  const seenPaths = new Set<string>();
  for (const e of fileEntries) {
    if (byRawName.has(e.rawName) || seenPaths.has(e.path)) {
      return fail('import_bad_archive', `Unreadable zip: duplicate entry "${e.path}".`, { path: e.path });
    }
    byRawName.set(e.rawName, e);
    seenPaths.add(e.path);
  }

  let inflated: Record<string, Uint8Array>;
  let filterTotal = 0;
  let filterOverLimit = false;
  try {
    inflated = unzipSync(bytes, {
      // fflate hands us the central-directory sizes before inflating anything.
      filter: (f) => {
        const entry = byRawName.get(f.name);
        if (!entry) return false; // directory or anything the pre-check did not vet
        filterTotal += f.originalSize;
        if (filterTotal > ZIP_MAX_UNCOMPRESSED_BYTES) filterOverLimit = true;
        return !filterOverLimit;
      },
    });
  } catch (err) {
    return fail('import_bad_archive', `Unreadable zip: ${(err as Error).message}`);
  }
  if (filterOverLimit) return tooLarge(filterTotal);

  const files: ZipFile[] = [];
  let actualTotal = 0;
  for (const e of fileEntries) {
    const data = inflated[e.rawName];
    if (!data) return fail('import_bad_archive', `Unreadable zip: entry "${e.path}" could not be read.`);
    // A header that under-declares the size makes fflate truncate silently; the CRC catches it.
    if (data.length !== e.declaredSize || crc32(data) !== e.crc) {
      return fail('import_bad_archive', `Unreadable zip: entry "${e.path}" is corrupt (size or checksum mismatch).`, {
        path: e.path,
      });
    }
    actualTotal += data.length;
    files.push({ path: e.path, size: data.length, data });
  }
  if (actualTotal > ZIP_MAX_UNCOMPRESSED_BYTES) return tooLarge(actualTotal);
  return { ok: true, files };
}

const tooLarge = (bytes: number) =>
  fail(
    'import_too_large',
    `The archive unpacks to ${bytes} bytes; the limit is ${ZIP_MAX_UNCOMPRESSED_BYTES}.`,
    { uncompressed_bytes: bytes, limit: ZIP_MAX_UNCOMPRESSED_BYTES },
  );
