/**
 * Google Business Profile API — /api/gbp/*. All routes require auth and a
 * per-business access check. Reads are gated by canAccessBusiness; mutations
 * (review replies, post creation, sync) require canWriteBusiness and are
 * rate-limited.
 *
 *   GET  /api/gbp/:businessId/status                    connection + approval probe
 *   GET  /api/gbp/:businessId/reviews                   live reviews
 *   POST /api/gbp/:businessId/reviews/:reviewId/reply   reply to a review (write)
 *   GET  /api/gbp/:businessId/posts                     local posts
 *   POST /api/gbp/:businessId/posts                     create a local post (write)
 *   GET  /api/gbp/:businessId/questions                 Q&A
 *   GET  /api/gbp/:businessId/insights                  performance summary
 *   POST /api/gbp/:businessId/sync                      pull + upsert into app tables (write)
 *
 * HONEST APPROVAL GATE: when Google returns 403 (Business Profile API not
 * approved for the Cloud project) we surface `approved:false` with Google's own
 * message and NEVER fabricate data.
 */
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";
import { requireAuth, canAccessBusiness, canWriteBusiness } from "../middleware/requireAuth";
import {
  GbpNotConnectedError,
  GbpNotApprovedError,
  GbpError,
  getTokensForBusiness,
  getLocation,
  listReviews,
  replyToReview,
  listLocalPosts,
  createLocalPost,
  listQuestions,
  getInsights,
  type GbpReview,
  type GbpQuestion,
  type GbpInsights,
} from "../lib/gbp";

const log = logger.child({ module: "gbp" });
const reqLog = (req: Request) => (req.log ?? log).child({ module: "gbp" });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 60 mutations / hour / user (replies, posts, syncs). */
const writeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip || "anonymous",
  validate: { keyGeneratorIpFallback: false },
  message: { error: "Too many Google Business Profile actions, please try again later" },
});

// ── Error mapping ────────────────────────────────────────────────────────────

/** Translate a thrown GBP error into an HTTP response. Returns true if handled. */
function sendGbpError(req: Request, res: Response, err: unknown): boolean {
  if (err instanceof GbpNotConnectedError) {
    res.status(409).json({ error: err.message, connected: false });
    return true;
  }
  if (err instanceof GbpNotApprovedError) {
    res.status(403).json({ error: err.message, approved: false });
    return true;
  }
  if (err instanceof GbpError) {
    res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json({ error: err.message });
    return true;
  }
  return false;
}

function guardBusiness(req: Request, res: Response, write = false): string | null {
  const businessId = req.params.businessId;
  if (!UUID_RE.test(businessId || "")) {
    res.status(400).json({ error: "Invalid business id" });
    return null;
  }
  const ok = write ? canWriteBusiness(req, businessId) : canAccessBusiness(req, businessId);
  if (!ok) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return businessId;
}

