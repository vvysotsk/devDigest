/**
 * HW02 D21 — the URL import's pure rules (`import/url.ts`) and the HTTP
 * adapter (`adapters/http/url-fetcher.ts`) with a fake fetch and a fake DNS
 * lookup: https only, blocked and private addresses (literal, numeric forms
 * the URL parser normalises, and resolved), redirects by hand, one deadline
 * for the whole chain, the streamed size cap, and the failure mapping.
 */
import { describe, expect, it } from 'vitest';
import { SkillErrorCode } from '@devdigest/shared';
import {
  checkImportUrl,
  fetchFailureMessage,
  hostBlockReason,
  isIpLiteral,
  isPrivateAddress,
  mapFetchFailure,
  sha256Hex,
} from '../src/modules/skills/import/index.js';
import { FetchUrlFetcher } from '../src/adapters/http/url-fetcher.js';
import { MockUrlFetcher } from '../src/adapters/mocks.js';
import type { UrlFetchFailure } from '../src/modules/skills/types.js';

const failure = (res: ReturnType<typeof checkImportUrl>) => {
  if (res.ok) throw new Error('expected a failure');
  return res;
};

describe('checkImportUrl (D21)', () => {
  it('accepts an https raw-file URL, drops the hash and derives the filename', () => {
    const ok = checkImportUrl(' https://raw.githubusercontent.com/acme/skills/main/skills/SKILL.md?x=1#frag ');
    expect(ok).toEqual({
      ok: true,
      url: 'https://raw.githubusercontent.com/acme/skills/main/skills/SKILL.md?x=1',
      filename: 'SKILL.md',
    });
    expect(checkImportUrl('https://example.com/dl/my%20skill.zip')).toMatchObject({ ok: true, filename: 'my skill.zip' });
  });

  it('refuses http, invalid and credentialed URLs', () => {
    expect(failure(checkImportUrl('http://example.com/SKILL.md')).code).toBe('import_url_not_https');
    expect(failure(checkImportUrl('not a url')).code).toBe('import_url_not_https');
    expect(failure(checkImportUrl('ftp://example.com/SKILL.md')).code).toBe('import_url_not_https');
    expect(failure(checkImportUrl('https://user:pw@example.com/SKILL.md')).code).toBe('import_url_blocked');
  });

  it.each([
    'https://localhost/x.md',
    'https://foo.localhost/x.md',
    'https://printer.local/x.md',
    'https://db.internal/x.md',
    'https://10.0.0.1/x.md',
    'https://192.168.1.10/x.md',
    'https://169.254.169.254/latest/meta-data.md',
    'https://[::1]/x.md',
    'https://[::ffff:192.168.1.1]/x.md',
    'https://2130706433/x.md', // 127.0.0.1 as a decimal integer — normalised by the URL parser
    'https://0x7f.0.0.1/x.md', // hex octet form — normalised by the URL parser
    'https://0177.0.0.1/x.md', // octal octet form
  ])('refuses %s as blocked', (url) => {
    expect(failure(checkImportUrl(url)).code).toBe('import_url_blocked');
  });

  it('requires a .md or .zip path', () => {
    expect(failure(checkImportUrl('https://example.com/skills/')).code).toBe('import_unsupported_file');
    expect(failure(checkImportUrl('https://github.com/acme/skills/blob/main/SKILL.md.html')).code).toBe('import_unsupported_file');
    expect(failure(checkImportUrl('https://example.com')).code).toBe('import_unsupported_file');
  });
});

