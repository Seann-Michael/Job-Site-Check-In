/**
 * Complete & Publish — the CompanyCam-style payoff: when a job is done, its
 * photos and details are pushed out for local SEO.
 *
 * Destinations:
 *  - Google Business Profile: inserts a social_media_posts row (platform
 *    'gmb', status 'scheduled') — the web app's syndication pipeline picks
 *    it up and posts it.
 *  - Website + GoHighLevel: delivered by the web app's Automation workflows.
 *    This needs EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_PUBLISH_WEBHOOK_ID.
 *    Without them there is no delivery route, so nothing leaves the device.
 *
 * The job is always marked completed, but delivery is reported per
 * destination and only destinations that actually got somewhere are written
 * to the on-device record the job screen reads. We never claim a delivery we
 * did not observe.
 *
 * Demo mode (Supabase unconfigured and no webhook) is the one exception, and
 * works like the rest of the app: there is nothing to deliver to, so every
 * destination reports 'demo' — spelled out as demo behaviour wherever it is
 * shown — and the record is still written so the job screen's Published
 * section works. A demo result never reports 'sent' or 'queued'.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { jobsStore } from '@/lib/jobs-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { workspace } from '@/lib/workspace';
import type { Job, MediaItem } from '@/lib/types';

const STORAGE_KEY = 'lsr-published-jobs-v1';
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const PUBLISH_WEBHOOK_ID = process.env.EXPO_PUBLIC_PUBLISH_WEBHOOK_ID ?? '';

export type Destination = 'gmb' | 'website' | 'gohighlevel';

export const DESTINATION_LABELS: Record<Destination, string> = {
  gmb: 'Google Business Profile',
  website: 'Website',
  gohighlevel: 'GoHighLevel',
};

/**
 * How the automation webhook call went.
 *  - 'sent'           — the webhook accepted the payload.
 *  - 'failed'         — we tried to deliver and the attempt was rejected.
 *  - 'not-configured' — no webhook is set up, so nothing was sent.
 */
export type WebhookOutcome = 'sent' | 'failed' | 'not-configured';

/**
 * What actually happened for one destination. Everything the webhook can
 * report, plus:
 *  - 'queued' — a row was written to the pipeline the web app reads.
 *  - 'demo'   — nothing is connected at all, so this is demo behaviour and no
 *               post was made anywhere.
 */
export type DeliveryStatus = WebhookOutcome | 'queued' | 'demo';

/** 'queued' and 'sent' are the only statuses that mean something left here. */
export function isDelivered(status: DeliveryStatus): boolean {
  return status === 'queued' || status === 'sent';
}

export interface DestinationResult {
  destination: Destination;
  status: DeliveryStatus;
  detail: string;
}

export interface PublishRecord {
  job_id: string;
  /** Destinations that were queued or sent — or, in demo mode, demoed. */
  destinations: Destination[];
  published_at: string;
  title: string;
}

const SERVICE_LABELS: Record<string, string> = {
  gutters: 'gutter services',
  drainage: 'drainage solutions',
  plumbing: 'plumbing',
  roofing: 'roofing',
  landscaping: 'landscaping',
  painting: 'painting',
  snow_removal: 'snow removal',
  general: 'home services',
};

export interface PublishContent {
  title: string;
  content: string;
  hashtags: string[];
  keywords: string[];
  location: string;
}

/** Local-SEO post copy generated from the job — editable before publishing. */
export function buildPublishContent(job: Job, businessName: string, photoCount: number): PublishContent {
  const service = SERVICE_LABELS[job.service_type] ?? 'home services';
  const place = job.city || 'your area';
  const title = `${job.title} — completed in ${place}`;
  const lines = [
    `✅ Another ${service} project completed in ${place}!`,
    `${job.title} for a happy customer${photoCount > 0 ? ` — see the before & after (${photoCount} photos)` : ''}.`,
    `Need ${service} in ${place}? ${businessName} is local, licensed, and ready to help. Call us for a free estimate.`,
  ];
  const cityTag = place.replace(/[^a-zA-Z]/g, '');
  const serviceTag = job.service_type.replace('_', '');
  return {
    title,
    content: lines.join('\n\n'),
    hashtags: [`#${serviceTag}`, `#${cityTag}`, '#beforeandafter', '#localbusiness'],
    keywords: [service, `${service} ${place}`, `${service} near me`],
    location: [job.city].filter(Boolean).join(', '),
  };
}

export interface QueuedPost {
  id: string;
  title: string;
  platform: string;
  status: string;
  created_at: string;
}

/**
 * The publish queue — what the syndication pipeline has picked up or will.
 *
 * In demo mode there is no pipeline, so this replays the on-device records.
 * Screens render `status` verbatim as a badge, so it says 'demo' rather than
 * 'scheduled': nothing is actually waiting to go out to Google.
 */
export async function fetchRecentPosts(): Promise<QueuedPost[]> {
  if (!isSupabaseConfigured) {
    const records = await getPublished();
    return records.slice(0, 10).map((record) => ({
      id: record.job_id,
      title: record.title,
      platform: 'gmb',
      status: 'demo',
      created_at: record.published_at,
    }));
  }
  const { data, error } = await supabase
    .from('social_media_posts')
    .select('id, title, platform, status, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ''),
    platform: String(row.platform ?? 'gmb'),
    status: String(row.status ?? 'draft'),
    created_at: String(row.created_at ?? ''),
  }));
}

