/**
 * Project shares — the mobile client for /api/shares.
 *
 * One call sends a project's photos and caption to every destination the
 * business has turned on, and the server reports back per destination. This
 * replaces the old two-path publish (web-app handoff vs. direct Google post).
 */
import { apiErrorMessage, apiFetch } from '@/lib/api';
import { isApiConfigured } from '@/lib/config';
import type { Job, MediaItem } from '@/lib/types';

export type ShareDestination = 'gbp' | 'facebook' | 'instagram' | 'website';
export const SHARE_DESTINATIONS: ShareDestination[] = ['gbp', 'facebook', 'instagram', 'website'];
export const SHARE_LABELS: Record<ShareDestination, string> = {
  gbp: 'Google',
  facebook: 'Facebook',
  instagram: 'Instagram',
  website: 'Website',
};

export type ShareStatus = 'draft' | 'queued' | 'processing' | 'done' | 'partial' | 'failed';
export type DeliveryStatus = 'pending' | 'live' | 'failed' | 'not_configured' | 'skipped';

export interface DeliveryResult {
  status: DeliveryStatus;
  detail: string;
  external_id?: string;
  url?: string;
  at: string;
}

export interface ShareCaption {
  title?: string;
  gbp?: string;
  facebook?: string;
  instagram?: string;
  website?: string;
  hashtags?: string[];
}

export interface ProjectShare {
  id: string;
  business_id: string;
  job_id: string;
  media_ids: string[];
  destinations: ShareDestination[];
  caption: ShareCaption;
  options: Record<string, unknown>;
  status: ShareStatus;
  scheduled_for: string | null;
  finished_at: string | null;
  results: Partial<Record<ShareDestination, DeliveryResult>>;
  attempts: number;
  created_at: string;
  updated_at: string;
}

export interface ShareSettings {
  destinations?: Partial<Record<ShareDestination, boolean>>;
  after_capture?: 'ask' | 'auto' | 'queue';
  website_workflow_id?: string;
  max_photos?: number;
  hashtags?: boolean;
  caption?: { tone?: 'plain' | 'friendly' | 'professional'; always_mention?: string; never_say?: string[] };
  facebook?: { connected: boolean; page_name?: string | null };
  instagram?: { connected: boolean; username?: string | null };
}

export const DEFAULT_SHARE_SETTINGS: Required<Pick<ShareSettings, 'destinations' | 'after_capture' | 'max_photos' | 'hashtags'>> = {
  destinations: { gbp: true, facebook: false, instagram: false, website: true },
  after_capture: 'ask',
  max_photos: 6,
  hashtags: true,
};

export const isSharingAvailable = isApiConfigured;

export async function fetchShareSettings(businessId: string): Promise<ShareSettings> {
  const data = await apiFetch<{ settings: ShareSettings }>(`/api/shares/settings/${encodeURIComponent(businessId)}`);
  return data?.settings ?? {};
}

export async function updateShareSettings(businessId: string, patch: Partial<ShareSettings>): Promise<void> {
  await apiFetch(`/api/shares/settings/${encodeURIComponent(businessId)}`, { method: 'PATCH', body: patch });
}

export async function fetchShares(
  businessId: string,
  filter: 'waiting' | 'shared' | ShareStatus | '' = '',
  jobId?: string,
): Promise<ProjectShare[]> {
  const q = new URLSearchParams({ businessId });
  if (filter) q.set('status', filter);
  if (jobId) q.set('jobId', jobId);
  const data = await apiFetch<{ shares: ProjectShare[] }>(`/api/shares?${q.toString()}`);
  return Array.isArray(data?.shares) ? data.shares : [];
}

export interface CreateShareInput {
  job: Job;
  media: MediaItem[];
  destinations: ShareDestination[];
  caption: ShareCaption;
  run: 'now' | 'queue' | 'draft';
  markComplete?: boolean;
  websiteWorkflowId?: string;
}