describe('isPrivateAddress / isIpLiteral / hostBlockReason', () => {
  it.each([
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '127.0.0.1',
    '127.255.0.9',
    '169.254.1.1',
    '100.64.0.1',
    '100.127.9.9',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'febf::1',
    'ff02::1',
    '::ffff:10.0.0.1',
    '::ffff:7f00:1',
    '[::1]',
  ])('%s is private', (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each(['93.184.216.34', '172.32.0.1', '172.15.0.1', '100.128.0.1', '2606:4700::1111', '::ffff:93.184.216.34', '2001:db8::1'])(
    '%s is public',
    (ip) => {
      expect(isPrivateAddress(ip)).toBe(false);
    },
  );

  it('non-literals are not private; hostBlockReason names the reason', () => {
    expect(isPrivateAddress('example.com')).toBe(false);
    expect(isIpLiteral('example.com')).toBe(false);
    expect(isIpLiteral('[2606:4700::1111]')).toBe(true);
    expect(hostBlockReason('example.com')).toBeNull();
    expect(hostBlockReason('LOCALHOST.')).toMatch(/blocked host name/);
    expect(hostBlockReason('api.corp.internal')).toMatch(/blocked host name/);
    expect(hostBlockReason('[fe80::1]')).toMatch(/private address/);
    expect(hostBlockReason('')).toBe('empty host');
  });
});

describe('mapFetchFailure / messages / sha256Hex', () => {
  it('maps every port failure to a SkillErrorCode with a message', () => {
    const codes: UrlFetchFailure[] = ['not_https', 'blocked_address', 'redirect', 'timeout', 'too_large', 'bad_status', 'network'];
    expect(codes.map(mapFetchFailure)).toEqual([
      'import_url_not_https',
      'import_url_blocked',
      'import_url_redirect',
      'import_url_timeout',
      'import_too_large',
      'import_url_bad_status',
      'import_url_network',
    ]);
    for (const c of codes) {
      expect(SkillErrorCode.safeParse(mapFetchFailure(c)).success).toBe(true);
      expect(fetchFailureMessage(c).length).toBeGreaterThan(10);
    }
  });

  it('sha256Hex is the hex digest of the bytes', () => {
    expect(sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

// ---- the adapter with a fake fetch + lookup ---------------------------------

type Handler = (init: RequestInit) => Response | Promise<Response>;

function fakeFetch(handlers: Record<string, Handler>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    const h = handlers[url];
    if (!h) throw new Error(`unexpected fetch ${url}`);
    return h(init);
  };
  return { impl, calls };
}

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];
const text = (body: string, init: ResponseInit = {}) => new Response(body, { status: 200, ...init });
const redirectTo = (location: string, status = 302) => () => new Response(null, { status, headers: { location } });
const LIMITS = { maxBytes: 512 * 1024, timeoutMs: 5_000 };

/** A handler that answers after `ms` real milliseconds, or rejects with AbortError when the signal fires first. */
const slow =
  (ms: number, make: () => Response): Handler =>
  (init) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(make()), ms);
      init.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        const e = new Error('aborted');
        e.name = 'AbortError';
        reject(e);
      });
    });

