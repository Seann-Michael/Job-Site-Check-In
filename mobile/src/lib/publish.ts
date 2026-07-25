/**
 * Complete & Publish — the CompanyCam-style payoff: when a job is done, its
 * photos and details are pushed out for local SEO.
 *
 * Destinations:
 *  - Google Business Profile: inserts a social_media_posts row (platform
 *    'gmb', status 'scheduled') — the web app's syndication pipeline picks
 *    it up and posts it.
 *  - Website + GoHighLevel: delivered by the web app's Automation workflows.
 *    When EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_PUBLISH_WEBHOOK_ID are
 *    set, the app fires the workflow webhook directly; otherwise the
 *    completed-job payload is recorded and the web automations take over.
 *
 * A local record of every publication is kept on-device so the job screen
 * can show what went where.
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

export interface PublishRecord {
  job_id: string;
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

/** The publish queue — what the syndication pipeline has picked up or will. */
export async function fetchRecentPosts(): Promise<QueuedPost[]> {
  if (!isSupabaseConfigured) {
    const records = await getPublished();
    return records.slice(0, 10).map((record) => ({
      id: record.job_id,
      title: record.title,
      platform: 'gmb',
      status: 'scheduled',
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

/** Fire the web app's Automation workflow webhook (website/GHL delivery). */
async function fireWorkflowWebhook(payload: Record<string, unknown>): Promise<boolean> {
  if (!API_BASE || !PUBLISH_WEBHOOK_ID) return false;
  try {
    const response = await fetch(
      `${API_BASE.replace(/\/$/, '')}/api/workflows/webhook/${PUBLISH_WEBHOOK_ID}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );
    return response.ok;
  } catch {
    return false;
  }
}

export async function publishJob(options: {
  job: Job;
  media: MediaItem[];
  destinations: Destination[];
  content: PublishContent;
}): Promise<{ error?: string; webhookFired?: boolean }> {
  const { job, media, destinations, content } = options;
  const now = new Date().toISOString();
  const business = await workspace.getCurrent();
  const imageUrls = media.map((item) => item.uri).filter(Boolean) as string[];

  if (isSupabaseConfigured) {
    // Queue the GMB post into the same table the web pipeline reads.
    if (destinations.includes('gmb')) {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return { error: 'Sign in with your real account to publish.' };
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
      if (error) return { error: error.message };
    }

    // Mark the job completed (web Project shape: status + completed_at).
    await supabase
      .from('jobs')
      .update({ status: 'completed', completed_at: now })
      .eq('id', job.id);
  } else {
    await jobsStore.updateStatus(job.id, 'completed');
  }

  const webhookFired = await fireWorkflowWebhook({
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

  await savePublishRecord({
    job_id: job.id,
    destinations,
    published_at: now,
    title: content.title,
  });
  jobsStore.notifyChanged();

  return { webhookFired };
}
