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

export type GmbData =
  | { mode: 'demo' }
  | { mode: 'disconnected' }
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

export async function fetchGmbData(): Promise<GmbData> {
  if (!isSupabaseConfigured) return { mode: 'demo' };

  const { data, error } = await supabase.from('gmb_profiles').select('*').limit(1).maybeSingle();
  if (error || !data) return { mode: 'disconnected' };

  const profile = mapProfile(data as Row);
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

  // Mobile has no workspace switcher yet — key the profile to the first
  // business in the workspace, matching the single-business common case.
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id')
    .limit(1)
    .maybeSingle();
  if (businessError || !business) {
    return { error: 'No business found in your workspace. Create one in the web dashboard first.' };
  }

  const details = await getBusinessDetails(placeId);
  if (!details) return { error: 'Could not load business details from Google.' };

  return saveProfileAndAudit(String((business as Row).id), details);
}

/** Refresh profile + audit from Google, like the web Scan button. */
export async function scanGmb(profile: GmbProfileRow): Promise<{ error?: string }> {
  const details = await getBusinessDetails(profile.place_id);
  if (!details) return { error: 'Could not reach Google Places. Check the Maps API key.' };
  return saveProfileAndAudit(profile.business_id, details);
}

export { DEMO_GMB_AUDIT, DEMO_GMB_PROFILE };
