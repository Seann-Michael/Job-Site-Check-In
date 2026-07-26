/**
 * Google Business Profile API client — the owner's connection powers ALL
 * GMB features (profile info, hours, posts, reviews). The Places API is
 * used only as a utility (address autocomplete, public-view audit).
 *
 * Endpoints:
 * - Business info (read/patch):  mybusinessbusinessinformation.googleapis.com/v1
 * - Posts + reviews (v4):        mybusiness.googleapis.com/v4
 *
 * Everything here requires the owner's OAuth token (business.manage scope)
 * from Settings → Integrations; callers fall back to the local/demo data
 * layer when not connected.
 */

import { getGmbConnection, type GmbConnection } from '@/lib/gmb-posts';

const INFO_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const V4_BASE = 'https://mybusiness.googleapis.com/v4';

export interface BusinessInfo {
  title: string;
  phone?: string;
  website?: string;
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

async function authedFetch(
  connection: GmbConnection,
  url: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Google API ${response.status}: ${text.slice(0, 200)}`);
  }
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

/** locations/{id} resource name from the stored accounts/{a}/locations/{l}. */
function locationResource(connection: GmbConnection): string {
  const match = connection.locationName.match(/locations\/[^/]+$/);
  return match ? match[0] : connection.locationName;
}

function fmtTime(time: Record<string, unknown> | undefined): string {
  if (!time) return '';
  const hours = typeof time.hours === 'number' ? time.hours : 0;
  const minutes = typeof time.minutes === 'number' ? time.minutes : 0;
  const period = hours >= 12 ? 'PM' : 'AM';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(minutes).padStart(2, '0')} ${period}`;
}

/** Live business info from the owner's profile, or null when not connected. */
export async function fetchBusinessInfo(): Promise<BusinessInfo | null> {
  const connection = await getGmbConnection();
  if (!connection) return null;
  try {
    const data = await authedFetch(
      connection,
      `${INFO_BASE}/${locationResource(connection)}?readMask=title,phoneNumbers,websiteUri,regularHours,categories`,
    );
    const phones = (data.phoneNumbers ?? {}) as Record<string, unknown>;
    const categories = (data.categories ?? {}) as Record<string, unknown>;
    const primary = (categories.primaryCategory ?? {}) as Record<string, unknown>;
    const regular = (data.regularHours ?? {}) as Record<string, unknown>;
    const periods = Array.isArray(regular.periods)
      ? (regular.periods as Record<string, unknown>[])
      : [];
    const hours: Record<string, string> = {};
    for (const period of periods) {
      const day = typeof period.openDay === 'string' ? period.openDay : '';
      if (!day) continue;
      const open = fmtTime(period.openTime as Record<string, unknown> | undefined);
      const close = fmtTime(period.closeTime as Record<string, unknown> | undefined);
      hours[day] = open && close ? `${open} – ${close}` : 'Open';
    }
    return {
      title: String(data.title ?? ''),
      phone: typeof phones.primaryPhone === 'string' ? phones.primaryPhone : undefined,
      website: typeof data.websiteUri === 'string' ? data.websiteUri : undefined,
      hours,
      primaryCategory: typeof primary.displayName === 'string' ? primary.displayName : undefined,
    };
  } catch {
    return null;
  }
}

/** Live reviews with owner replies, or null when not connected. */
export async function fetchGoogleReviews(): Promise<GoogleReview[] | null> {
  const connection = await getGmbConnection();
  if (!connection) return null;
  try {
    const data = await authedFetch(
      connection,
      `${V4_BASE}/${connection.locationName}/reviews?pageSize=20`,
    );
    const raw = Array.isArray(data.reviews) ? (data.reviews as Record<string, unknown>[]) : [];
    const stars: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
    return raw.map((review) => {
      const reviewer = (review.reviewer ?? {}) as Record<string, unknown>;
      const reply = (review.reviewReply ?? {}) as Record<string, unknown>;
      return {
        id: String(review.name ?? review.reviewId ?? ''),
        reviewer: String(reviewer.displayName ?? 'Google user'),
        rating: stars[String(review.starRating ?? '')] ?? 5,
        comment: String(review.comment ?? ''),
        created_at: String(review.createTime ?? ''),
        reply: typeof reply.comment === 'string' ? reply.comment : undefined,
      };
    });
  } catch {
    return null;
  }
}

/** Reply to (or update the reply on) a Google review. */
export async function replyToGoogleReview(reviewId: string, comment: string): Promise<void> {
  const connection = await getGmbConnection();
  if (!connection) throw new Error('Google Business Profile is not connected.');
  await authedFetch(connection, `${V4_BASE}/${reviewId}/reply`, {
    method: 'PUT',
    body: JSON.stringify({ comment }),
  });
}
