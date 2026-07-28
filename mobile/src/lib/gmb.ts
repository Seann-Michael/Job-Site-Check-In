/**
 * Google Business Profile data — the same tables and logic as the web app's
 * GMB Optimization page (client/pages/GMBOptimization.tsx):
 *   gmb_profiles (one row per business), gmb_audit_results (audit items),
 *   gmb_hours / gmb_qas / gmb_categories / gmb_services (managed lists).
 * Connect and Scan fetch Google Places details and regenerate the audit with
 * the exact rules the web app uses, so scores match across platforms.
 */

import { DEMO_GMB_AUDIT, DEMO_GMB_PROFILE } from '@/lib/demo-data';
import { getBusinessDetails, type BusinessDetails } from '@/lib/places';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { workspace } from '@/lib/workspace';

export interface GmbProfileRow {
  id?: string;
  business_id: string;
  place_id: string;
  business_name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number;
  photos: string[] | null;
  overall_score: number;
  google_url: string | null;
  last_scanned_at: string | null;
}

export type GmbAuditStatus = 'critical' | 'warning' | 'good';

export interface GmbAuditRow {
  id: string;
  category: string;
  title: string;
  description: string;
  status: GmbAuditStatus;
  impact: 'high' | 'medium' | 'low';
  action_required: string;
}

export interface GmbCounts {
  hours: number;
  qas: number;
  categories: number;
  services: number;
}

/**
 * What the GMB tab actually has to show.
 *
 *   'demo'         — Supabase isn't configured, so the sample profile stands in
 *                    and every screen labels it as sample.
 *   'disconnected' — nothing of this user's to show. The optional `reason` is
 *                    the whole point of this variant having two shapes:
 *                      absent  — this business genuinely has no profile
 *                                connected yet, so "Connect your profile" is
 *                                the honest next step;
 *                      present — the question could not be answered (the
 *                                businesses list failed, or the gmb_profiles
 *                                read failed), or this workspace cannot hold a
 *                                profile at all. Inviting a connect here would
 *                                be a claim we cannot make: the user may
 *                                already have a profile, and following the
 *                                prompt upserts straight over it. The screen
 *                                shows the reason instead of the connect form.
 *   'connected'    — this business's own profile row.
 *
 * Same discipline as lib/data.ts: record why the answer is empty rather than
 * inventing a state that happens to render.
 */
export type GmbData =
  | { mode: 'demo' }
  | { mode: 'disconnected'; reason?: string }
  | { mode: 'connected'; profile: GmbProfileRow; audit: GmbAuditRow[]; counts: GmbCounts };

type Row = Record<string, unknown>;

function mapProfile(row: Row): GmbProfileRow {
  return {
    id: typeof row.id === 'string' ? row.id : undefined,
    business_id: String(row.business_id ?? ''),
    place_id: String(row.place_id ?? ''),
    business_name: String(row.business_name ?? ''),
    address: typeof row.address === 'string' ? row.address : null,
    phone: typeof row.phone === 'string' ? row.phone : null,
    website: typeof row.website === 'string' ? row.website : null,
    rating: typeof row.rating === 'number' ? row.rating : null,
    review_count: typeof row.review_count === 'number' ? row.review_count : 0,
    photos: Array.isArray(row.photos) ? (row.photos as string[]) : null,
    overall_score: typeof row.overall_score === 'number' ? row.overall_score : 0,
    google_url: typeof row.google_url === 'string' ? row.google_url : null,
    last_scanned_at: typeof row.last_scanned_at === 'string' ? row.last_scanned_at : null,
  };
}

function mapAudit(row: Row): GmbAuditRow {
  const status = String(row.status ?? 'warning');
  const impact = String(row.impact ?? 'medium');
  return {
    id: String(row.id ?? ''),
    category: String(row.category ?? ''),
    title: String(row.title ?? ''),
    description: String(row.description ?? ''),
    status: status === 'good' || status === 'critical' ? status : 'warning',
    impact: impact === 'high' || impact === 'low' ? impact : 'medium',
    action_required: String(row.action_required ?? ''),
  };
}

async function tableCount(table: string, businessId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('business_id', businessId);
  if (error || typeof count !== 'number') return 0;
  return count;
}

