import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * The search-engine surface for public job pages.
 *
 * These pages are the product's local-SEO output, and three separate things
 * used to make them invisible: the app-wide `noindex`, no structured data or
 * NAP, and no sitemap. The assertions below are about what a crawler actually
 * receives, because that is the only thing that decides whether the work shows
 * up in search.
 */

const rpc = vi.fn();
const createSignedUrls = vi.fn();

vi.mock("../supabaseClient", () => ({
  getSupabaseClient: () => ({
    rpc,
    storage: { from: () => ({ createSignedUrls }) },
  }),
  createAnonClient: () => null,
}));

import {
  renderPublicJobHtml,
  handleSitemapXml,
  handleRobotsTxt,
  type PublicJobRow,
} from "../routes/publicSeo";

const ORIGIN = "https://app.example.com";
const JOB = "11111111-2222-4333-8444-555555555555";

/** The shape the real index.html gives the injector. */
const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Local SEO Ranker</title>
    <meta name="title" content="Local SEO Ranker" />
    <meta name="description" content="app shell" />
    <meta name="keywords" content="local SEO" />
    <meta name="robots" content="noindex, nofollow" />
    <meta property="og:title" content="Local SEO Ranker" />
    <meta property="twitter:card" content="summary_large_image" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

const ROW: PublicJobRow = {
  id: JOB,
  name: "Tankless water heater install",
  description: "Replaced a 50-gallon tank with a tankless unit.",
  created_at: "2026-09-01T10:00:00.000Z",
  completed_at: "2026-09-02T10:00:00.000Z",
  metadata: { keywords: ["tankless water heater", "water heater install"], service: "Water heater installation" },
  photo_paths: ["project-media/a.jpg", "project-media/b.jpg"],
  business: {
    name: "Acme Plumbing",
    phone: "(216) 296-3191",
    website: "https://acmeplumbing.example",
    street: "3414 Erhart Road",
    city: "Litchfield",
    state: "OH",
    postal: "44253",
    country: "US",
    mapsUrl: "https://maps.google.com/?cid=1",
  },
  indexable: true,
};

/** Pull the single JSON-LD block out of the rendered page. */
/**
 * The JSON-LD graph, as a loose shape. Schema.org nests arbitrarily and the
 * assertions below walk into it, so a precise type here would be a bigger
 * fiction than the loose one.
 */
type JsonLdGraph = Record<string, any>;

function parseJsonLd(html: string): JsonLdGraph {
  const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  expect(match, "a JSON-LD block should be present").toBeTruthy();
  return JSON.parse(match![1]);
}

describe("renderPublicJobHtml", () => {
  it("flips the app-wide noindex to index for a public page", () => {
    const html = renderPublicJobHtml(TEMPLATE, ROW, ORIGIN);
    expect(html).toContain('<meta name="robots" content="index, follow, max-image-preview:large" />');
    expect(html).not.toContain("noindex");
  });

  it("keeps noindex when the job or business has opted out", () => {
    const html = renderPublicJobHtml(TEMPLATE, { ...ROW, indexable: false }, ORIGIN);
    expect(html).toContain('content="noindex, nofollow"');
    expect(html).not.toContain("index, follow");
  });

  it("replaces the shell's title and description rather than adding a second one", () => {
    const html = renderPublicJobHtml(TEMPLATE, ROW, ORIGIN);
    expect(html.match(/<title>/g)).toHaveLength(1);
    expect(html).toContain("Tankless water heater install");
    expect(html).not.toContain("Local SEO Ranker");
    expect(html.match(/<meta name="description"/g)).toHaveLength(1);
    expect(html).not.toContain('content="app shell"');
  });

  it("emits a canonical URL on the configured origin", () => {
    const html = renderPublicJobHtml(TEMPLATE, ROW, ORIGIN);
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/public/job/${JOB}" />`);
  });

  it("carries the business NAP in the crawlable fallback", () => {
    const html = renderPublicJobHtml(TEMPLATE, ROW, ORIGIN);
    expect(html).toContain("<noscript>");
    expect(html).toContain("Acme Plumbing");
    expect(html).toContain("3414 Erhart Road");
    expect(html).toContain("Litchfield, OH");
    expect(html).toContain("44253");
    // The tel: href is digits only, whatever the stored formatting.
    expect(html).toContain('href="tel:+12162963191"');
  });

  it("describes the work as an Article whose provider is a LocalBusiness with an address", () => {
    const graph = parseJsonLd(renderPublicJobHtml(TEMPLATE, ROW, ORIGIN));
    expect(graph["@type"]).toBe("Article");
    expect(graph.headline).toBe("Tankless water heater install");
    expect(graph.url).toBe(`${ORIGIN}/public/job/${JOB}`);
    expect(graph.about["@type"]).toBe("Service");
    expect(graph.about.provider["@type"]).toBe("LocalBusiness");
    expect(graph.about.provider.telephone).toBe("(216) 296-3191");
    expect(graph.about.provider.address).toMatchObject({
      "@type": "PostalAddress",
      streetAddress: "3414 Erhart Road",
      addressLocality: "Litchfield",
      addressRegion: "OH",
      postalCode: "44253",
      addressCountry: "US",
    });
    expect(graph.about.areaServed).toBe("Litchfield, OH");
  });

  it("points images at the stable proxy, never at an expiring signed URL", () => {
    const graph = parseJsonLd(renderPublicJobHtml(TEMPLATE, ROW, ORIGIN));
    // Two photo_paths -> two stable URLs, indexed by position.
    expect(graph.image).toEqual([
      `${ORIGIN}/public/job-photo/${JOB}/0`,
      `${ORIGIN}/public/job-photo/${JOB}/1`,
    ]);
    expect(JSON.stringify(graph)).not.toContain("token=");
  });

  it("falls back to a business-derived description when the job has none", () => {
    const html = renderPublicJobHtml(TEMPLATE, { ...ROW, description: null }, ORIGIN);
    expect(html).toContain("Acme Plumbing completed this project in Litchfield, OH");
  });

  it("renders without a business rather than throwing", () => {
    const html = renderPublicJobHtml(TEMPLATE, { ...ROW, business: null }, ORIGIN);
    expect(html).toContain("Tankless water heater install");
    expect(html).not.toContain("<address>");
    const graph = parseJsonLd(html);
    expect(graph.about.provider["@type"]).toBe("LocalBusiness");
  });

  it("escapes markup in job and business text so the page cannot be broken out of", () => {
    const html = renderPublicJobHtml(
      TEMPLATE,
      {
        ...ROW,
        name: '</title><script>alert(1)</script>',
        description: '"><img onerror=alert(1)>',
      } as any,
      ORIGIN,
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain("<img onerror");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes a </script> sequence inside the JSON-LD block", () => {
    const html = renderPublicJobHtml(
      TEMPLATE,
      { ...ROW, description: 'ends here </script><script>alert(1)</script>' } as any,
      ORIGIN,
    );
    const ldBlock = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)![1];
    // The whole description survives inside the JSON rather than terminating it.
    expect(ldBlock).toContain("\\u003c/script\\u003e");
    expect(() => JSON.parse(ldBlock)).not.toThrow();
  });

  it("truncates an over-long description instead of emitting it whole", () => {
    const html = renderPublicJobHtml(TEMPLATE, { ...ROW, description: "x".repeat(900) }, ORIGIN);
    const desc = /<meta name="description" content="(x+)"/.exec(html);
    expect(desc![1].length).toBe(300);
  });
});