async function writeAudit(
  req: Request,
  businessId: string,
  action: "create" | "update",
  resourceType: string,
  details: Record<string, unknown>,
): Promise<void> {
  try {
    const db = getSupabaseClient();
    const { error } = await db.from("audit_logs").insert({
      user_id: req.user?.id ?? null,
      business_id: businessId,
      action,
      resource_type: resourceType,
      resource_id: null,
      details: { actor_email: req.profile?.email ?? req.user?.email ?? null, ...details },
      ip_address: req.ip ?? null,
      user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 500) : null,
    });
    if (error) reqLog(req).warn({ err: error.message }, "audit_logs insert failed");
  } catch (err) {
    reqLog(req).warn({ err }, "audit_logs insert threw");
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleStatus(req: Request, res: Response) {
  const businessId = guardBusiness(req, res);
  if (!businessId) return;
  try {
    const tokens = await getTokensForBusiness(businessId);
    if (!tokens) {
      return res.json({ connected: false });
    }
    // Cheap probe: read the location. A 403 means connected-but-not-approved.
    try {
      const loc = await getLocation(businessId);
      return res.json({
        connected: true,
        email: tokens.email,
        locationName: loc?.title || loc?.name || null,
        approved: true,
      });
    } catch (err) {
      if (err instanceof GbpNotApprovedError) {
        return res.json({
          connected: true,
          email: tokens.email,
          approved: false,
          message: err.message,
        });
      }
      throw err;
    }
  } catch (err) {
    if (sendGbpError(req, res, err)) return;
    reqLog(req).error({ err }, "gbp status failed");
    res.status(502).json({ error: "Could not check Google Business Profile status." });
  }
}

async function handleReviews(req: Request, res: Response) {
  const businessId = guardBusiness(req, res);
  if (!businessId) return;
  try {
    const reviews = await listReviews(businessId);
    res.json({ reviews });
  } catch (err) {
    if (sendGbpError(req, res, err)) return;
    reqLog(req).error({ err }, "gbp reviews failed");
    res.status(502).json({ error: "Could not load reviews." });
  }
}

async function handleReply(req: Request, res: Response) {
  const businessId = guardBusiness(req, res, true);
  if (!businessId) return;
  const reviewId = req.params.reviewId;
  const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
  if (!reviewId) return res.status(400).json({ error: "Missing review id" });
  if (!comment) return res.status(400).json({ error: "A reply comment is required" });
  if (comment.length > 4096) return res.status(400).json({ error: "Reply is too long" });
  try {
    const result = await replyToReview(businessId, reviewId, comment);
    await writeAudit(req, businessId, "update", "gbp_review_reply", { reviewId });
    res.json({ success: true, reply: result });
  } catch (err) {
    if (sendGbpError(req, res, err)) return;
    reqLog(req).error({ err }, "gbp reply failed");
    res.status(502).json({ error: "Could not post the reply." });
  }
}

async function handlePosts(req: Request, res: Response) {
  const businessId = guardBusiness(req, res);
  if (!businessId) return;
  try {
    const posts = await listLocalPosts(businessId);
    res.json({ posts });
  } catch (err) {
    if (sendGbpError(req, res, err)) return;
    reqLog(req).error({ err }, "gbp posts failed");
    res.status(502).json({ error: "Could not load posts." });
  }
}

async function handleCreatePost(req: Request, res: Response) {
  const businessId = guardBusiness(req, res, true);
  if (!businessId) return;
  const summary = typeof req.body?.summary === "string" ? req.body.summary.trim() : "";
  if (!summary) return res.status(400).json({ error: "Post summary is required" });
  if (summary.length > 1500) return res.status(400).json({ error: "Post summary is too long" });
  const topicType = typeof req.body?.topicType === "string" ? req.body.topicType : undefined;
  const callToAction =
    req.body?.callToAction && typeof req.body.callToAction === "object"
      ? {
          actionType: String(req.body.callToAction.actionType || "LEARN_MORE"),
          url: req.body.callToAction.url ? String(req.body.callToAction.url) : undefined,
        }
      : undefined;
  try {
    const post = await createLocalPost(businessId, { summary, topicType, callToAction });
    await writeAudit(req, businessId, "create", "gbp_local_post", { topicType: topicType || "STANDARD" });
    res.json({ success: true, post });
  } catch (err) {
    if (sendGbpError(req, res, err)) return;
    reqLog(req).error({ err }, "gbp create post failed");
    res.status(502).json({ error: "Could not create the post." });
  }
}

async function handleQuestions(req: Request, res: Response) {
  const businessId = guardBusiness(req, res);
  if (!businessId) return;
  try {
    const questions = await listQuestions(businessId);
    res.json({ questions });
  } catch (err) {
    if (sendGbpError(req, res, err)) return;
    reqLog(req).error({ err }, "gbp questions failed");
    res.status(502).json({ error: "Could not load questions." });
  }
}

async function handleInsights(req: Request, res: Response) {
  const businessId = guardBusiness(req, res);
  if (!businessId) return;
  try {
    const insights = await getInsights(businessId);
    res.json({ insights });
  } catch (err) {
    if (sendGbpError(req, res, err)) return;
    reqLog(req).error({ err }, "gbp insights failed");
    res.status(502).json({ error: "Could not load insights." });
  }
}

// ── Sync: pull live data and upsert into the app tables ──────────────────────

const DAY_NAMES: Record<string, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
};

