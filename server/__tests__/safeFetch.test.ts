import { describe, it, expect, vi } from "vitest";
import { assertSafeUrl, isBlockedIp, SafeFetchError } from "../lib/safeFetch";

describe("isBlockedIp", () => {
  it.each([
    "127.0.0.1", "127.255.255.255", "10.0.0.1", "10.255.255.255", "172.16.0.1", "172.31.255.255",
    "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "::", "fc00::1", "fd12::1",
    "fe80::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:169.254.169.254",
  ])("blocks %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "172.15.0.1", "2001:4860:4860::8888", "::ffff:8.8.8.8"])(
    "allows %s",
    (ip) => {
      expect(isBlockedIp(ip)).toBe(false);
    },
  );
});

describe("assertSafeUrl", () => {
  it("rejects non-http schemes", async () => {
    await expect(assertSafeUrl("file:///etc/passwd")).rejects.toBeInstanceOf(SafeFetchError);
    await expect(assertSafeUrl("ftp://example.com")).rejects.toBeInstanceOf(SafeFetchError);
    await expect(assertSafeUrl("gopher://example.com")).rejects.toBeInstanceOf(SafeFetchError);
  });

  it("rejects private IP literals and localhost", async () => {
    for (const u of ["http://127.0.0.1/", "http://10.1.2.3/", "http://169.254.169.254/latest/meta-data", "http://[::1]/", "http://localhost/", "http://0.0.0.0/"]) {
      await expect(assertSafeUrl(u), u).rejects.toMatchObject({ code: expect.stringMatching(/blocked/) });
    }
  });

  it("rejects hosts that resolve to private addresses", async () => {
    const dns = await import("dns/promises");
    vi.spyOn(dns.default, "lookup").mockResolvedValue([{ address: "10.0.0.5", family: 4 }] as any);
    await expect(assertSafeUrl("http://internal.example.test/")).rejects.toMatchObject({ code: "blocked_ip" });
  });

  it("allows hosts that resolve to public addresses", async () => {
    const dns = await import("dns/promises");
    vi.spyOn(dns.default, "lookup").mockResolvedValue([{ address: "93.184.216.34", family: 4 }] as any);
    const url = await assertSafeUrl("https://example.com/path");
    expect(url.hostname).toBe("example.com");
  });

  it("enforces the host allowlist", async () => {
    await expect(assertSafeUrl("https://evil.com/x", { allowedHosts: ["maps.app.goo.gl"] })).rejects.toMatchObject({
      code: "host_not_allowed",
    });
  });

  it("rejects credentials in URLs", async () => {
    await expect(assertSafeUrl("https://user:pw@example.com/")).rejects.toMatchObject({ code: "credentials" });
  });
});
