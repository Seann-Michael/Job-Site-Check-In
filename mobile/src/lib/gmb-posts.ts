/**
 * Google Business Profile posts ("Updates" on Google) — list, create,
 * edit, delete, with photo attachments.
 *
 * All Google traffic goes through our own API (`/api/gbp/:businessId/*`,
 * server/routes/gbp.ts), which holds the owner's OAuth tokens, refreshes
 * them and checks the caller can access the business. The phone never sees a
 * Google token. The owner connects from Settings → Integrations here or on
 * the web dashboard — the connection is shared. Until a profile is
 * connected, a demo store simulates the full flow.
 *
 * Note: Google's API accepts PHOTO media on posts; video attachments are
 * not reliably supported by the localPosts API.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { apiErrorMessage, apiFetch } from '@/lib/api';
import { isApiConfigured } from '@/lib/config';
import { getSignedMediaUrl } from '@/lib/media-urls';
import { isSupabaseConfigured } from '@/lib/supabase';
import { workspace } from '@/lib/workspace';

const DEMO_KEY = 'lsr-gmb-posts-demo-v1';

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
  /** The business whose Google profile is connected. */
  businessId: string;
  /** Google account that authorised the connection. */
  email: string | null;
  /** Human-readable location title from Google (or null while unapproved). */
  locationName: string;
  /** False when the Google Cloud project's Business Profile API access is still pending. */
  approved: boolean;
  /** Google's explanation when `approved` is false. */
  message?: string;
}

interface StatusResponse {
  connected: boolean;
  email?: string | null;
  locationName?: string | null;
  approved?: boolean;
  message?: string;
}

/**
 * The current business's Google connection, as the server reports it
 * (`GET /api/gbp/:businessId/status`). Tokens never leave the server: every
 * Google call goes through our API, which refreshes and scopes them.
 * Returns null when there is no current business, it is the sample
 * workspace, the API is not configured, or nothing is connected.
 */
export async function getGmbConnection(): Promise<GmbConnection | null> {
  if (!isSupabaseConfigured || !isApiConfigured) return null;
  const business = await workspace.getCurrent();
  if (!business || business.id.startsWith('demo')) return null;
  try {
    const status = await apiFetch<StatusResponse>(`/api/gbp/${business.id}/status`);
    if (!status?.connected) return null;
    return {
      businessId: business.id,
      email: status.email ?? null,
      locationName: status.locationName ?? '',
      approved: status.approved !== false,
      message: status.message,
    };
  } catch {
    return null;
  }
}

export async function isGmbPostsConnected(): Promise<boolean> {
  return (await getGmbConnection()) !== null;
}

/**
 * Start the Google sign-in that connects a Business Profile to the current
 * business. The server builds the consent URL (`POST /api/oauth/google_my_business/start`),
 * we open it in the system auth sheet, and the callback page deep-links back
 * to `localseoranker://gbp-connected`. Resolves once the sheet closes; the
 * caller re-reads getGmbConnection() to see the result.
 */
export async function connectGoogleBusinessProfile(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!isApiConfigured) return { ok: false, error: 'The web app API URL is not configured.' };
  const business = await workspace.getCurrent();
  if (!business || business.id.startsWith('demo')) {
    return { ok: false, error: 'Create a business in the web dashboard first.' };
  }
  let authorizeUrl = '';
  try {
    const data = await apiFetch<{ authorizeUrl?: string }>('/api/oauth/google_my_business/start', {
      method: 'POST',
      // No workspace_id: the server keys the connection to the caller's own
      // account (users.sub_account_id), which is what getTokensForBusiness
      // looks up for every business the account owns.
      body: { mobile: true },
    });
    authorizeUrl = data?.authorizeUrl ?? '';
  } catch (error) {
    return { ok: false, error: apiErrorMessage(error, 'Could not start Google sign-in.') };
  }
  if (!authorizeUrl) return { ok: false, error: 'Could not start Google sign-in.' };
  const returnUrl = Linking.createURL('gbp-connected');
  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, returnUrl);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    // The callback page may have finished before the sheet was dismissed —
    // the caller re-checks status either way.
    return { ok: true };
  }
  return { ok: true };
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
// Live API (through our server — server/routes/gbp.ts)