/**
 * Is a Google Business Profile connected for the current business? Asked once,
 * and answered for both the read (fetchGmbData) and the write (connectGmb), so
 * the two can never disagree about whose profile is whose.
 *
 * Scope first. `gmb_profiles` holds one row per business across every tenant,
 * so an unfiltered read returns whichever row the database hands back first —
 * another company's name, address, phone, rating and score, presented on the
 * GMB tab and the Activity score card as this user's own. That is both a
 * cross-tenant leak and a false claim about this business; it has only ever
 * looked right because today's database holds a single company. `business_id`
 * is already on the table (saveProfileAndAudit writes it, gmb_audit_results is
 * filtered by it), so this needs no migration.
 *
 * Four answers, because "no profile" and "no answer" are different facts:
 *   'connected' — this business's own row.
 *   'none'      — a real business with no gmb_profiles row. The only state in
 *                 which offering to connect one is a true statement.
 *   'sample'    — the placeholder workspace.getBusinesses() stands in with when
 *                 the businesses table comes back empty. It owns no row on the
 *                 server, so there is nothing to show and nothing to connect
 *                 to — and the first row of a shared table is not a stand-in
 *                 for it.
 *   'unknown'   — the businesses list failed to load, or the gmb_profiles read
 *                 itself failed. Nothing is the only honest answer: an
 *                 unscoped read is precisely the leak the filter exists to
 *                 prevent, and a blank "connect your profile" invitation is
 *                 precisely the false claim this state exists to avoid.
 * The last two carry the sentence a screen can show verbatim.
 */
type ProfileLookup =
  | { state: 'connected'; businessId: string; row: Row }
  | { state: 'none'; businessId: string }
  | { state: 'sample'; reason: string }
  | { state: 'unknown'; reason: string };

const SAMPLE_REASON =
  "You're in the sample workspace, so there's no business to connect a Google Business " +
  'Profile to. Create one in the web dashboard first.';

async function lookupProfile(): Promise<ProfileLookup> {
  const business = await workspace.getCurrent();
  if (!business) {
    return {
      state: 'unknown',
      reason:
        workspace.lastError() ??
        ("Your business hasn't loaded yet, so we can't tell whether a Google Business " +
          'Profile is connected.'),
    };
  }
  // Demo ids are prefixed `demo` by workspace.ts; they match no business_id.
  if (business.id.startsWith('demo')) return { state: 'sample', reason: SAMPLE_REASON };

  const { data, error } = await supabase
    .from('gmb_profiles')
    .select('*')
    .eq('business_id', business.id)
    .limit(1)
    .maybeSingle();
  if (error) {
    // A failed read is not an unconnected business. Collapsing the two is what
    // invites someone who already has a profile to connect a second one.
    return {
      state: 'unknown',
      reason: `Couldn't check whether a Google Business Profile is connected: ${error.message}`,
    };
  }
  if (!data) return { state: 'none', businessId: business.id };
  return { state: 'connected', businessId: business.id, row: data as Row };
}

export async function fetchGmbData(): Promise<GmbData> {
  if (!isSupabaseConfigured) return { mode: 'demo' };

  const lookup = await lookupProfile();
  if (lookup.state !== 'connected') {
    // Nothing of this user's to show in any of the three cases — never another
    // tenant's profile, never a sample one dressed up as real. Demo data
    // belongs to `mode: 'demo'` alone, which is reached only when Supabase is
    // unconfigured. What differs is what the screen may say: 'none' is a real
    // "not connected yet", the other two carry their reason instead.
    return lookup.state === 'none'
      ? { mode: 'disconnected' }
      : { mode: 'disconnected', reason: lookup.reason };
  }

  const profile = mapProfile(lookup.row);
  const [auditRes, hours, qas, categories, services] = await Promise.all([
    supabase
      .from('gmb_audit_results')
      .select('*')
      .eq('business_id', profile.business_id)
      .order('scanned_at', { ascending: false })
      .limit(20),
    tableCount('gmb_hours', profile.business_id),
    tableCount('gmb_qas', profile.business_id),
    tableCount('gmb_categories', profile.business_id),
    tableCount('gmb_services', profile.business_id),
  ]);

  const audit = auditRes.error ? [] : ((auditRes.data ?? []) as Row[]).map(mapAudit);
  return { mode: 'connected', profile, audit, counts: { hours, qas, categories, services } };
}