async function getPublished(): Promise<PublishRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PublishRecord[]) : [];
  } catch {
    return [];
  }
}

export async function getPublishRecord(jobId: string): Promise<PublishRecord | undefined> {
  const all = await getPublished();
  return all.find((record) => record.job_id === jobId);
}

async function savePublishRecord(record: PublishRecord): Promise<void> {
  const all = await getPublished();
  const next = [record, ...all.filter((r) => r.job_id !== record.job_id)];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
}

const WEBHOOK_DETAIL: Record<WebhookOutcome, string> = {
  sent: 'Handed off to your automation workflow.',
  failed: 'The delivery request was rejected — nothing was sent.',
  'not-configured': 'No publish connection is set up, so nothing was sent.',
};

/**
 * Demo-mode copy. Nothing is connected, so each destination says plainly that
 * no post was made — this must never read as a real post to Google or a real
 * automation run.
 */
const DEMO_DETAIL: Record<Destination, string> = {
  gmb: 'Demo mode — nothing was posted to Google. Sample result only.',
  website: 'Demo mode — nothing was sent to your website. Sample result only.',
  gohighlevel: 'Demo mode — no GoHighLevel workflow ran. Sample result only.',
};

/** Statuses worth keeping in the on-device record the job screen reads. */
function isRecorded(status: DeliveryStatus): boolean {
  return isDelivered(status) || status === 'demo';
}

/** Fire the web app's Automation workflow webhook (website/GHL delivery). */
async function fireWorkflowWebhook(payload: Record<string, unknown>): Promise<WebhookOutcome> {
  if (!API_BASE || !PUBLISH_WEBHOOK_ID) return 'not-configured';
  try {
    const response = await fetch(
      `${API_BASE.replace(/\/$/, '')}/api/workflows/webhook/${PUBLISH_WEBHOOK_ID}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    return response.ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

export interface PublishOutcome {
  error?: string;
  /** One entry per chosen destination; empty when publishing errored out. */
  results: DestinationResult[];
}

export async function publishJob(options: {
  job: Job;
  media: MediaItem[];
  destinations: Destination[];
  content: PublishContent;
}): Promise<PublishOutcome> {
  const { job, media, destinations, content } = options;
  const now = new Date().toISOString();
  const business = await workspace.getCurrent();
  const imageUrls = media.map((item) => item.uri).filter(Boolean) as string[];
  // Only true once a social_media_posts row really exists for this job.
  let gmbQueued = false;

  if (isSupabaseConfigured) {
    // Queue the GMB post into the same table the web pipeline reads.
    if (destinations.includes('gmb')) {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        return { error: 'Sign in with your real account to publish.', results: [] };
      }
      const { error } = await supabase.from('social_media_posts').insert({
        user_id: auth.user.id,
        title: content.title,
        platform: 'gmb',
        content: `${content.content}\n\n${content.hashtags.join(' ')}`,
        hashtags: content.hashtags,
        target_keywords: content.keywords,
        target_location: content.location,
        generation_method: 'manual',
        images: imageUrls.map((url) => ({ url })),
        primary_image_url: imageUrls[0] ?? null,
        scheduled_for: now,
        status: 'scheduled',
      });
      if (error) return { error: error.message, results: [] };
      gmbQueued = true;
    }

    // Mark the job completed (web Project shape: status + completed_at).
    await supabase
      .from('jobs')
      .update({ status: 'completed', completed_at: now })
      .eq('id', job.id);
  } else {
    await jobsStore.updateStatus(job.id, 'completed');
  }

  const webhookOutcome = await fireWorkflowWebhook({
    event: 'job.completed',
    job_id: job.id,
    title: job.title,
    business: business?.name,
    city: job.city,
    service_type: job.service_type,
    destinations,
    post: { title: content.title, content: content.content, hashtags: content.hashtags },
    images: imageUrls,
    completed_at: now,
  });

  const results: DestinationResult[] = destinations.map((destination) => {
    if (destination === 'gmb' && gmbQueued) {
      return {
        destination,
        status: 'queued',
        detail: 'Added to your posting queue — your web app publishes it.',
      };
    }
    // Nothing is connected: this is demo mode, not a delivery failure. Report
    // it as demo rather than pretending either way.
    if (webhookOutcome === 'not-configured' && !isSupabaseConfigured) {
      return { destination, status: 'demo', detail: DEMO_DETAIL[destination] };
    }
    return { destination, status: webhookOutcome, detail: WEBHOOK_DETAIL[webhookOutcome] };
  });

  // Record what genuinely went somewhere — plus demo results, so the demo flow
  // is complete. A real destination we never reached is still left out, so the
  // job screen cannot show a "Published to…" badge we did not earn.
  const recorded = results.filter((result) => isRecorded(result.status));
  if (recorded.length > 0) {
    await savePublishRecord({
      job_id: job.id,
      destinations: recorded.map((result) => result.destination),
      published_at: now,
      title: content.title,
    });
  }
  jobsStore.notifyChanged();

  return { results };
}