// ── robots.txt / sitemap.xml ────────────────────────────────────────────────

interface MockRes {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  setHeader(k: string, v: string): void;
  status(code: number): MockRes;
  send(body: string): MockRes;
  json(body: unknown): MockRes;
}

function mockRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: "",
    setHeader(k, v) {
      res.headers[k.toLowerCase()] = v;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    send(body) {
      res.body = body;
      return res;
    },
    json(body) {
      res.body = String(body);
      return res;
    },
  };
  return res;
}

/** Express passes a `next`; these handlers terminate, so it is never called. */
const next = () => undefined;
const req = { headers: {}, protocol: "https", get: () => "app.example.com" } as unknown as Parameters<typeof handleRobotsTxt>[0];

describe("GET /robots.txt", () => {
  beforeEach(() => {
    process.env.APP_URL = ORIGIN;
  });

  it("allows the public pages, disallows the app, and advertises the sitemap", () => {
    const res = mockRes();
    handleRobotsTxt(req, res as never, next);
    expect(res.body).toContain("Allow: /public/job/");
    expect(res.body).toContain("Disallow: /admin/");
    expect(res.body).toContain("Disallow: /api/");
    expect(res.body).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });
});

describe("GET /sitemap.xml", () => {
  beforeEach(() => {
    process.env.APP_URL = ORIGIN;
    rpc.mockReset();
  });

  it("lists the public job pages the gated RPC returns", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ id: JOB, updated_at: "2026-09-02T10:00:00.000Z" }],
      error: null,
    });
    const res = mockRes();
    await handleSitemapXml(req, res as never, next);
    expect(rpc).toHaveBeenCalledWith("public_job_sitemap", { p_limit: 5000 });
    expect(res.headers["content-type"]).toContain("application/xml");
    expect(res.body).toContain(`<loc>${ORIGIN}/public/job/${JOB}</loc>`);
    expect(res.body).toContain("<lastmod>2026-09-02</lastmod>");
  });

  it("drops rows whose id is not a uuid rather than emitting a bad URL", async () => {
    rpc.mockResolvedValueOnce({
      data: [{ id: "../../etc/passwd", updated_at: null }, { id: JOB, updated_at: null }],
      error: null,
    });
    const res = mockRes();
    await handleSitemapXml(req, res as never, next);
    expect(res.body).not.toContain("etc/passwd");
    expect(res.body.match(/<loc>/g)).toHaveLength(1);
  });

  it("503s rather than serving an empty sitemap when the RPC fails", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const res = mockRes();
    await handleSitemapXml(req, res as never, next);
    expect(res.statusCode).toBe(503);
  });
});
