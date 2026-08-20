/**
 * Per-business metric aggregation for the super-admin business pages.
 *
 * All counts are produced with GROUPED queries (one query per metric, filtered
 * with `.in('business_id', ids)`), never N+1 per-business round-trips. Every
 * table read here is gated by `is_super_admin()` RLS on the server.
 */
import supabaseClient from "@/lib/supabaseClient";

export interface BusinessAggregate {
  /** business_members rows for this business. */
  members: number;
  /** jobs rows (shown as "Projects" in the UI). */
  jobs: number;
  /** job_media rows with media_type = 'image'. */
  photos: number;
  /** job_media rows with media_type = 'video'. */
  videos: number;
  /** reviews rows. */
  reviews: number;
  /** Sum of billing_records.amount_cents where status = 'paid'. */
  revenueCents: number;
}

export function emptyAggregate(): BusinessAggregate {
  return { members: 0, jobs: 0, photos: 0, videos: 0, reviews: 0, revenueCents: 0 };
}

/** Split an array into chunks of at most `size` (keeps `.in()` URLs bounded). */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Batch per-business aggregates for a set of business IDs. Returns a map keyed
 * by business id; every requested id is present (zero-filled) even if it has no
 * rows. Throws on the first query error so callers can surface a real error
 * state rather than silently rendering zeros.
 */
export async function fetchBusinessAggregates(
  businessIds: string[],
): Promise<Record<string, BusinessAggregate>> {
  const result: Record<string, BusinessAggregate> = {};
  for (const id of businessIds) result[id] = emptyAggregate();
  if (businessIds.length === 0) return result;

  const [membersRes, jobsRes, reviewsRes, billingRes] = await Promise.all([
    supabaseClient.from("business_members").select("business_id").in("business_id", businessIds),
    supabaseClient.from("jobs").select("id, business_id").in("business_id", businessIds),
    supabaseClient.from("reviews").select("business_id").in("business_id", businessIds),
    supabaseClient
      .from("billing_records")
      .select("business_id, amount_cents")
      .eq("status", "paid")
      .in("business_id", businessIds),
  ]);

  if (membersRes.error) throw membersRes.error;
  if (jobsRes.error) throw jobsRes.error;
  if (reviewsRes.error) throw reviewsRes.error;
  if (billingRes.error) throw billingRes.error;

  for (const r of membersRes.data ?? []) {
    const a = result[r.business_id as string];
    if (a) a.members += 1;
  }

  const jobIdToBiz = new Map<string, string>();
  for (const r of jobsRes.data ?? []) {
    const a = result[r.business_id as string];
    if (a) a.jobs += 1;
    jobIdToBiz.set(r.id as string, r.business_id as string);
  }

  for (const r of reviewsRes.data ?? []) {
    const a = result[r.business_id as string];
    if (a) a.reviews += 1;
  }

  for (const r of billingRes.data ?? []) {
    const a = result[r.business_id as string];
    if (a) a.revenueCents += (r.amount_cents as number) ?? 0;
  }

  // Photos/videos: job_media has no business_id, so map job_id -> business_id.
  const jobIds = Array.from(jobIdToBiz.keys());
  for (const batch of chunk(jobIds, 300)) {
    const mediaRes = await supabaseClient
      .from("job_media")
      .select("job_id, media_type")
      .in("job_id", batch);
    if (mediaRes.error) throw mediaRes.error;
    for (const r of mediaRes.data ?? []) {
      const biz = jobIdToBiz.get(r.job_id as string);
      if (!biz) continue;
      const a = result[biz];
      if (!a) continue;
      if (r.media_type === "image") a.photos += 1;
      else if (r.media_type === "video") a.videos += 1;
    }
  }

  return result;
}

/** Convenience wrapper for a single business. */
export async function fetchBusinessAggregate(businessId: string): Promise<BusinessAggregate> {
  const map = await fetchBusinessAggregates([businessId]);
  return map[businessId] ?? emptyAggregate();
}

/**
 * Safe date formatter for super-admin views: returns "—" for empty, null, or
 * unparseable values instead of the browser's "Invalid Date".
 */
export function formatDate(
  value: string | number | Date | null | undefined,
  opts: { includeTime?: boolean } = {},
): string {
  if (value === null || value === undefined || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return opts.includeTime ? d.toLocaleString() : d.toLocaleDateString();
}