export async function createShare(input: CreateShareInput): Promise<{ share: ProjectShare; warning?: string }> {
  return apiFetch<{ share: ProjectShare; warning?: string }>('/api/shares', {
    method: 'POST',
    body: {
      jobId: input.job.id,
      mediaIds: input.media.filter((m) => !m.id.startsWith('local-')).map((m) => m.id),
      destinations: input.destinations,
      caption: input.caption,
      run: input.run,
      markComplete: Boolean(input.markComplete),
      ...(input.websiteWorkflowId ? { websiteWorkflowId: input.websiteWorkflowId } : {}),
    },
  });
}

export async function runShare(id: string): Promise<ProjectShare> {
  const data = await apiFetch<{ share: ProjectShare }>(`/api/shares/${encodeURIComponent(id)}/run`, { method: 'POST' });
  return data.share;
}

export async function deleteShare(id: string): Promise<void> {
  await apiFetch(`/api/shares/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

// ── AI caption ────────────────────────────────────────────────────────────────

export interface CaptionFacts {
  businessName: string;
  service: string;
  stage: 'before' | 'progress' | 'after' | 'final';
  city?: string;
  state?: string;
  keywords?: string[];
  onSiteMinutes?: number;
  checklistDone?: number;
  checklistTotal?: number;
  photoCounts?: Partial<Record<'before' | 'progress' | 'after' | 'final', number>>;
  materials?: string[];
  note?: string;
  tone?: 'plain' | 'friendly' | 'professional';
  alwaysMention?: string;
  neverSay?: string[];
  hashtags?: boolean;
}

export async function draftCaption(facts: CaptionFacts): Promise<ShareCaption> {
  return apiFetch<ShareCaption>('/api/ai/caption', { method: 'POST', body: facts as unknown as Record<string, unknown> });
}

/**
 * Offline fallback used when the AI endpoint is unreachable: the same facts,
 * assembled plainly, so the user always has something to edit.
 */
export function plainCaption(facts: CaptionFacts): ShareCaption {
  const where = facts.city ? ` in ${facts.city}${facts.state ? `, ${facts.state}` : ''}` : '';
  const stage =
    facts.stage === 'before' ? 'getting started on' : facts.stage === 'progress' ? 'underway on' : 'finished';
  const lead = facts.stage === 'after' || facts.stage === 'final'
    ? `${facts.businessName} just finished a ${facts.service.toLowerCase()}${where}.`
    : `${facts.businessName} is ${stage} a ${facts.service.toLowerCase()}${where}.`;
  const bits: string[] = [];
  if (facts.onSiteMinutes && facts.onSiteMinutes > 0) {
    const h = Math.floor(facts.onSiteMinutes / 60);
    const m = facts.onSiteMinutes % 60;
    bits.push(`${h > 0 ? `${h}h ` : ''}${m}m on site`);
  }
  if (facts.checklistTotal) bits.push(`${facts.checklistDone ?? 0} of ${facts.checklistTotal} checklist items done`);
  const body = [lead, bits.length ? bits.join(', ') + '.' : '', facts.alwaysMention ?? ''].filter(Boolean).join(' ');
  const tags = facts.hashtags === false ? [] : [facts.city, facts.service, facts.businessName].filter(Boolean).map((t) => String(t).replace(/[^\w]/g, ''));
  return { title: `${facts.service}${where}`, gbp: body, facebook: body, instagram: body, website: body, hashtags: tags };
}

export function shareStatusLabel(share: ProjectShare): { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' } {
  switch (share.status) {
    case 'done':
      return { label: 'Shared', tone: 'success' };
    case 'partial':
      return { label: 'Partly shared', tone: 'warning' };
    case 'processing':
      return { label: 'Sending', tone: 'neutral' };
    case 'queued':
      return { label: share.attempts > 0 ? 'Retrying' : 'Queued', tone: 'warning' };
    case 'failed':
      return { label: 'Failed', tone: 'danger' };
    default:
      return { label: 'Draft', tone: 'neutral' };
  }
}

export function describeShareError(error: unknown): string {
  return apiErrorMessage(error, 'Could not reach the sharing service.');
}