interface ServerPost {
  name: string;
  summary: string;
  state: string | null;
  topicType: string | null;
  createTime: string | null;
  searchUrl: string | null;
  callToAction: { actionType?: string; url?: string } | null;
  media: { googleUrl?: string; sourceUrl?: string }[];
}

function mapServerPost(raw: ServerPost): GmbPost {
  const media = Array.isArray(raw.media) ? raw.media : [];
  const first = media[0];
  const cta = raw.callToAction?.actionType;
  return {
    id: String(raw.name ?? ''),
    summary: String(raw.summary ?? ''),
    created_at: raw.createTime ?? new Date().toISOString(),
    photo_url: first?.googleUrl ?? first?.sourceUrl ?? undefined,
    cta: cta && cta in CTA_LABELS ? (cta as GmbPost['cta']) : undefined,
    cta_url: raw.callToAction?.url ?? undefined,
    state: raw.state === 'PROCESSING' || raw.state === 'REJECTED' ? raw.state : 'LIVE',
  };
}

// ---------------------------------------------------------------------------
// Public interface (routes to live API or demo store)

export async function fetchGmbPosts(): Promise<{ posts: GmbPost[]; live: boolean }> {
  const connection = await getGmbConnection();
  if (!connection) {
    return { posts: await demoLoad(), live: false };
  }
  const data = await apiFetch<{ posts: ServerPost[] }>(`/api/gbp/${connection.businessId}/posts`);
  const raw = Array.isArray(data?.posts) ? data.posts : [];
  return { posts: raw.map(mapServerPost), live: true };
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
  // Google fetches the photo itself, so it needs a public https URL. Media in
  // the private bucket is signed for 24h — long enough for Google to pull it.
  let photoUrl: string | undefined;
  if (input.photoUrl) {
    const signed = await getSignedMediaUrl(input.photoUrl, 24 * 60 * 60);
    if (signed && /^https:\/\//i.test(signed)) photoUrl = signed;
  }
  await apiFetch(`/api/gbp/${connection.businessId}/posts`, {
    method: 'POST',
    body: {
      summary: input.summary,
      topicType: 'STANDARD',
      ...(input.cta
        ? {
            callToAction: {
              actionType: input.cta,
              ...(input.cta !== 'CALL' && input.ctaUrl ? { url: input.ctaUrl } : {}),
            },
          }
        : {}),
      ...(photoUrl ? { media: [{ mediaFormat: 'PHOTO', sourceUrl: photoUrl }] } : {}),
    },
  });
}

export async function updateGmbPost(id: string, summary: string): Promise<void> {
  const connection = await getGmbConnection();
  if (!connection || id.startsWith('demo-post-')) {
    const posts = await demoLoad();
    await demoSave(posts.map((post) => (post.id === id ? { ...post, summary } : post)));
    return;
  }
  await apiFetch(`/api/gbp/${connection.businessId}/posts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { summary },
  });
}

export async function deleteGmbPost(id: string): Promise<void> {
  const connection = await getGmbConnection();
  if (!connection || id.startsWith('demo-post-')) {
    const posts = await demoLoad();
    await demoSave(posts.filter((post) => post.id !== id));
    return;
  }
  await apiFetch(`/api/gbp/${connection.businessId}/posts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export const CTA_LABELS: Record<NonNullable<GmbPost['cta']>, string> = {
  LEARN_MORE: 'Learn more',
  CALL: 'Call now',
  BOOK: 'Book',
  ORDER: 'Order',
  SIGN_UP: 'Sign up',
};
