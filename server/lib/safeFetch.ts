import dns from "dns/promises";
import net from "net";
import { Agent, fetch as undiciFetch } from "undici";

/**
 * SSRF-safe fetch. Only http/https, DNS-resolves every hop and rejects
 * private / loopback / link-local / metadata ranges, follows at most
 * `maxRedirects` redirects (re-validating each hop), and times out.
 *
 * DNS rebinding: the addresses validated by assertSafeUrl are pinned and the
 * TCP connection is made to one of them via a custom undici `connect.lookup`,
 * so a hostname cannot resolve to a public address during validation and a
 * private one at connect time.
 */

export class SafeFetchError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "SafeFetchError";
  }
}

export interface SafeFetchOptions extends Omit<RequestInit, "redirect" | "signal"> {
  /** Max redirect hops (default 5). */
  maxRedirects?: number;
  /** Per-request timeout in ms (default 10000). */
  timeoutMs?: number;
  /** Optional hostname allowlist (exact, case-insensitive). Applied to every hop. */
  allowedHosts?: string[];
  /** "follow" (default) follows redirects; "manual" returns the first response. */
  redirect?: "follow" | "manual";
  /**
   * Max response body size in bytes (default 2 MB). Enforced up front via
   * Content-Length and again while streaming through readLimitedText /
   * readLimitedBuffer; reading more than this aborts the body.
   */
  maxBytes?: number;
}

export const DEFAULT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

function inCidr4(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const BLOCKED_V4 = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10", // CGNAT
  "127.0.0.0/8",
  "169.254.0.0/16", // link-local + cloud metadata
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved + broadcast
];

/** Expand an IPv6 address into 8 16-bit groups. */
function parseV6(ip: string): number[] | null {
  let addr = ip;
  // IPv4-mapped / embedded tail (::ffff:1.2.3.4)
  const v4Tail = addr.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4Tail) {
    const n = ipv4ToInt(v4Tail[1]);
    addr = addr.slice(0, -v4Tail[1].length) + ((n >>> 16) & 0xffff).toString(16) + ":" + (n & 0xffff).toString(16);
  }
  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves[1] ? halves[1].split(":") : [];
  const fill = 8 - head.length - tail.length;
  if (fill < 0 || (halves.length === 1 && fill !== 0)) return null;
  const groups = [...head, ...Array(fill).fill("0"), ...tail].map((g) => parseInt(g || "0", 16));
  if (groups.some((g) => Number.isNaN(g) || g < 0 || g > 0xffff)) return null;
  return groups;
}

export function isBlockedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    return BLOCKED_V4.some((c) => inCidr4(ip, c));
  }
  if (family === 6) {
    const g = parseV6(ip.replace(/%.*$/, ""));
    if (!g) return true;
    const isZero = g.every((x) => x === 0);
    if (isZero) return true; // ::
    if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
    if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    // IPv4-mapped ::ffff:a.b.c.d and IPv4-compatible ::a.b.c.d
    if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) {
      const v4 = `${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`;
      if (g[5] === 0xffff || g[6] !== 0 || g[7] > 1) return isBlockedIp(v4);
    }
    // 64:ff9b::/96 NAT64
    if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
      return isBlockedIp(`${g[6] >> 8}.${g[6] & 0xff}.${g[7] >> 8}.${g[7] & 0xff}`);
    }
    return false;
  }
  return true; // not an IP literal
}

/**
 * Validate a URL: scheme, optional host allowlist, and that every resolved
 * address is public. Returns the parsed URL.
 */
export async function assertSafeUrl(
  input: string | URL,
  opts: { allowedHosts?: string[] } = {},
): Promise<URL> {
  return (await resolveSafeUrl(input, opts)).url;
}

/** Like assertSafeUrl but also returns the validated addresses (for pinning). */
export async function resolveSafeUrl(
  input: string | URL,
  opts: { allowedHosts?: string[] } = {},
): Promise<{ url: URL; addresses: string[] }> {
  let url: URL;
  try {
    url = typeof input === "string" ? new URL(input) : input;
  } catch {
    throw new SafeFetchError("Invalid URL", "invalid_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("Only http and https URLs are allowed", "bad_scheme");
  }
  if (url.username || url.password) {
    throw new SafeFetchError("Credentials in URLs are not allowed", "credentials");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    throw new SafeFetchError("Host not allowed", "blocked_host");
  }
  if (opts.allowedHosts && !opts.allowedHosts.map((h) => h.toLowerCase()).includes(host)) {
    throw new SafeFetchError("Host not in allowlist", "host_not_allowed");
  }

  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new SafeFetchError("Address not allowed", "blocked_ip");
    return { url, addresses: [host] };
  }

  let addresses: string[];
  try {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    addresses = records.map((r) => r.address);
  } catch {
    throw new SafeFetchError("Could not resolve host", "dns_failed");
  }
  if (addresses.length === 0) throw new SafeFetchError("Could not resolve host", "dns_failed");
  if (addresses.some(isBlockedIp)) {
    throw new SafeFetchError("Address not allowed", "blocked_ip");
  }
  return { url, addresses };
}

// ── Pinned-address dispatcher ────────────────────────────────────────────────
// Hostname -> addresses validated by resolveSafeUrl, consulted by the agent's
// lookup instead of the system resolver. Entries are short-lived; a connect for
// a hostname that is not pinned fails closed.

const PIN_TTL_MS = 60_000;
const pinned = new Map<string, { addresses: string[]; expires: number }>();

function pinAddresses(hostname: string, addresses: string[]): void {
  const now = Date.now();
  if (pinned.size > 1000) {
    for (const [k, v] of pinned) if (v.expires < now) pinned.delete(k);
  }
  pinned.set(hostname.toLowerCase(), { addresses, expires: now + PIN_TTL_MS });
}

