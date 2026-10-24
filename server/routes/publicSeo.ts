/**
 * Search-engine surface for the public job pages.
 *
 * The app itself is a private admin SPA and is correctly `noindex` — but the
 * completed-work pages it publishes are the whole local-SEO point of the
 * product, and until now they were invisible to Google three times over: the
 * global `noindex` applied to them, they carried no structured data or NAP, and
 * nothing listed them in a sitemap.
 *
 * This module fixes all three without turning the app into an SSR framework:
 *
 *   GET /robots.txt                       allow the public pages, disallow the app
 *   GET /sitemap.xml                      every indexable public job page
 *   GET /public/job-photo/:jobId/:index   a STABLE image URL (signed URLs expire,
 *                                         so Google can never keep one)
 *   (+ renderPublicJobHtml, used by the SPA fallback to inject real <head> tags
 *      and crawlable <noscript> content into index.html)
 *
 * Everything here reads through the `public_job` / `public_job_sitemap` RPCs, so
 * the publish gate in the database is the single source of truth for what is
 * public. Nothing is served here that those functions do not hand back.
 */
import type { Request, RequestHandler } from "express";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";
import { signMediaValues } from "./publicContent";
import { normalisePhone } from "../lib/phone";

const log = logger.child({ module: "publicSeo" });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public origin, from APP_URL when set, else inferred from the request. */
function originFor(req: Request): string {
  const configured = (process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol || "https";
  const host = (req.headers["x-forwarded-host"] as string)?.split(",")[0] || req.get("host") || "";
  return host ? `${proto}://${host}` : "";
}

/** Escape for use in an HTML text node or a double-quoted attribute. */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Escape for embedding inside a <script type="application/ld+json"> block.
 * JSON.stringify alone is not enough: a `</script>` inside a string value would
 * end the element early, so the angle brackets are escaped as unicode (still
 * valid JSON, and parsers read it identically).
 */
function jsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export interface PublicJobRow {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
  photo_paths?: string[] | null;
  business: Record<string, unknown> | null;
  indexable: boolean | null;
}

/** Fetch one public job through the gated RPC. Null when it is not public. */
async function loadPublicJob(id: string): Promise<PublicJobRow | null> {
  const { data, error } = await getSupabaseClient().rpc("public_job", { p_id: id });
  if (error) {
    log.warn({ err: error.message }, "public_job rpc failed");
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return row ? (row as PublicJobRow) : null;
}

function strField(business: Record<string, unknown> | null, key: string): string {
  const v = business?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

/** One-line "City, ST" for titles, or "" when the business has no locality. */
function localityLine(business: Record<string, unknown> | null): string {
  const city = strField(business, "city");
  const state = strField(business, "state");
  if (city && state) return `${city}, ${state}`;
  return city || state;
}

/**
 * Build the <head> tags and crawlable fallback body for a public job page, and
 * splice them into the built index.html.
 *
 * The SPA still renders the real page for humans. This exists so that what a
 * crawler sees before (or without) running JavaScript is a titled page with a
 * description, a canonical URL, LocalBusiness/Service structured data and the
 * business's name, address and phone as text.
 */
export function renderPublicJobHtml(template: string, row: PublicJobRow, origin: string): string {
  const business = row.business ?? null;
  const businessName = strField(business, "name");
  const where = localityLine(business);
  const canonical = `${origin}/public/job/${row.id}`;

  const title = [row.name, where && `${where}`, businessName].filter(Boolean).join(" | ").slice(0, 180);

  const rawDescription = (row.description || "").replace(/\s+/g, " ").trim();
  const description = (
    rawDescription ||
    [businessName && `${businessName} completed this project`, where && `in ${where}`].filter(Boolean).join(" ") ||
    row.name
  ).slice(0, 300);

  const completed = row.completed_at || row.created_at || null;
  const keywords = Array.isArray(row.metadata?.keywords)
    ? (row.metadata!.keywords as unknown[]).filter((k): k is string => typeof k === "string").slice(0, 15)
    : [];

  const street = strField(business, "street");
  const city = strField(business, "city");
  const state = strField(business, "state");
  const postal = strField(business, "postal");
  const country = strField(business, "country") || "US";
  const phone = strField(business, "phone");
  const website = strField(business, "website");
  const logoUrl = strField(business, "logoUrl");
  const mapsUrl = strField(business, "mapsUrl");

  // Stable, non-expiring image URLs — a signed URL is useless to a crawler.
  const photoCount = Array.isArray(row.photo_paths) ? row.photo_paths.length : 0;
  const images = Array.from({ length: Math.min(photoCount, 10) }, (_, i) => `${origin}/public/job-photo/${row.id}/${i}`);

  const localBusiness: Record<string, unknown> = { "@type": "LocalBusiness", name: businessName || "Local business" };
  if (phone) localBusiness.telephone = phone;
  if (website) localBusiness.url = website;
  if (logoUrl) localBusiness.image = logoUrl;
  if (mapsUrl) localBusiness.hasMap = mapsUrl;
  if (street || city || state || postal) {
    localBusiness.address = {
      "@type": "PostalAddress",
      ...(street ? { streetAddress: street } : {}),
      ...(city ? { addressLocality: city } : {}),
      ...(state ? { addressRegion: state } : {}),
      ...(postal ? { postalCode: postal } : {}),
      addressCountry: country,
    };
  }

  const serviceName = typeof row.metadata?.service === "string" ? (row.metadata!.service as string) : "";

  const graph: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: row.name,
    description,
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    url: canonical,
    ...(completed ? { datePublished: completed, dateModified: completed } : {}),
    ...(images.length ? { image: images } : {}),
    ...(keywords.length ? { keywords: keywords.join(", ") } : {}),
    ...(businessName
      ? {
          author: { "@type": "Organization", name: businessName },
          publisher: { "@type": "Organization", name: businessName, ...(logoUrl ? { logo: logoUrl } : {}) },
        }
      : {}),
    about: serviceName
      ? { "@type": "Service", name: serviceName, provider: localBusiness, ...(where ? { areaServed: where } : {}) }
      : localBusiness,
  };

  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    keywords.length ? `<meta name="keywords" content="${esc(keywords.join(", "))}" />` : "",
    `<meta property="og:type" content="article" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    images.length ? `<meta property="og:image" content="${esc(images[0])}" />` : "",
    `<meta property="twitter:card" content="summary_large_image" />`,
    `<meta property="twitter:title" content="${esc(title)}" />`,
    `<meta property="twitter:description" content="${esc(description)}" />`,
    images.length ? `<meta property="twitter:image" content="${esc(images[0])}" />` : "",
    `<script type="application/ld+json">${jsonLd(graph)}</script>`,
  ]
    .filter(Boolean)
    .join("\n    ");

  // Name, address, phone as plain text. Rendered inside <noscript> so it never
  // competes with the React tree for sighted users, but is present in the HTML
  // that a crawler fetches.
  const napLines = [
    businessName && `<strong>${esc(businessName)}</strong>`,
    [street, city && state ? `${city}, ${state}` : city || state, postal].filter(Boolean).join(", "),
    // The displayed number stays as the business wrote it; the href is E.164,
    // because a tel: link without a country code dials unreliably.
    phone && `<a href="tel:${esc(normalisePhone(phone))}">${esc(phone)}</a>`,
    website && `<a href="${esc(website)}">${esc(website)}</a>`,
  ].filter(Boolean);

  const fallbackBody = `
    <noscript>
      <article>
        <h1>${esc(row.name)}</h1>
        ${completed ? `<p>Completed ${esc(new Date(completed).toISOString().slice(0, 10))}</p>` : ""}
        ${description ? `<p>${esc(description)}</p>` : ""}
        ${keywords.length ? `<ul>${keywords.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}
        ${napLines.length ? `<address>${napLines.join("<br />")}</address>` : ""}
        ${mapsUrl ? `<p><a href="${esc(mapsUrl)}">Find us on Google Maps</a></p>` : ""}
      </article>
    </noscript>`;

  let html = template;

  // The app-wide robots tag is right for the admin SPA and wrong here.
  html = html.replace(
    /<meta\s+name="robots"[^>]*>/i,
    row.indexable === false
      ? '<meta name="robots" content="noindex, nofollow" />'
      : '<meta name="robots" content="index, follow, max-image-preview:large" />',
  );

  // Replace the SPA's own title/description rather than adding a second one.
  html = html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, "")
    .replace(/<meta\s+name="title"[^>]*>\s*/i, "")
    .replace(/<meta\s+name="description"[^>]*>\s*/i, "")
    .replace(/<meta\s+name="keywords"[^>]*>\s*/i, "")
    .replace(/<meta\s+property="og:(?:type|url|title|description|image)"[^>]*>\s*/gi, "")
    .replace(/<meta\s+property="twitter:(?:card|url|title|description|image)"[^>]*>\s*/gi, "");

  html = html.replace("</head>", `  ${head}\n  </head>`);
  html = html.replace('<div id="root"></div>', `<div id="root"></div>${fallbackBody}`);
  return html;
}

/**
 * Express handler for GET /public/job/:id — serves index.html with the SEO head
 * spliced in. Falls through to `next()` (the plain SPA fallback) for any id that
 * is not a public job, so a private or missing job behaves exactly as before.
 */
export function makePublicJobPageHandler(readTemplate: () => Promise<string>): RequestHandler {
  return async (req, res, next) => {
    const id = String(req.params.id || "");
    if (!UUID_RE.test(id)) return next();
    try {
      const row = await loadPublicJob(id);
      if (!row) return next();
      const template = await readTemplate();
      const html = renderPublicJobHtml(template, row, originFor(req));
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      // Short shared cache: crawlers and repeat visitors get a cached page, and
      // an edit shows up within the minute.
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
      return res.send(html);
    } catch (err) {
      log.warn({ err }, "public job page render failed; serving the plain SPA");
      return next();
    }
  };
}

/**
 * GET /public/job-photo/:jobId/:index
 *
 * A stable URL for a public job photo. The media bucket is private, so the
 * bytes are only reachable through a short-lived signed URL — which is exactly
 * what a search engine cannot store. This resolves the index through the same
 * gated RPC and redirects to a freshly signed URL each time.
 */
export const handlePublicJobPhoto: RequestHandler = async (req, res) => {
  const jobId = String(req.params.jobId || "");
  const index = Number(req.params.index);
  if (!UUID_RE.test(jobId) || !Number.isInteger(index) || index < 0 || index > 99) {
    return res.status(404).json({ error: "Not found" });
  }
  const row = await loadPublicJob(jobId);
  const paths = Array.isArray(row?.photo_paths) ? row!.photo_paths! : [];
  const target = paths[index];
  if (!row || !target) return res.status(404).json({ error: "Not found" });

  const [signed] = await signMediaValues([target]);
  if (!signed) return res.status(404).json({ error: "Not found" });

  // 302, not 301: the signed destination changes every time, only this URL is
  // permanent. The caching header is what lets a crawler reuse the image.
  res.setHeader("Cache-Control", "public, max-age=3600");
  return res.redirect(302, signed);
};

/** GET /robots.txt — open the public pages, keep the app itself out. */
export const handleRobotsTxt: RequestHandler = (req, res) => {
  const origin = originFor(req);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(
    [
      "User-agent: *",
      "Allow: /public/job/",
      "Allow: /public/job-photo/",
      "Disallow: /admin/",
      "Disallow: /api/",
      "Disallow: /g/",
      "Disallow: /login",
      "Disallow: /onboarding",
      "Disallow: /settings",
      "Disallow: /",
      "",
      ...(origin ? [`Sitemap: ${origin}/sitemap.xml`, ""] : []),
    ].join("\n"),
  );
};

/** GET /sitemap.xml — every public job page, newest first. */
export const handleSitemapXml: RequestHandler = async (req, res) => {
  const origin = originFor(req);
  if (!origin) return res.status(503).json({ error: "Sitemap unavailable" });

  let rows: Array<{ id: string; updated_at: string | null }> = [];
  try {
    const { data, error } = await getSupabaseClient().rpc("public_job_sitemap", { p_limit: 5000 });
    if (error) throw new Error(error.message);
    rows = Array.isArray(data) ? data : [];
  } catch (err) {
    log.error({ err }, "public_job_sitemap rpc failed");
    return res.status(503).json({ error: "Sitemap unavailable" });
  }

  const urls = rows
    .filter((r) => UUID_RE.test(String(r?.id || "")))
    .map((r) => {
      const lastmod = r.updated_at ? new Date(r.updated_at).toISOString().slice(0, 10) : "";
      return [
        "  <url>",
        `    <loc>${esc(`${origin}/public/job/${r.id}`)}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : "",
        "    <changefreq>monthly</changefreq>",
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n");
    });

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=1800");
  res.send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`,
  );
};

export const __testables = { esc, jsonLd, localityLine, originFor };
