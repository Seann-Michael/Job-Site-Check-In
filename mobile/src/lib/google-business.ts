/**
 * Google Business Profile — profile info, reviews and review replies for the
 * current business, through our own API (server/routes/gbp.ts):
 *
 *   GET  /api/gbp/:businessId/location                 → { location }
 *   GET  /api/gbp/:businessId/reviews                  → { reviews }
 *   POST /api/gbp/:businessId/reviews/:reviewId/reply  → { success, reply }
 *   GET  /api/gbp/:businessId/insights                 → { insights }
 *
 * The server owns the OAuth tokens (refresh included) and enforces that the
 * caller may access the business; the phone only ever sends its Supabase
 * session. Callers fall back to the local/demo data layer when not connected.
 */

import { apiFetch } from '@/lib/api';
import { getGmbConnection } from '@/lib/gmb-posts';

export interface BusinessInfo {
  title: string;
  phone?: string;
  website?: string;
  address?: string;
  /** e.g. { MONDAY: '8:00 AM – 5:00 PM' } */
  hours: Record<string, string>;
  primaryCategory?: string;
}

export interface GoogleReview {
  id: string;
  reviewer: string;
  rating: number;
  comment: string;
  created_at: string;
  reply?: string;
}

export interface GoogleInsights {
  calls: number;
  websiteClicks: number;
  directionRequests: number;
  views: number;
  searches: number;
  rangeDays: number;
}

interface ServerLocation {
  name: string;
  title: string;
  phone: string | null;
  website: string | null;
  primaryCategory: string | null;
  hours: Record<string, string>;
  address: string | null;
}

interface ServerReview {
  name: string;
  reviewId: string;
  reviewer: string;
  rating: number;
  comment: string;
  createTime: string | null;
  updateTime: string | null;
  reply: { comment: string; updateTime: string | null } | null;
}

/** Live business info from the owner's profile, or null when not connected. */
export async function fetchBusinessInfo(): Promise<BusinessInfo | null> {
  const connection = await getGmbConnection();
  if (!connection || !connection.approved) return null;
  try {
    const data = await apiFetch<{ location: ServerLocation }>(
      `/api/gbp/${connection.businessId}/location`,
    );
    const loc = data?.location;
    if (!loc) return null;
    return {
      title: loc.title ?? '',
      phone: loc.phone ?? undefined,
      website: loc.website ?? undefined,
      address: loc.address ?? undefined,
      hours: loc.hours ?? {},
      primaryCategory: loc.primaryCategory ?? undefined,
    };
  } catch {
    return null;
  }
}

/** Live reviews with owner replies, or null when not connected. */
export async function fetchGoogleReviews(): Promise<GoogleReview[] | null> {
  const connection = await getGmbConnection();
  if (!connection || !connection.approved) return null;
  try {
    const data = await apiFetch<{ reviews: ServerReview[] }>(
      `/api/gbp/${connection.businessId}/reviews`,
    );
    const raw = Array.isArray(data?.reviews) ? data.reviews : [];
    return raw.map((review) => ({
      id: review.name || review.reviewId,
      reviewer: review.reviewer || 'Google user',
      rating: review.rating || 5,
      comment: review.comment ?? '',
      created_at: review.createTime ?? '',
      reply: review.reply?.comment || undefined,
    }));
  } catch {
    return null;
  }
}

/** Reply to (or update the reply on) a Google review. */
export async function replyToGoogleReview(reviewId: string, comment: string): Promise<void> {
  const connection = await getGmbConnection();
  if (!connection) throw new Error('Google Business Profile is not connected.');
  await apiFetch(
    `/api/gbp/${connection.businessId}/reviews/${encodeURIComponent(reviewId)}/reply`,
    { method: 'POST', body: { comment } },
  );
}

/** 30-day performance metrics, or null when not connected. */
export async function fetchGoogleInsights(): Promise<GoogleInsights | null> {
  const connection = await getGmbConnection();
  if (!connection || !connection.approved) return null;
  try {
    const data = await apiFetch<{ insights: GoogleInsights }>(
      `/api/gbp/${connection.businessId}/insights`,
    );
    return data?.insights ?? null;
  } catch {
    return null;
  }
}