describe('FetchUrlFetcher (D21 adapter, no network)', () => {
  it('fetches a public https URL: bytes, finalUrl, manual redirects, the accept header', async () => {
    const { impl, calls } = fakeFetch({ 'https://example.com/SKILL.md': () => text('# skill') });
    const f = new FetchUrlFetcher({ fetchImpl: impl, lookup: publicLookup });
    const res = await f.fetch('https://example.com/SKILL.md', LIMITS);
    expect(res).toMatchObject({ ok: true, finalUrl: 'https://example.com/SKILL.md' });
    expect(new TextDecoder().decode((res as { bytes: Uint8Array }).bytes)).toBe('# skill');
    expect(calls[0]!.init.redirect).toBe('manual');
    expect((calls[0]!.init.headers as Record<string, string>).accept).toContain('text/markdown');
  });

  it('refuses a private DNS answer before any request, and a blocked literal host', async () => {
    const { impl, calls } = fakeFetch({});
    const f = new FetchUrlFetcher({ fetchImpl: impl, lookup: async () => [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }] });
    expect(await f.fetch('https://evil.example/x.md', LIMITS)).toMatchObject({ ok: false, code: 'blocked_address', detail: 'resolves to 10.0.0.5' });
    expect(await f.fetch('https://[::1]/x.md', LIMITS)).toMatchObject({ ok: false, code: 'blocked_address' });
    expect(await f.fetch('http://example.com/x.md', LIMITS)).toMatchObject({ ok: false, code: 'not_https' });
    expect(calls).toHaveLength(0);
    const nxdomain = new FetchUrlFetcher({ fetchImpl: impl, lookup: async () => { throw new Error('ENOTFOUND'); } });
    expect(await nxdomain.fetch('https://nope.example/x.md', LIMITS)).toMatchObject({ ok: false, code: 'network', detail: 'dns: ENOTFOUND' });
  });

  it('follows an https redirect (re-checking the new host) and refuses a non-https or over-long chain', async () => {
    const lookups: string[] = [];
    const lookup = async (host: string) => {
      lookups.push(host);
      return host === 'private.example' ? [{ address: '192.168.1.1', family: 4 }] : [{ address: '93.184.216.34', family: 4 }];
    };
    const { impl, calls } = fakeFetch({
      'https://a.example/x.md': redirectTo('https://b.example/y.md', 301),
      'https://b.example/y.md': () => text('moved'),
      'https://c.example/x.md': redirectTo('http://c.example/y.md'),
      'https://d.example/x.md': redirectTo('https://private.example/x.md'),
      'https://loop.example/1.md': redirectTo('/2.md'),
      'https://loop.example/2.md': redirectTo('/3.md'),
      'https://loop.example/3.md': redirectTo('/4.md'),
      'https://loop.example/4.md': redirectTo('/5.md'),
      'https://loop.example/5.md': () => text('never reached'),
    });
    const f = new FetchUrlFetcher({ fetchImpl: impl, lookup });

    expect(await f.fetch('https://a.example/x.md', LIMITS)).toMatchObject({ ok: true, finalUrl: 'https://b.example/y.md' });
    expect(lookups).toEqual(['a.example', 'b.example']);
    expect(await f.fetch('https://c.example/x.md', LIMITS)).toMatchObject({ ok: false, code: 'redirect' });
    expect(await f.fetch('https://d.example/x.md', LIMITS)).toMatchObject({ ok: false, code: 'blocked_address' });
    expect(await f.fetch('https://loop.example/1.md', LIMITS)).toMatchObject({ ok: false, code: 'redirect' });
    expect(calls.map((c) => c.url)).not.toContain('https://loop.example/5.md');
  });

  it('maps a non-2xx status and cuts an over-cap body by content-length or by streaming', async () => {
    const endless = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(64 * 1024)); } });
    const { impl } = fakeFetch({
      'https://e.example/missing.md': () => new Response('nope', { status: 404 }),
      'https://e.example/declared.md': () => text('x', { headers: { 'content-length': String(600 * 1024) } }),
      'https://e.example/stream.md': () => new Response(endless, { status: 200 }),
    });
    const f = new FetchUrlFetcher({ fetchImpl: impl, lookup: publicLookup });
    expect(await f.fetch('https://e.example/missing.md', LIMITS)).toMatchObject({ ok: false, code: 'bad_status', detail: '404' });
    expect(await f.fetch('https://e.example/declared.md', LIMITS)).toMatchObject({ ok: false, code: 'too_large' });
    expect(await f.fetch('https://e.example/stream.md', LIMITS)).toMatchObject({ ok: false, code: 'too_large' });
  });

  it('one deadline covers the whole chain: two hops that each fit it but together exceed it → timeout', async () => {
    const { impl, calls } = fakeFetch({
      'https://s.example/1.md': slow(20, () => new Response(null, { status: 302, headers: { location: '/2.md' } })),
      'https://s.example/2.md': slow(20, () => text('late')),
    });
    const f = new FetchUrlFetcher({ fetchImpl: impl, lookup: publicLookup });
    expect(await f.fetch('https://s.example/1.md', { maxBytes: 1024, timeoutMs: 30 })).toEqual({ ok: false, code: 'timeout' });
    expect(calls).toHaveLength(2);
    expect(calls[0]!.init.signal).toBe(calls[1]!.init.signal); // the same AbortSignal on every hop
    // Either hop alone fits the deadline.
    const quick = new FetchUrlFetcher({ fetchImpl: fakeFetch({ 'https://s.example/2.md': slow(20, () => text('ok')) }).impl, lookup: publicLookup });
    expect(await quick.fetch('https://s.example/2.md', { maxBytes: 1024, timeoutMs: 30 })).toMatchObject({ ok: true });
  });

  it('a connection error is `network`', async () => {
    const f = new FetchUrlFetcher({ fetchImpl: async () => { throw new Error('ECONNRESET'); }, lookup: publicLookup });
    expect(await f.fetch('https://x.example/x.md', LIMITS)).toEqual({ ok: false, code: 'network', detail: 'ECONNRESET' });
  });
});

describe('MockUrlFetcher', () => {
  it('returns canned results per URL, shifts through an array, records calls, and fails unknown URLs', async () => {
    const bytes1 = new TextEncoder().encode('one');
    const bytes2 = new TextEncoder().encode('two');
    const m = new MockUrlFetcher({
      'https://x/one.md': { ok: true, bytes: bytes1, finalUrl: 'https://x/one.md' },
      'https://x/changing.md': [
        { ok: true, bytes: bytes1, finalUrl: 'https://x/changing.md' },
        { ok: true, bytes: bytes2, finalUrl: 'https://x/changing.md' },
      ],
    });
    expect(await m.fetch('https://x/one.md', LIMITS)).toMatchObject({ ok: true, bytes: bytes1 });
    expect(await m.fetch('https://x/changing.md', LIMITS)).toMatchObject({ bytes: bytes1 });
    expect(await m.fetch('https://x/changing.md', LIMITS)).toMatchObject({ bytes: bytes2 });
    expect(await m.fetch('https://x/changing.md', LIMITS)).toMatchObject({ bytes: bytes2 });
    expect(await m.fetch('https://x/none.md', LIMITS)).toMatchObject({ ok: false, code: 'network' });
    expect(m.calls.map((c) => c.url)).toHaveLength(5);
  });
});
