/**
 * Google Business Profile posts ("Updates" on Google) — list, create,
 * edit, delete, with photo attachments.
 *
 * Uses the Business Profile API (mybusiness v4 localPosts), which requires
 * the business owner's Google OAuth token with the business.manage scope
 * and Google's API-access approval for the project. The owner connects on
 * the web app; the token is shared via the google_oauth_tokens table.
 * Until that's configured, a demo store simulates the full flow.
 *
 * Note: Google's API accepts PHOTO media on posts; video attachments are
 * not reliably supported by the localPosts API.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

const DEMO_KEY = 'lsr-gmb-posts-demo-v1';
const API_BASE = 'https://mybusiness.googleapis.com/v4';

export interface GmbPost {
  /** Full resource name (accounts/…/locations/…/localPosts/…) or demo id. */
  id: string;
  summary: string;
  created_at: string;
  /** Publicly hosted photo shown on the post. */
  photo_url?: string;
  cta?: 'LEARN_MORE' | 'CALL' | 'BOOK' | 'ORDER' | 'SIGN_UP';
  cta_url?: string;
  state: 'LIVE' | 'PROCESSING' | 'REJECTED' | 'DEMO';
}

export interface GmbConnection {
  accessToken: string;
  /** accounts/{accountId}/locations/{locationId} */
  locationName: string;
}

/**
 * The owner's Google connection: a dev token from .env for testing, or the
 * token the web app stored after the owner signed in with Google.
 */
export async function getGmbConnection(): Promise<GmbConnection | null> {
  const envToken = process.env.EXPO_PUBLIC_GMB_ACCESS_TOKEN ?? '';
  const envLocation = process.env.EXPO_PUBLIC_GMB_LOCATION ?? '';
  if (envToken && envLocation) {
    return { accessToken: envToken, locationName: envLocation };
  }
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase
      .from('google_oauth_tokens')
      .select('access_token, location_name, expires_at')
      .eq('provider', 'business_profile')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (
      data?.access_token &&
      data.location_name &&
      (!data.expires_at || new Date(String(data.expires_at)).getTime() > Date.now())
    ) {
      return {
        accessToken: String(data.access_token),
        locationName: String(data.location_name),
      };
    }
  } catch {
    // Not connected yet.
  }
  return null;
}

export async function isGmbPostsConnected(): Promise<boolean> {
  return (await getGmbConnection()) !== null;
}

// ---------------------------------------------------------------------------
// Demo store (full UX before Google API access is approved)

const DEMO_SEED: GmbPost[] = [
  {
    id: 'demo-post-1',
    summary:
      'Another gutter guard install wrapped up in Westlake! Leaves out, water flowing. Call for a free estimate before the fall rush.',
    created_at: '2026-07-21T18:30:00Z',
    cta: 'CALL',
    state: 'LIVE',
  },
  {
    id: 'demo-post-2',
    summary:
      'Before & after: French drain rescue in Avon Lake. No more soggy backyard. See more projects on our site.',
    created_at: '2026-07-14T16:00:00Z',
    cta: 'LEARN_MORE',
    cta_url: 'https://example.com/projects',
    state: 'LIVE',
  },
];

async function demoLoad(): Promise<GmbPost[]> {
  try {
    const raw = await AsyncStorage.getItem(DEMO_KEY);
    return raw ? (JSON.parse(raw) as GmbPost[]) : [...DEMO_SEED];
  } catch {
    return [...DEMO_SEED];
  }
}

async function demoSave(posts: GmbPost[]): Promise<void> {
  await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(posts)).catch(() => undefined);
}

// ---------------------------------------------------------------------------
// Live API