/** Port of the web app's generateAuditFromPlace — keep the rules in sync. */
export function generateAuditFromPlace(place: BusinessDetails): Omit<GmbAuditRow, 'id'>[] {
  const items: Omit<GmbAuditRow, 'id'>[] = [];

  if (!place.formatted_phone_number) {
    items.push({ category: 'Contact', title: 'Missing Phone Number', description: 'No phone number is listed on your GMB profile.', status: 'critical', impact: 'high', action_required: 'Add a phone number to your GMB profile.' });
  } else {
    items.push({ category: 'Contact', title: 'Phone Number Present', description: 'Your phone number is listed correctly.', status: 'good', impact: 'low', action_required: 'No action needed.' });
  }

  if (!place.website) {
    items.push({ category: 'Online Presence', title: 'No Website Linked', description: 'Your profile has no website link, reducing customer trust.', status: 'critical', impact: 'high', action_required: 'Add your website URL to your GMB profile.' });
  } else {
    items.push({ category: 'Online Presence', title: 'Website Linked', description: 'Your website is linked to your GMB profile.', status: 'good', impact: 'low', action_required: 'No action needed.' });
  }

  const photoCount = place.photo_urls.length;
  if (photoCount < 5) {
    items.push({ category: 'Photos', title: 'Insufficient Photos', description: `You have ${photoCount} photo(s). Businesses with 10+ photos get 42% more direction requests.`, status: 'warning', impact: 'medium', action_required: 'Upload at least 10 high-quality photos.' });
  } else {
    items.push({ category: 'Photos', title: 'Good Photo Coverage', description: `You have ${photoCount} photos — keep adding seasonal and interior shots.`, status: 'good', impact: 'low', action_required: 'Continue adding fresh photos regularly.' });
  }

  const rating = place.rating ?? 0;
  const reviewCount = place.user_ratings_total ?? 0;
  if (rating < 4.0) {
    items.push({ category: 'Reviews', title: 'Below-Average Rating', description: `Your rating is ${rating.toFixed(1)} ⭐. Aim for 4.0+.`, status: 'critical', impact: 'high', action_required: 'Respond to negative reviews and actively request positive reviews.' });
  } else if (reviewCount < 20) {
    items.push({ category: 'Reviews', title: 'Low Review Count', description: `You have ${reviewCount} review(s). More reviews improve trust and local ranking.`, status: 'warning', impact: 'medium', action_required: 'Send review request links to recent customers.' });
  } else {
    items.push({ category: 'Reviews', title: 'Strong Review Profile', description: `${rating.toFixed(1)} ⭐ across ${reviewCount} reviews. Keep engaging!`, status: 'good', impact: 'low', action_required: 'Continue responding to all reviews.' });
  }

  if (!place.has_opening_hours) {
    items.push({ category: 'Business Hours', title: 'Hours Not Set', description: 'Your business hours are missing, causing customer confusion.', status: 'critical', impact: 'high', action_required: 'Add your business hours in the Hours tab.' });
  } else {
    items.push({ category: 'Business Hours', title: 'Hours Configured', description: 'Business hours are set on your profile.', status: 'good', impact: 'low', action_required: 'Keep hours updated for holidays.' });
  }

  return items;
}

async function saveProfileAndAudit(
  businessId: string,
  details: BusinessDetails,
): Promise<{ error?: string }> {
  const auditItems = generateAuditFromPlace(details);
  const good = auditItems.filter((item) => item.status === 'good').length;
  const score = Math.round((good / auditItems.length) * 100);

  const profileData = {
    business_id: businessId,
    place_id: details.place_id,
    business_name: details.name,
    address: details.formatted_address ?? null,
    phone: details.formatted_phone_number ?? null,
    website: details.website ?? null,
    rating: details.rating ?? null,
    review_count: details.user_ratings_total ?? 0,
    types: details.types ?? [],
    photos: details.photo_urls,
    lat: details.latitude ?? null,
    lng: details.longitude ?? null,
    google_url: details.google_url ?? null,
    overall_score: score,
    last_scanned_at: new Date().toISOString(),
  };

  const { error: profileError } = await supabase
    .from('gmb_profiles')
    .upsert(profileData, { onConflict: 'business_id' });
  if (profileError) return { error: profileError.message };

  // Same replace strategy as the web app.
  await supabase.from('gmb_audit_results').delete().eq('business_id', businessId);
  const { error: auditError } = await supabase
    .from('gmb_audit_results')
    .insert(auditItems.map((item) => ({ ...item, business_id: businessId })));
  if (auditError) return { error: auditError.message };

  return {};
}

/** Connect a Google Business Profile by place, like the web connect flow. */
export async function connectGmb(placeId: string): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) return { error: 'Supabase is not configured.' };

  // The same lookup fetchGmbData reads back, for two reasons.
  //
  // Scope: file the profile against the *active* business. Taking the first row
  // of `businesses` picked an arbitrary tenant's company — the profile would be
  // written under someone else's id, and because the upsert conflicts on
  // business_id it would overwrite whatever profile that company already had.
  //
  // Certainty: that same upsert (plus the audit delete in saveProfileAndAudit)
  // replaces this business's own profile too. So a write that goes ahead while
  // the connected/not-connected question is unanswered can destroy a real
  // connection the read simply failed to see. When we can't tell, we don't
  // write — 'unknown' and 'sample' already carry the sentence to say why.
  const lookup = await lookupProfile();
  if (lookup.state === 'unknown' || lookup.state === 'sample') return { error: lookup.reason };

  // 'connected' is deliberately allowed through: re-connecting the same
  // business is what the upsert is for, and the caller reached this knowing a
  // profile is there. Only the states that cannot vouch for that are refused.
  const details = await getBusinessDetails(placeId);
  if (!details) return { error: 'Could not load business details from Google.' };

  return saveProfileAndAudit(lookup.businessId, details);
}

/** Refresh profile + audit from Google, like the web Scan button. */
export async function scanGmb(profile: GmbProfileRow): Promise<{ error?: string }> {
  const details = await getBusinessDetails(profile.place_id);
  if (!details) return { error: 'Could not reach Google Places. Check the Maps API key.' };
  return saveProfileAndAudit(profile.business_id, details);
}

export { DEMO_GMB_AUDIT, DEMO_GMB_PROFILE };