/** Google TimeOfDay {hours,minutes} → "HH:MM". */
function fmtTime(t: any): string {
  const h = Number(t?.hours || 0);
  const m = Number(t?.minutes || 0);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addressFromLocation(loc: any): string | null {
  const a = loc?.storefrontAddress;
  if (!a) return null;
  return [
    Array.isArray(a.addressLines) ? a.addressLines.join(", ") : null,
    a.locality,
    a.administrativeArea,
    a.postalCode,
  ]
    .filter(Boolean)
    .join(", ") || null;
}

/** Compute a 0-100 completeness score from what we fetched. */
function completenessScore(opts: {
  hasPhone: boolean;
  hasWebsite: boolean;
  hasHours: boolean;
  hasDescription: boolean;
  hasCategories: boolean;
  reviewCount: number;
  hasRecentPost: boolean;
  respondsToReviews: boolean;
}): number {
  let score = 0;
  if (opts.hasPhone) score += 15;
  if (opts.hasWebsite) score += 15;
  if (opts.hasHours) score += 15;
  if (opts.hasDescription) score += 10;
  if (opts.hasCategories) score += 10;
  if (opts.reviewCount > 0) score += 10;
  if (opts.reviewCount >= 20) score += 5;
  if (opts.hasRecentPost) score += 10;
  if (opts.respondsToReviews) score += 10;
  return Math.min(100, score);
}

async function handleSync(req: Request, res: Response) {
  const businessId = guardBusiness(req, res, true);
  if (!businessId) return;

  const db = getSupabaseClient();

  // Not connected at all → 409.
  let tokens;
  try {
    tokens = await getTokensForBusiness(businessId);
  } catch (err) {
    if (sendGbpError(req, res, err)) return;
    reqLog(req).error({ err }, "gbp sync token load failed");
    return res.status(502).json({ error: "Could not load the Google connection." });
  }
  if (!tokens) {
    return res
      .status(409)
      .json({ error: "Not connected — connect Google Business Profile in Settings.", connected: false });
  }

  // Business Information (location + hours) — this uses the Business
  // Information API, which is generally available; if it 403s the whole
  // connection is unapproved and we report that.
  let location: any;
  try {
    location = await getLocation(businessId);
  } catch (err) {
    if (err instanceof GbpNotApprovedError) {
      return res.status(200).json({
        locationSynced: false,
        reviews: 0,
        questions: 0,
        insights: null,
        approved: false,
        message: err.message,
      });
    }
    if (sendGbpError(req, res, err)) return;
    reqLog(req).error({ err }, "gbp sync getLocation failed");
    return res.status(502).json({ error: "Could not load the location from Google." });
  }

  let approved = true;
  let approvalMessage: string | null = null;
  const notApproved = (err: unknown): boolean => {
    if (err instanceof GbpNotApprovedError) {
      approved = false;
      approvalMessage = err.message;
      return true;
    }
    return false;
  };

  // Reviews (v4 — approval-gated).
  let reviews: GbpReview[] = [];
  try {
    reviews = await listReviews(businessId);
  } catch (err) {
    if (!notApproved(err)) reqLog(req).warn({ err }, "gbp sync reviews failed (non-fatal)");
  }

  // Q&A (approval-gated).
  let questions: GbpQuestion[] = [];
  try {
    questions = await listQuestions(businessId);
  } catch (err) {
    if (!notApproved(err)) reqLog(req).warn({ err }, "gbp sync questions failed (non-fatal)");
  }

  // Local posts (approval-gated) — used for the completeness score.
  let posts: Array<{ createTime: string | null }> = [];
  try {
    posts = await listLocalPosts(businessId);
  } catch (err) {
    if (!notApproved(err)) reqLog(req).warn({ err }, "gbp sync posts failed (non-fatal)");
  }

  // Insights (approval-gated).
  let insights: GbpInsights | null = null;
  try {
    insights = await getInsights(businessId);
  } catch (err) {
    if (!notApproved(err)) reqLog(req).warn({ err }, "gbp sync insights failed (non-fatal)");
  }

  // ── Derive values ──────────────────────────────────────────────────────────
  const title = location?.title || null;
  const address = addressFromLocation(location);
  const phone = location?.phoneNumbers?.primaryPhone || null;
  const website = location?.websiteUri || null;
  const description = location?.profile?.description || null;
  const categories: string[] = [];
  if (location?.categories?.primaryCategory?.displayName)
    categories.push(location.categories.primaryCategory.displayName);
  for (const c of location?.categories?.additionalCategories || []) {
    if (c?.displayName) categories.push(c.displayName);
  }

  const ratings = reviews.map((r) => r.rating).filter((n) => n > 0);
  const avgRating = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100 : null;
  const reviewCount = reviews.length;
  const respondsToReviews = reviews.some((r) => r.reply);
  const now = Date.now();
  const hasRecentPost = posts.some((p) => p.createTime && now - Date.parse(p.createTime) < 30 * 24 * 60 * 60 * 1000);

  // Hours from regularHours.periods.
  const periods: any[] = location?.regularHours?.periods || [];
  const hoursRows = periods
    .map((p) => {
      const day = DAY_NAMES[p?.openDay as string];
      if (!day) return null;
      return {
        business_id: businessId,
        day,
        open_time: p?.openTime ? fmtTime(p.openTime) : null,
        close_time: p?.closeTime ? fmtTime(p.closeTime) : null,
        is_closed: false,
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  const score = completenessScore({
    hasPhone: !!phone,
    hasWebsite: !!website,
    hasHours: hoursRows.length > 0,
    hasDescription: !!description,
    hasCategories: categories.length > 0,
    reviewCount,
    hasRecentPost,
    respondsToReviews,
  });

  // ── Persist ─────────────────────────────────────────────────────────────────
  try {
    // Keep the existing place_id (NOT NULL); fall back to the business's stored
    // google_place_id, else the location name.
    const { data: existingProfile } = await db
      .from("gmb_profiles")
      .select("place_id")
      .eq("business_id", businessId)
      .maybeSingle();
    const { data: bizRow } = await db
      .from("businesses")
      .select("google_place_id")
      .eq("id", businessId)
      .maybeSingle();
    const placeId =
      (existingProfile as any)?.place_id ||
      (bizRow as any)?.google_place_id ||
      location?.metadata?.placeId ||
      location?.name ||
      "";

    await db.from("gmb_profiles").upsert(
      {
        business_id: businessId,
        place_id: placeId,
        business_name: title || "My Business",
        address,
        phone,
        website,
        rating: avgRating,
        review_count: reviewCount,
        description,
        types: categories,
        google_url: location?.metadata?.mapsUri || null,
        lat: location?.latlng?.latitude ?? null,
        lng: location?.latlng?.longitude ?? null,
        overall_score: score,
        last_scanned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id" },
    );

    // Hours: replace existing rows.
    if (hoursRows.length) {
      await db.from("gmb_hours").delete().eq("business_id", businessId);
      await db.from("gmb_hours").insert(hoursRows);
    }

    // Reviews: dedup on (business_id, platform_review_id).
    if (reviews.length) {
      const ids = reviews.map((r) => r.name).filter(Boolean);
      const { data: existing } = await db
        .from("reviews")
        .select("id, platform_review_id")
        .eq("business_id", businessId)
        .eq("platform", "google")
        .in("platform_review_id", ids);
      const existingById = new Map<string, string>();
      for (const row of (existing as any[]) || []) existingById.set(row.platform_review_id, row.id);

      const toInsert: any[] = [];
      for (const r of reviews) {
        const rowBase = {
          business_id: businessId,
          platform: "google" as const,
          platform_review_id: r.name,
          rating: r.rating || 1,
          text: r.comment || "",
          author: { name: r.reviewer },
          date: r.createTime || new Date().toISOString(),
          response: r.reply ? { comment: r.reply.comment, updated_at: r.reply.updateTime } : null,
          metadata: { source: "gbp" },
          updated_at: new Date().toISOString(),
        };
        const existingId = existingById.get(r.name);
        if (existingId) {
          await db.from("reviews").update(rowBase).eq("id", existingId);
        } else {
          toInsert.push(rowBase);
        }
      }
      if (toInsert.length) await db.from("reviews").insert(toInsert);
    }

    // Q&A: replace Google-sourced rows.
    if (questions.length) {
      await db.from("gmb_qas").delete().eq("business_id", businessId).eq("source", "google");
      await db.from("gmb_qas").insert(
        questions.map((q) => ({
          business_id: businessId,
          question: q.text || "(question)",
          answer: q.topAnswer?.text || null,
          author: q.author || "Customer",
          source: "google",
        })),
      );
    }

    // Audit results: a few real rows from the fetched data.
    const auditRows = [
      {
        business_id: businessId,
        category: "Business Hours",
        title: hoursRows.length ? "Hours set" : "Hours missing",
        description: hoursRows.length ? "Regular hours are published on your profile." : "No regular hours found.",
        status: hoursRows.length ? "good" : "warning",
        impact: hoursRows.length ? "low" : "high",
        action_required: hoursRows.length ? "No action needed." : "Add your regular hours in Google.",
      },
      {
        business_id: businessId,
        category: "Online Presence",
        title: website ? "Website present" : "No website linked",
        description: website ? "A website URL is linked to your profile." : "No website URL on the profile.",
        status: website ? "good" : "warning",
        impact: website ? "low" : "medium",
        action_required: website ? "No action needed." : "Add your website URL in Google.",
      },
      {
        business_id: businessId,
        category: "Posts",
        title: hasRecentPost ? "Has recent posts" : "No recent posts",
        description: hasRecentPost ? "You have posted in the last 30 days." : "No local posts in the last 30 days.",
        status: hasRecentPost ? "good" : "warning",
        impact: hasRecentPost ? "low" : "medium",
        action_required: hasRecentPost ? "Keep posting weekly." : "Publish a Google post to stay active.",
      },
      {
        business_id: businessId,
        category: "Reviews",
        title: respondsToReviews ? "Responds to reviews" : "Reviews need responses",
        description: respondsToReviews
          ? "At least one review has an owner reply."
          : reviewCount
            ? "Reviews exist but none have replies."
            : "No reviews synced yet.",
        status: respondsToReviews ? "good" : reviewCount ? "warning" : "good",
        impact: respondsToReviews ? "low" : "medium",
        action_required: respondsToReviews ? "No action needed." : "Reply to your recent reviews.",
      },
    ];
    // Only replace the audit rows we own (these categories) to avoid clobbering
    // Places-based audits; simplest correct behaviour is a full replace here.
    await db.from("gmb_audit_results").delete().eq("business_id", businessId);
    await db.from("gmb_audit_results").insert(auditRows);
  } catch (err) {
    reqLog(req).error({ err }, "gbp sync persist failed");
    return res.status(500).json({ error: "Synced from Google but failed to save locally." });
  }

  await writeAudit(req, businessId, "update", "gbp_sync", {
    reviews: reviewCount,
    questions: questions.length,
    approved,
  });

  return res.json({
    locationSynced: true,
    reviews: reviewCount,
    questions: questions.length,
    insights,
    approved,
    ...(approved ? {} : { message: approvalMessage || "Some Google Business Profile APIs are not approved yet." }),
  });
}

// ── Router ───────────────────────────────────────────────────────────────────

export const gbpRouter = Router();
gbpRouter.use(requireAuth);
gbpRouter.get("/:businessId/status", handleStatus);
gbpRouter.get("/:businessId/reviews", handleReviews);
gbpRouter.post("/:businessId/reviews/:reviewId/reply", writeLimiter, handleReply);
gbpRouter.get("/:businessId/posts", handlePosts);
gbpRouter.post("/:businessId/posts", writeLimiter, handleCreatePost);
gbpRouter.get("/:businessId/questions", handleQuestions);
gbpRouter.get("/:businessId/insights", handleInsights);
gbpRouter.post("/:businessId/sync", writeLimiter, handleSync);