function mapApiPost(raw: Record<string, unknown>): GmbPost {
  const media = Array.isArray(raw.media) ? (raw.media as Record<string, unknown>[]) : [];
  const cta = (raw.callToAction ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.name ?? ''),
    summary: String(raw.summary ?? ''),
    created_at: String(raw.createTime ?? new Date().toISOString()),
    photo_url:
      media.length > 0 && typeof media[0].googleUrl === 'string'
        ? (media[0].googleUrl as string)
        : media.length > 0 && typeof media[0].sourceUrl === 'string'
          ? (media[0].sourceUrl as string)
          : undefined,
    cta: typeof cta.actionType === 'string' ? (cta.actionType as GmbPost['cta']) : undefined,
    cta_url: typeof cta.url === 'string' ? (cta.url as string) : undefined,
    state: raw.state === 'PROCESSING' || raw.state === 'REJECTED' ? raw.state : 'LIVE',
  };
}

function buildApiBody(input: {
  summary: string;
  photoUrl?: string;
  cta?: GmbPost['cta'];
  ctaUrl?: string;
}): Record<string, unknown> {
  return {
    languageCode: 'en-US',
    topicType: 'STANDARD',
    summary: input.summary,
    ...(input.photoUrl
      ? { media: [{ mediaFormat: 'PHOTO', sourceUrl: input.photoUrl }] }
      : {}),
    ...(input.cta
      ? {
          callToAction: {
            actionType: input.cta,
            ...(input.cta !== 'CALL' && input.ctaUrl ? { url: input.ctaUrl } : {}),
          },
        }
      : {}),
  };
}

async function apiFetch(
  connection: GmbConnection,
  path: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_BASE}/${path}`, {
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

// ---------------------------------------------------------------------------
// Public interface (routes to live API or demo store)

export async function fetchGmbPosts(): Promise<{ posts: GmbPost[]; live: boolean }> {
  const connection = await getGmbConnection();
  if (!connection) {
    return { posts: await demoLoad(), live: false };
  }
  const data = await apiFetch(connection, `${connection.locationName}/localPosts?pageSize=20`);
  const raw = Array.isArray(data.localPosts) ? (data.localPosts as Record<string, unknown>[]) : [];
  return { posts: raw.map(mapApiPost), live: true };
}

export async function createGmbPost(input: {
  summary: string;
  photoUrl?: string;
  cta?: GmbPost['cta'];
  ctaUrl?: string;
}): Promise<void> {
  const connection = await getGmbConnection();
  if (!connection) {
    const posts = await demoLoad();
    await demoSave([
      {
        id: `demo-post-${Date.now()}`,
        summary: input.summary,
        created_at: new Date().toISOString(),
        photo_url: input.photoUrl,
        cta: input.cta,
        cta_url: input.ctaUrl,
        state: 'DEMO',
      },
      ...posts,
    ]);
    return;
  }
  await apiFetch(connection, `${connection.locationName}/localPosts`, {
    method: 'POST',
    body: JSON.stringify(buildApiBody(input)),
  });
}

export async function updateGmbPost(id: string, summary: string): Promise<void> {
  const connection = await getGmbConnection();
  if (!connection || id.startsWith('demo-post-')) {
    const posts = await demoLoad();
    await demoSave(posts.map((post) => (post.id === id ? { ...post, summary } : post)));
    return;
  }
  await apiFetch(connection, `${id}?updateMask=summary`, {
    method: 'PATCH',
    body: JSON.stringify({ summary, languageCode: 'en-US', topicType: 'STANDARD' }),
  });
}

export async function deleteGmbPost(id: string): Promise<void> {
  const connection = await getGmbConnection();
  if (!connection || id.startsWith('demo-post-')) {
    const posts = await demoLoad();
    await demoSave(posts.filter((post) => post.id !== id));
    return;
  }
  await apiFetch(connection, id, { method: 'DELETE' });
}

export const CTA_LABELS: Record<NonNullable<GmbPost['cta']>, string> = {
  LEARN_MORE: 'Learn more',
  CALL: 'Call now',
  BOOK: 'Book',
  ORDER: 'Order',
  SIGN_UP: 'Sign up',
};
