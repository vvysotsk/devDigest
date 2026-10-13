import { lookup as dnsLookup } from 'node:dns/promises';
import type { UrlFetchFailure, UrlFetchResult, UrlFetcher } from '../../modules/skills/types.js';
import { hostBlockReason, isPrivateAddress } from '../../modules/skills/import/url.js';

type FetchImpl = (input: string, init: RequestInit) => Promise<Response>;
type Lookup = (hostname: string, opts: { all: true }) => Promise<{ address: string; family: number }[]>;

export interface FetchUrlFetcherOptions {
  /** `globalThis.fetch` by default; tests inject a fake. */
  fetchImpl?: FetchImpl;
  /** `dns.promises.lookup` by default; tests inject a fake. */
  lookup?: Lookup;
  maxRedirects?: number;
}

const ACCEPT = 'text/markdown, text/plain, application/zip, application/octet-stream;q=0.9, */*;q=0.1';
const USER_AGENT = 'devdigest-skill-import';

type FetchFailure = Extract<UrlFetchResult, { ok: false }>;
type BodyResult = { ok: true; bytes: Uint8Array } | FetchFailure;

const failure = (code: UrlFetchFailure, detail?: string): FetchFailure =>
  detail === undefined ? { ok: false, code } : { ok: false, code, detail };

const isAbort = (e: unknown) =>
  e instanceof Error && (e.name === 'AbortError' || e.name === 'TimeoutError');

/**
 * The outbound HTTP adapter of the skill URL import (HW02 D21). Edge rules:
 * https only; the PARSED hostname is checked against the blocked names and
 * literal private addresses, then resolved and every answer checked again
 * (any private → refused) BEFORE the request; redirects are followed by hand
 * (`redirect: 'manual'`), each hop re-checked, https only, at most
 * `maxRedirects`; one `AbortSignal.timeout` covers every hop and the body
 * read; the body is streamed and cut at `maxBytes`; the final hop's raw
 * `Content-Type` travels with the bytes (judged by the service, not here).
 * Known limit: fetch opens
 * its own connection after our lookup (no IP pinning), so a DNS-rebinding
 * host could still reach a private address inside that window.
 */
export class FetchUrlFetcher implements UrlFetcher {
  private fetchImpl: FetchImpl;
  private lookup: Lookup;
  private maxRedirects: number;

  constructor(opts: FetchUrlFetcherOptions = {}) {
    this.fetchImpl = opts.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
    this.lookup = opts.lookup ?? ((hostname, o) => dnsLookup(hostname, o));
    this.maxRedirects = opts.maxRedirects ?? 3;
  }

  async fetch(url: string, limits: { maxBytes: number; timeoutMs: number }): Promise<UrlFetchResult> {
    const signal = AbortSignal.timeout(limits.timeoutMs);
    let current = url;
    for (let hop = 0; hop <= this.maxRedirects; hop++) {
      let parsed: URL;
      try {
        parsed = new URL(current);
      } catch {
        return failure(hop === 0 ? 'not_https' : 'redirect', `invalid URL ${current}`);
      }
      if (parsed.protocol !== 'https:') {
        return failure(hop === 0 ? 'not_https' : 'redirect', `non-https ${parsed.protocol}`);
      }
      const blocked = hostBlockReason(parsed.hostname);
      if (blocked) return failure('blocked_address', blocked);

      let addresses: { address: string }[];
      try {
        addresses = await this.lookup(parsed.hostname, { all: true });
      } catch (e) {
        return failure('network', `dns: ${(e as Error).message}`);
      }
      if (addresses.length === 0) return failure('network', 'dns: no address');
      const privateHit = addresses.find((a) => isPrivateAddress(a.address));
      if (privateHit) return failure('blocked_address', `resolves to ${privateHit.address}`);

      let res: Response;
      try {
        res = await this.fetchImpl(current, {
          redirect: 'manual',
          signal,
          headers: { accept: ACCEPT, 'user-agent': USER_AGENT },
        });
      } catch (e) {
        return isAbort(e) ? failure('timeout') : failure('network', (e as Error).message);
      }

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location');
        if (!location) return failure('redirect', `${res.status} without location`);
        try {
          current = new URL(location, current).toString();
        } catch {
          return failure('redirect', `bad location ${location}`);
        }
        continue;
      }
      if (!res.ok) return failure('bad_status', String(res.status));

      const declared = Number(res.headers.get('content-length') ?? '');
      if (Number.isFinite(declared) && declared > limits.maxBytes) return failure('too_large', `content-length ${declared}`);

      const body = await this.readBody(res, limits.maxBytes);
      if (!body.ok) return body;
      return { ok: true, bytes: body.bytes, finalUrl: current, contentType: res.headers.get('content-type') };
    }
    return failure('redirect', `more than ${this.maxRedirects} redirects`);
  }

  /** Stream the body with a running byte count; cut it at `maxBytes` + 1. */
  private async readBody(res: Response, maxBytes: number): Promise<BodyResult> {
    try {
      if (!res.body) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        return bytes.length > maxBytes ? failure('too_large', `${bytes.length} bytes`) : { ok: true, bytes };
      }
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > maxBytes) {
          await reader.cancel().catch(() => undefined);
          return failure('too_large', `more than ${maxBytes} bytes`);
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) {
        bytes.set(c, offset);
        offset += c.length;
      }
      return { ok: true, bytes };
    } catch (e) {
      return isAbort(e) ? failure('timeout') : failure('network', (e as Error).message);
    }
  }
}
