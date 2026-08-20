import dns from "dns/promises";
import net from "net";

/**
 * SSRF-safe fetch. Only http/https, DNS-resolves every hop and rejects
 * private / loopback / link-local / metadata ranges, follows at most
 * `maxRedirects` redirects (re-validating each hop), and times out.
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
}

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
    return url;
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
  return url;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export async function safeFetch(input: string | URL, options: SafeFetchOptions = {}): Promise<Response> {
  const {
    maxRedirects = 5,
    timeoutMs = 10_000,
    allowedHosts,
    redirect = "follow",
    ...init
  } = options;

  let current = await assertSafeUrl(input, { allowedHosts });
  let method = (init.method || "GET").toUpperCase();
  let body = init.body;

  for (let hop = 0; ; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res: Response;
    try {
      res = await fetch(current, { ...init, method, body, redirect: "manual", signal: controller.signal });
    } catch (err: any) {
      clearTimeout(timer);
      if (err?.name === "AbortError") throw new SafeFetchError("Request timed out", "timeout");
      throw new SafeFetchError("Request failed", "network");
    }
    clearTimeout(timer);

    const location = res.headers.get("location");
    if (redirect === "manual" || !REDIRECT_STATUSES.has(res.status) || !location) {
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
    current = await assertSafeUrl(next, { allowedHosts });
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
