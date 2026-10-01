/**
 * URL import (HW02 D21) — the pure rules the service and the HTTP adapter
 * share: which URLs may be fetched at all, which addresses are never
 * reached, the filename the pipeline parses by, the hash the save compares,
 * and the port-failure → SkillErrorCode mapping. No I/O here; the fetch
 * itself is `src/adapters/http/url-fetcher.ts`.
 */
import { createHash } from 'node:crypto';
import type { SkillErrorCode } from '@devdigest/shared';
import type { UrlFetchFailure } from '../types.js';
import { lastSegment } from './name.js';
import { fail, type ImportResult } from './types.js';

/** One deadline for the whole fetch: every redirect hop plus the body read. */
export const IMPORT_URL_TIMEOUT_MS = 10_000;
/** Redirect hops followed (https → https only). */
export const IMPORT_URL_MAX_REDIRECTS = 3;

const BLOCKED_HOSTS = new Set(['localhost']);
const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal'];

function ipv4Octets(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? nums : null;
}

function isPrivateIpv4(o: number[]): boolean {
  const [a, b] = o as [number, number, number, number];
  return (
    a === 0 || // 0.0.0.0/8 — "this network"
    a === 10 || // 10/8
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64/10 CGNAT
    (a === 169 && b === 254) || // link-local
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12
    (a === 192 && b === 168) || // 192.168/16
    a >= 224 // multicast 224/4 and reserved 240/4
  );
}

/** Expand an IPv6 literal to 8 hextets; null when it is not one. */
function ipv6Groups(ip: string): number[] | null {
  let s = ip.toLowerCase();
  // IPv4-mapped / embedded dotted quad at the end → two hextets.
  const dotted = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s);
  if (dotted) {
    const o = ipv4Octets(dotted[1]!);
    if (!o) return null;
    s = s.slice(0, -dotted[1]!.length) + ((o[0]! << 8) | o[1]!).toString(16) + ':' + ((o[2]! << 8) | o[3]!).toString(16);
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const toGroups = (part: string) => (part === '' ? [] : part.split(':').map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN)));
  const head = toGroups(halves[0]!);
  const tail = halves.length === 2 ? toGroups(halves[1]!) : [];
  if ([...head, ...tail].some((g) => Number.isNaN(g))) return null;
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  return [...head, ...new Array(missing).fill(0), ...tail];
}

/**
 * True for an address that must never be fetched: IPv4 loopback, private
 * (10/8, 172.16/12, 192.168/16), link-local, CGNAT, "this network", multicast
 * and reserved; IPv6 unspecified, loopback, unique-local (fc00::/7),
 * link-local (fe80::/10), multicast (ff00::/8); an IPv4-mapped IPv6 address
 * by the IPv4 rules. Anything that is not an IP literal → false.
 */
export function isPrivateAddress(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, '');
  const v4 = ipv4Octets(bare);
  if (v4) return isPrivateIpv4(v4);
  const v6 = ipv6Groups(bare);
  if (!v6) return false;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = v6 as [number, number, number, number, number, number, number, number];
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0) {
    if (g5 === 0 && g6 === 0 && (g7 === 0 || g7 === 1)) return true; // :: and ::1
    if (g5 === 0xffff) return isPrivateIpv4([g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff]); // ::ffff:a.b.c.d
  }
  if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10
  if ((g0 & 0xff00) === 0xff00) return true; // ff00::/8
  return false;
}

/** True when the hostname is an IP literal (the URL parser already normalised numeric forms). */
export function isIpLiteral(hostname: string): boolean {
  const bare = hostname.replace(/^\[|\]$/g, '');
  return ipv4Octets(bare) !== null || ipv6Groups(bare) !== null;
}

/**
 * Why a PARSED hostname may not be fetched, or null. Runs on `new URL(…).hostname`,
 * so `2130706433`, `0x7f.0.0.1` and `[::1]` arrive normalised as loopback literals.
 */
export function hostBlockReason(hostname: string): string | null {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (h === '') return 'empty host';
  const bare = h.replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTS.has(bare) || BLOCKED_SUFFIXES.some((s) => bare.endsWith(s))) return `blocked host name ${bare}`;
  if (isIpLiteral(bare) && isPrivateAddress(bare)) return `private address ${bare}`;
  return null;
}

/**
 * The URL a user typed → the URL to fetch and the filename the pipeline
 * parses by (D21): https only, no credentials, no blocked host, hash dropped,
 * and the last path segment must end in `.md` or `.zip` (a raw-file URL; an
 * HTML page is not a skill).
 */
export function checkImportUrl(raw: string): ImportResult<{ url: string; filename: string }> {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return fail('import_url_not_https', 'Enter an https:// URL.', { url: raw });
  }
  if (u.protocol !== 'https:') return fail('import_url_not_https', 'Only https:// URLs can be imported.', { url: raw });
  if (u.username !== '' || u.password !== '') {
    return fail('import_url_blocked', 'URLs with credentials are not fetched.', { url: raw });
  }
  const reason = hostBlockReason(u.hostname);
  if (reason) return fail('import_url_blocked', `This address is not fetched (${reason}).`, { url: raw });
  u.hash = '';
  let filename: string;
  try {
    filename = decodeURIComponent(lastSegment(u.pathname));
  } catch {
    filename = lastSegment(u.pathname);
  }
  if (!/\.(md|zip)$/i.test(filename)) {
    return fail('import_unsupported_file', 'The URL must point to a .md or .zip file.', { url: u.toString(), filename });
  }
  return { ok: true, url: u.toString(), filename };
}

/** Hex SHA-256 of the fetched bytes — the preview returns it, the save compares it (TOCTOU). */
export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

const FAILURE_CODE: Record<UrlFetchFailure, SkillErrorCode> = {
  not_https: 'import_url_not_https',
  blocked_address: 'import_url_blocked',
  redirect: 'import_url_redirect',
  timeout: 'import_url_timeout',
  too_large: 'import_too_large',
  bad_status: 'import_url_bad_status',
  network: 'import_url_network',
};

const FAILURE_MESSAGE: Record<UrlFetchFailure, string> = {
  not_https: 'Only https:// URLs can be imported.',
  blocked_address: 'This address is not fetched (private, loopback or blocked host).',
  redirect: 'The URL redirects to a non-https address or too many times.',
  timeout: 'Fetching the URL took too long.',
  too_large: 'The file is too large (max 512 KB).',
  bad_status: 'The server did not return the file.',
  network: 'The URL could not be fetched.',
};

export function mapFetchFailure(code: UrlFetchFailure): SkillErrorCode {
  return FAILURE_CODE[code];
}

export function fetchFailureMessage(code: UrlFetchFailure): string {
  return FAILURE_MESSAGE[code];
}