type LookupCb = (err: NodeJS.ErrnoException | null, address?: any, family?: number) => void;

function pinnedLookup(hostname: string, options: any, callback: LookupCb): void {
  const entry = pinned.get(hostname.toLowerCase());
  if (!entry || entry.expires < Date.now() || entry.addresses.length === 0) {
    const err: NodeJS.ErrnoException = new Error(`Address for ${hostname} was not validated`);
    err.code = "ENOTFOUND";
    return callback(err);
  }
  const wantFamily = Number(options?.family) || 0;
  const records = entry.addresses
    .map((address) => ({ address, family: net.isIP(address) }))
    .filter((r) => r.family !== 0 && (wantFamily === 0 || r.family === wantFamily));
  if (records.length === 0) {
    const err: NodeJS.ErrnoException = new Error(`No ${wantFamily ? `IPv${wantFamily}` : ""} address for ${hostname}`);
    err.code = "ENOTFOUND";
    return callback(err);
  }
  if (options?.all) return callback(null, records);
  return callback(null, records[0].address, records[0].family);
}

let agent: Agent | null = null;
function pinnedAgent(): Agent {
  if (!agent) {
    agent = new Agent({
      connect: { lookup: pinnedLookup as any, timeout: 10_000 },
      connections: 16,
    });
  }
  return agent;
}

// ── Bounded body readers ─────────────────────────────────────────────────────

/**
 * Read a response body up to `maxBytes`; cancels the stream and throws
 * SafeFetchError("too_large") if the limit is exceeded.
 */
export async function readLimitedBuffer(res: Response, maxBytes = DEFAULT_MAX_RESPONSE_BYTES): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await res.body?.cancel().catch(() => undefined);
    throw new SafeFetchError("Response too large", "too_large");
  }
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new SafeFetchError("Response too large", "too_large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

export async function readLimitedText(res: Response, maxBytes = DEFAULT_MAX_RESPONSE_BYTES): Promise<string> {
  return (await readLimitedBuffer(res, maxBytes)).toString("utf8");
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export async function safeFetch(input: string | URL, options: SafeFetchOptions = {}): Promise<Response> {
  const {
    maxRedirects = 5,
    timeoutMs = 10_000,
    allowedHosts,
    redirect = "follow",
    maxBytes = DEFAULT_MAX_RESPONSE_BYTES,
    ...init
  } = options;

  let resolved = await resolveSafeUrl(input, { allowedHosts });
  let current = resolved.url;
  let method = (init.method || "GET").toUpperCase();
  let body = init.body;

  for (let hop = 0; ; hop++) {
    pinAddresses(current.hostname.replace(/^\[|\]$/g, ""), resolved.addresses);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = (await undiciFetch(current, {
        ...(init as any),
        method,
        body,
        redirect: "manual",
        signal: controller.signal,
        dispatcher: pinnedAgent(),
      })) as unknown as Response;
    } catch (err: any) {
      clearTimeout(timer);
      if (err?.name === "AbortError") throw new SafeFetchError("Request timed out", "timeout");
      throw new SafeFetchError("Request failed", "network");
    }
    clearTimeout(timer);

    const location = res.headers.get("location");
    if (redirect === "manual" || !REDIRECT_STATUSES.has(res.status) || !location) {
      const declared = Number(res.headers.get("content-length"));
      if (Number.isFinite(declared) && declared > maxBytes) {
        res.body?.cancel().catch(() => undefined);
        throw new SafeFetchError("Response too large", "too_large");
      }
      return res;
    }
    if (hop >= maxRedirects) {
      throw new SafeFetchError("Too many redirects", "too_many_redirects");
    }
    // Drain the redirect body so the socket can be reused.
    res.body?.cancel().catch(() => undefined);

    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      throw new SafeFetchError("Invalid redirect location", "invalid_url");
    }
    resolved = await resolveSafeUrl(next, { allowedHosts });
    current = resolved.url;
    if (res.status === 303 || ((res.status === 301 || res.status === 302) && method === "POST")) {
      method = "GET";
      body = undefined;
    }
  }
}

/**
 * Follow redirects and return the final URL without downloading the body.
 * Tries HEAD first, then GET on the first hop if HEAD gave no redirect.
 */
export async function resolveFinalUrl(
  input: string,
  opts: { allowedHosts?: string[]; maxRedirects?: number; timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<string> {
  const { allowedHosts, maxRedirects = 5, timeoutMs = 8000, headers = {} } = opts;
  let current = (await assertSafeUrl(input, { allowedHosts })).href;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    let res = await safeFetch(current, { method: "HEAD", redirect: "manual", timeoutMs, headers, allowedHosts });
    let location = res.headers.get("location");
    if (!location && hop === 0) {
      res = await safeFetch(current, { method: "GET", redirect: "manual", timeoutMs, headers, allowedHosts });
      location = res.headers.get("location");
      res.body?.cancel().catch(() => undefined);
    }
    if (!location || !REDIRECT_STATUSES.has(res.status)) return current;
    if (hop === maxRedirects) throw new SafeFetchError("Too many redirects", "too_many_redirects");
    current = (await assertSafeUrl(new URL(location, current), { allowedHosts })).href;
  }
  return current;
}

/** Hosts that Google Maps share links live on or redirect through. */
export const GOOGLE_MAPS_HOSTS = [
  "goo.gl",
  "maps.app.goo.gl",
  "google.com",
  "www.google.com",
  "maps.google.com",
  "g.page",
  "share.google",
];
