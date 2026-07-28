/**
 * Complete & Publish — the CompanyCam-style payoff: when a job is done, its
 * photos and details are handed to the web app for local SEO.
 *
 * ── What this module is, and what it is not ────────────────────────────────
 * The mobile app does NOT post anywhere itself. It is a client for our web
 * app, and the web app decides how and where a post is actually published. So
 * this file does exactly four things:
 *
 *   1. Builds the post copy from job facts (buildPublishContent).
 *   2. Runs the privacy gate over it (scrubPublishText + the photo release).
 *   3. Takes a human's edit-and-approve.
 *   4. Hands the approved payload to the web app's API, and reports back
 *      exactly what the server said.
 *
 * There is deliberately no platform integration here: no Google, Facebook or
 * GoHighLevel API call, no posting credentials in the client bundle, and no
 * decision about which network a destination maps to. The `destinations` the
 * user picks are *requests* carried in the payload; the web app fulfils them.
 *
 * ── The handoff ────────────────────────────────────────────────────────────
 * POST {EXPO_PUBLIC_API_BASE_URL}/api/workflows/webhook/{EXPO_PUBLIC_PUBLISH_WEBHOOK_ID}
 * — the same endpoint the rest of this product's automations use (see
 * server/routes/workflows.ts). Without both variables there is no route off
 * the device: nothing is uploaded, nothing is sent, and every destination says
 * so in as many words.
 *
 * The job is always marked completed, but delivery is reported per
 * destination and only destinations the server actually accepted are written
 * to the on-device record the job screen reads. We never claim a delivery we
 * did not observe: when the server returns its own per-destination breakdown
 * we render that verbatim, and otherwise we report the transport result and
 * nothing more.
 *
 * Demo mode (nothing configured at all) is the one exception, and works like
 * the rest of the app: there is nothing to hand off to, so every destination
 * reports 'demo' — spelled out as demo behaviour wherever it is shown — and
 * the record is still written so the job screen's Published section works. A
 * demo result never reports 'sent' or 'queued', and never touches the network.
 *
 * ── Two gates stand in front of every publish ──────────────────────────────
 * 1. HUMAN REVIEW. publishJob refuses unless `approved` is true, which the
 *    publish screen only sets after someone has read the copy.
 * 2. PRIVACY. Copy is scrubbed of the client's name, street address, phone
 *    and email (see scrubPublishText) — again here, not only in the UI, so no
 *    caller can route around it. Only city/state/ZIP are published. Photos are
 *    re-encoded to strip EXIF (including GPS) before they leave, and no photo
 *    is published at all without a per-job photo release.
 *
 * ── Order of operations matters ────────────────────────────────────────────
 * Sanitising photos re-encodes them AND uploads the clean copies to Storage,
 * so it runs LAST: after every gate has passed and after we know there is a
 * live route off the device. If the web app then refuses the handoff, the
 * copies it just uploaded are deleted again. A failed publish must not strand
 * images in Storage with nothing referencing them, and a user retrying must
 * not pile up a fresh orphan set each time.
 *
 * The one case that is deliberately NOT cleaned up is a request that timed out
 * or lost the network: the server may have taken the post regardless, and
 * deleting its images would break a post that is on its way out.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import { Platform } from 'react-native';

import { jobsStore } from '@/lib/jobs-store';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { workspace } from '@/lib/workspace';
import type { Job, MediaCategory, MediaItem } from '@/lib/types';

const STORAGE_KEY = 'lsr-published-jobs-v1';
const RELEASE_KEY = 'lsr-job-photo-release-v1';
const API_BASE = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();
const PUBLISH_WEBHOOK_ID = (process.env.EXPO_PUBLIC_PUBLISH_WEBHOOK_ID ?? '').trim();

/** A hung request must not leave the publish screen spinning forever. */
const REQUEST_TIMEOUT_MS = 20_000;

/** Both halves of the address are needed before anything can leave here. */
const isPublishApiConfigured = Boolean(API_BASE && PUBLISH_WEBHOOK_ID);

/** The one URL this client talks to. Null when it is not configured. */
function publishApiUrl(): string | null {
  if (!isPublishApiConfigured) return null;
  return `${API_BASE.replace(/\/+$/, '')}/api/workflows/webhook/${encodeURIComponent(
    PUBLISH_WEBHOOK_ID,
  )}`;
}

/** Most platforms cap a post's gallery well below this; so does the UI. */
const MAX_PUBLISHED_PHOTOS = 10;

/**
 * Where the user asked this job to end up. These are requests we forward, not
 * integrations we implement: the mobile client has no idea how the web app
 * reaches Google, a website or GoHighLevel, and deliberately must not.
 */
export type Destination = 'gmb' | 'website' | 'gohighlevel';

export const DESTINATION_LABELS: Record<Destination, string> = {
  gmb: 'Google Business Profile',
  website: 'Website',
  gohighlevel: 'GoHighLevel',
};

/**
 * What actually happened for one destination.
 *  - 'queued'         — the web app accepted the handoff and gave us a
 *                       reference for the run it created.
 *  - 'sent'           — the web app accepted the handoff.
 *  - 'failed'         — we tried to hand it off and the attempt was rejected.
 *  - 'not-configured' — there is no web app address, so nothing was sent.
 *  - 'demo'           — nothing is connected at all, so this is demo behaviour
 *                       and no post was made anywhere.
 *
 * Note what none of these say: that a post is live on Google. Only the web app
 * knows that, and only it may report it.
 */
export type DeliveryStatus = 'queued' | 'sent' | 'failed' | 'not-configured' | 'demo';

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

// ───────────────────────────── privacy gate ──────────────────────────────

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Street-address shapes, so a hand-typed address is caught too. */
const STREET_PATTERN =
  /\b\d{1,6}\s+[A-Za-z0-9'.-]+(?:\s+[A-Za-z0-9'.-]+)?\s+(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|blvd|boulevard|way|ct|court|pl|place|ter|terrace|cir|circle|hwy|highway|pkwy|parkway|trl|trail)\b\.?/gi;
const PHONE_PATTERN = /(?:\+?\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/g;

export interface PrivacyRedaction {
  /** What was taken out, e.g. 'Client name'. */
  label: string;
  /** How many occurrences were removed. */
  count: number;
}

export interface ScrubResult {
  text: string;
  redactions: PrivacyRedaction[];
}

function tidy(text: string): string {
  return text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,!?;:])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Remove personally identifying details from post copy. This runs on the
 * generated text AND on whatever a human typed over it, and it runs again
 * inside publishJob so nothing can leave without passing through it.
 *
 * Deliberately over-eager: a mangled sentence the reviewer can fix is a far
 * cheaper mistake than publishing a customer's address.
 */
export function scrubPublishText(text: string, job: Job): ScrubResult {
  const redactions: PrivacyRedaction[] = [];
  let out = text;

  const apply = (pattern: RegExp, replacement: string, label: string) => {
    const matches = out.match(pattern);
    if (!matches || matches.length === 0) return;
    out = out.replace(pattern, replacement);
    const existing = redactions.find((entry) => entry.label === label);
    if (existing) existing.count += matches.length;
    else redactions.push({ label, count: matches.length });
  };

  // The client's own name, then its individual parts. Short parts are left
  // alone — a 3-letter surname would shred ordinary words.
  const clientName = (job.client_name ?? '').trim();
  if (clientName) {
    apply(new RegExp(escapeRegExp(clientName), 'gi'), 'our customer', 'Client name');
    for (const part of clientName.split(/\s+/)) {
      if (part.length >= 4) {
        apply(new RegExp(`\\b${escapeRegExp(part)}\\b`, 'gi'), 'our customer', 'Client name');
      }
    }
  }

  // The stored address, its street line, and any address-shaped text.
  const address = (job.address ?? '').trim();
  const place = (job.city ?? '').trim();
  if (address) {
    apply(new RegExp(escapeRegExp(address), 'gi'), place, 'Street address');
    const streetLine = address.split(',')[0]?.trim();
    if (streetLine && streetLine.length >= 4 && streetLine !== place) {
      apply(new RegExp(escapeRegExp(streetLine), 'gi'), place, 'Street address');
    }
  }
  apply(STREET_PATTERN, place || '', 'Street address');

  const phone = (job.client_phone ?? '').trim();
  if (phone) apply(new RegExp(escapeRegExp(phone), 'gi'), '', 'Phone number');
  apply(PHONE_PATTERN, '', 'Phone number');

  const email = (job.client_email ?? '').trim();
  if (email) apply(new RegExp(escapeRegExp(email), 'gi'), '', 'Email address');
  apply(EMAIL_PATTERN, '', 'Email address');

  return { text: tidy(out), redactions };
}

/** Merge two redaction lists (title + body) into one summary. */
function mergeRedactions(...lists: PrivacyRedaction[][]): PrivacyRedaction[] {
  const merged: PrivacyRedaction[] = [];
  for (const list of lists) {
    for (const entry of list) {
      const existing = merged.find((item) => item.label === entry.label);
      if (existing) existing.count += entry.count;
      else merged.push({ ...entry });
    }
  }
  return merged;
}

/** Location we are willing to publish: city/state/ZIP, never the street. */
function publishableLocation(job: Job): string {
  const cityState = [job.city, job.state].filter(Boolean).join(', ');
  return [cityState, job.zip].filter(Boolean).join(' ').trim();
}

// ──────────────────────── per-job photo release ──────────────────────────

export interface PhotoRelease {
  granted: boolean;
  granted_at: string;
  /** Who ticked it, when we know. */
  granted_by?: string;
}

type ReleaseMap = Record<string, PhotoRelease>;

async function loadReleases(): Promise<ReleaseMap> {
  try {
    const raw = await AsyncStorage.getItem(RELEASE_KEY);
    return raw ? (JSON.parse(raw) as ReleaseMap) : {};
  } catch {
    return {};
  }
}

/** Undefined means nobody has answered yet — that is not consent. */
export async function getPhotoRelease(jobId: string): Promise<PhotoRelease | undefined> {
  const all = await loadReleases();
  return all[jobId];
}

export async function setPhotoRelease(
  jobId: string,
  granted: boolean,
  grantedBy?: string,
): Promise<PhotoRelease> {
  const all = await loadReleases();
  const record: PhotoRelease = {
    granted,
    granted_at: new Date().toISOString(),
    granted_by: grantedBy,
  };
  all[jobId] = record;
  await AsyncStorage.setItem(RELEASE_KEY, JSON.stringify(all)).catch(() => undefined);
  return record;
}

// ───────────────────────── fact-based copy ───────────────────────────────

/**
 * Materials and components worth naming in a post. A fixed vocabulary is the
 * whole point: notes are free text that may contain the customer's name or
 * address, so we only ever lift terms that appear on this list — never a
 * sentence or phrase copied out of a note.
 */
const MATERIAL_TERMS = [
  'K-style gutter',
  'half-round gutter',
  'seamless gutter',
  'gutter guard',
  'leaf guard',
  'downspout',
  'fascia',
  'soffit',
  'drip edge',
  'aluminum',
  'copper pipe',
  'copper',
  'galvanized steel',
  'vinyl',
  'French drain',
  'catch basin',
  'dry well',
  'sump pump',
  'corrugated pipe',
  'PVC',
  'PEX',
  'gravel',
  'landscape fabric',
  'asphalt shingle',
  'architectural shingle',
  'ridge vent',
  'ice and water shield',
  'underlayment',
  'flashing',
  'metal roofing',
  'water heater',
  'shut-off valve',
  'backflow preventer',
  'mulch',
  'topsoil',
  'sod',
  'river rock',
  'paver',
  'retaining wall block',
  'primer',
  'latex paint',
  'caulk',
  'sealant',
  'silicone',
  'stain',
  'rock salt',
  'calcium chloride',
  'ice melt',
  'concrete',
  'rebar',
  'lumber',
  'plywood',
];

/** Terms from the fixed vocabulary that genuinely appear in the notes. */
function materialsFromNotes(notes: { text: string }[]): string[] {
  const haystack = notes.map((note) => note.text ?? '').join(' \n ');
  if (!haystack.trim()) return [];
  const hits = MATERIAL_TERMS.filter((term) =>
    new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(haystack),
  );
  // 'copper pipe' already says 'copper' — drop the term the longer one covers.
  const specific = hits.filter(
    (term) => !hits.some((other) => other !== term && other.toLowerCase().includes(term.toLowerCase())),
  );
  return specific.slice(0, 4);
}

/** Total minutes on site across check-ins that were actually closed out. */
function onSiteMinutes(checkins: { checked_in_at: string; checked_out_at?: string }[]): number {
  let total = 0;
  for (const visit of checkins) {
    if (!visit.checked_out_at) continue;
    const start = new Date(visit.checked_in_at).getTime();
    const end = new Date(visit.checked_out_at).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) continue;
    total += Math.round((end - start) / 60_000);
  }
  return total;
}

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} minutes`;
  if (rest === 0) return hours === 1 ? '1 hour' : `${hours} hours`;
  return `${hours}h ${rest}m`;
}

const PHASE_LABELS: Record<MediaCategory, string> = {
  before: 'before',
  progress: 'in progress',
  after: 'after',
  final: 'finished',
};

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** The job facts the copy is built from — shown to the reviewer as evidence. */
export interface PublishFacts {
  /** Minutes on site across closed check-ins; 0 when none were recorded. */
  onSiteMinutes: number;
  completedTasks: string[];
  taskCount: number;
  /** Photo count per phase; only phases with photos appear. */
  photosByPhase: { phase: MediaCategory; label: string; count: number }[];
  photoCount: number;
  /** Vocabulary terms found in the job's notes. */
  materials: string[];
}

export interface PublishContentInput {
  job: Job;
  businessName: string;
  /** Photos being published (the selection, not the whole job). */
  media: Pick<MediaItem, 'category' | 'media_type'>[];
  tasks: { label: string; done: boolean }[];
  checkins: { checked_in_at: string; checked_out_at?: string }[];
  notes: { text: string }[];
}

/** Everything the generator knows about this job, gathered in one place. */
export function collectPublishFacts(input: PublishContentInput): PublishFacts {
  const images = input.media.filter((item) => item.media_type !== 'video');
  const counts = new Map<MediaCategory, number>();
  for (const item of images) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  const order: MediaCategory[] = ['before', 'progress', 'after', 'final'];
  return {
    onSiteMinutes: onSiteMinutes(input.checkins),
    completedTasks: input.tasks.filter((task) => task.done).map((task) => task.label),
    taskCount: input.tasks.length,
    photosByPhase: order
      .filter((phase) => (counts.get(phase) ?? 0) > 0)
      .map((phase) => ({ phase, label: PHASE_LABELS[phase], count: counts.get(phase) ?? 0 })),
    photoCount: images.length,
    materials: materialsFromNotes(input.notes),
  };
}

/**
 * Local-SEO post copy written from what the crew actually recorded: time on
 * site, checklist items ticked off, photos by phase, and materials named in
 * the notes. Every block is dropped when its fact is missing, so a job with no
 * check-ins and no checklist produces a short honest post rather than an
 * invented one.
 *
 * The result is already privacy-scrubbed, and it is a starting point: a human
 * edits and approves it on the publish screen before anything is sent.
 */
export function buildPublishContent(input: PublishContentInput): PublishContent {
  const { job, businessName } = input;
  const facts = collectPublishFacts(input);
  const service = SERVICE_LABELS[job.service_type] ?? 'home services';
  const place = job.city || 'your area';
  const blocks: string[] = [];

  blocks.push(`✅ ${service.charAt(0).toUpperCase()}${service.slice(1)} in ${place} — job complete.`);

  // What was done: time on site and the checklist, only when recorded.
  const workLines: string[] = [];
  if (facts.onSiteMinutes > 0) {
    workLines.push(`Our crew was on site for ${formatMinutes(facts.onSiteMinutes)}.`);
  }
  if (facts.completedTasks.length > 0) {
    workLines.push(
      `${facts.completedTasks.length} of ${facts.taskCount} steps on our field checklist signed off:`,
    );
  }
  if (workLines.length > 0) {
    blocks.push(
      [workLines.join(' '), ...facts.completedTasks.map((label) => `• ${label}`)].join('\n'),
    );
  }

  if (facts.materials.length > 0) {
    blocks.push(`Materials on this job: ${joinList(facts.materials)}.`);
  }

  if (facts.photoCount > 0) {
    const breakdown = facts.photosByPhase.map((entry) => `${entry.count} ${entry.label}`);
    blocks.push(
      `${facts.photoCount} photo${facts.photoCount === 1 ? '' : 's'} from the job${
        breakdown.length > 1 ? ` — ${joinList(breakdown)}` : ''
      }.`,
    );
  }

  blocks.push(
    `Need ${service} in ${place}? ${businessName} works right here in the area — get in touch for a free estimate.`,
  );

  const cityTag = place.replace(/[^a-zA-Z]/g, '');
  const serviceTag = job.service_type.replace(/_/g, '');
  const hashtags = [`#${serviceTag}`, cityTag ? `#${cityTag}` : '', '#localbusiness'].filter(Boolean);
  if (facts.photosByPhase.some((entry) => entry.phase === 'before')) {
    hashtags.splice(2, 0, '#beforeandafter');
  }

  // Straight off the job the caller already passed. This used to be a separate
  // `input.keywords` that nothing ever filled, so the operator's own keywords
  // were silently dropped from every post; `Job.keywords` is the one source.
  const jobKeywords = (job.keywords ?? []).map((word) => word.trim()).filter(Boolean);
  const keywords = [...new Set([...jobKeywords, service, `${service} ${place}`, `${service} near me`])];

  // Scrub before anyone ever sees it: the job title routinely carries the
  // customer's name ("Smith residence — gutter replacement").
  const title = scrubPublishText(`${job.title} — completed in ${place}`, job).text;
  const content = scrubPublishText(blocks.join('\n\n'), job).text;

  return {
    title,
    content,
    hashtags,
    keywords,
    location: publishableLocation(job),
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
 * How many of the workspace's jobs a post is matched against. Deliberately
 * larger than the ten posts shown and than the 50 jobs the jobs tab lists: a
 * post can belong to a job that has long scrolled off that list.
 */
const POST_SCOPE_JOB_LIMIT = 200;

/**
 * Ids of the current business's jobs — the only tenant filter this client can
 * put in front of `social_media_posts`.
 *
 * The posts table carries no business column: before the publishing migration
 * it has a `user_id` and nothing else tying a row to a tenant, and after it the
 * scope column is `company_id`, which sits ABOVE `businesses` and which this
 * client cannot resolve (workspace.ts never reads it). What CAN be proved is
 * the job a post was published from, exactly the way lib/team-presence.ts
 * scopes check-ins, so that is what is used. Jobs themselves are scoped by
 * `business_id`, the same filter fetchJobs() in lib/data.ts applies.
 *
 * Null means the scope could not be established and the caller must not read
 * the posts table at all — an unscoped read is the leak, not the empty list.
 */
async function workspaceJobIds(): Promise<string[] | null> {
  const business = await workspace.getCurrent();
  // No business yet, or the sample placeholder workspace.getBusinesses() stands
  // in when the businesses table comes back empty. Neither can be used to prove
  // a row belongs here, and a demo business owns no real rows of its own.
  if (!business || business.id.startsWith('demo')) return null;
  const { data, error } = await supabase
    .from('jobs')
    .select('id')
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(POST_SCOPE_JOB_LIMIT);
  // A failed scope query is not an empty workspace — refuse rather than fall
  // back to an unscoped read of the posts table.
  if (error) return null;
  return ((data ?? []) as { id: unknown }[]).map((row) => String(row.id));
}

/**
 * The publish queue — what the web app's syndication pipeline has picked up or
 * will. READ ONLY from here: this client never writes a row into it. The web
 * app owns that table and decides what goes into it, and this just renders
 * back whatever it finds.
 *
 * SCOPED TO THE CURRENT BUSINESS. `social_media_posts` is a shared table, so an
 * unfiltered read hands back every tenant's rows: the Activity screen counts
 * them in its "Recent posts" tile and renders their titles as this workspace's
 * publishes. Only posts belonging to this business's jobs are shown (see
 * workspaceJobIds), and when that scope cannot be established the answer is
 * nothing at all — an empty tile is a small problem, another company's post
 * titles inside this one's timeline is not.
 *
 * `select('*')` and a `job_id` filter, not a named column list: on a database
 * where the posts table has no `job_id` — or is not there at all, which is the
 * case until the publishing migration runs — the query simply fails and this
 * returns empty, which is the same empty tile that database shows today. It
 * never widens the read to compensate.
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
  const jobIds = await workspaceJobIds();
  // Unknown scope, or a workspace with no jobs: there is nothing here this
  // client can show and prove is its own, so it shows nothing. Never demo rows
  // either — Supabase IS configured, and a fabricated post is worse than none.
  if (!jobIds?.length) return [];
  const { data, error } = await supabase
    .from('social_media_posts')
    .select('*')
    .in('job_id', jobIds)
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

/**
 * Demo-mode copy. Nothing is connected, so each destination says plainly that
 * no post was made — this must never read as a real post to Google or a real
 * automation run.
 */
const DEMO_DETAIL: Record<Destination, string> = {
  gmb: 'Demo mode — nothing was posted to Google. Sample result only.',
  website: 'Demo mode — nothing was sent to your website. Sample result only.',
  gohighlevel: 'Demo mode — nothing was posted to GoHighLevel. Sample result only.',
};

/** Said when there is no web app address, so the handoff never happened. */
const NOT_CONFIGURED_DETAIL =
  'This build has no web app address, so nothing was sent. Set EXPO_PUBLIC_API_BASE_URL and EXPO_PUBLIC_PUBLISH_WEBHOOK_ID to publish for real.';

/** Statuses worth keeping in the on-device record the job screen reads. */
function isRecorded(status: DeliveryStatus): boolean {
  return isDelivered(status) || status === 'demo';
}

// ─────────────────── EXIF stripping for published photos ─────────────────

interface SanitizedPhotos {
  /** Publicly reachable URLs of re-encoded, metadata-free copies. */
  urls: string[];
  /**
   * Storage keys behind `urls`, in the same order. Kept so a publish that
   * fails after uploading can delete exactly what it created — see
   * discardUploadedPhotos.
   */
  keys: string[];
  /** Photos that could not be sanitized, so they were left out entirely. */
  skipped: number;
  /** Ready-to-render sentence, present only when something was left out. */
  note?: string;
}

/** Bytes for a local file, on whichever platform we are running. */
async function readLocalBytes(uri: string): Promise<ArrayBuffer | Blob> {
  if (Platform.OS !== 'web' && uri.startsWith('file:')) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return decode(base64);
  }
  const response = await fetch(uri);
  return await response.blob();
}

/**
 * Re-encode every published photo and re-host the clean copy.
 *
 * Re-encoding through ImageManipulator decodes to a bitmap and writes a fresh
 * JPEG, which drops the EXIF block — GPS included — on native and on web
 * (canvas). The sanitized copy is uploaded under `published/`, and that URL is
 * what goes out; the original object, which may still carry metadata, is never
 * handed to a publishing destination.
 *
 * A photo we cannot sanitize is not published. Silently sending the original
 * would defeat the whole gate, so it is dropped and counted.
 *
 * This uploads, so publishJob only calls it once every gate has passed and a
 * route off the device exists. Everything it created is returned in `keys` so
 * a later failure can undo it.
 */
async function sanitizePhotosForPublish(
  jobId: string,
  media: MediaItem[],
): Promise<SanitizedPhotos> {
  const selectable = media.filter((item) => item.media_type !== 'video' && item.uri);
  const images = selectable.slice(0, MAX_PUBLISHED_PHOTOS);
  // Videos are never published: there is no re-encode path that guarantees
  // their metadata is gone, and the privacy gate does not do maybes.
  const videos = media.filter((item) => item.media_type === 'video').length;
  const overflow = selectable.length - images.length;
  const dropped: string[] = [];
  if (videos > 0) dropped.push(`${videos} video${videos === 1 ? '' : 's'} (videos are not published)`);
  if (overflow > 0) dropped.push(`${overflow} over the ${MAX_PUBLISHED_PHOTOS}-photo limit`);
  const droppedNote = dropped.length > 0 ? `Left out: ${dropped.join(', ')}.` : '';

  if (images.length === 0) {
    return { urls: [], keys: [], skipped: videos + overflow, note: droppedNote || undefined };
  }

  // Without Storage there is nowhere to host a cleaned copy, and the raw URL
  // is exactly what we refuse to publish.
  if (!isSupabaseConfigured) {
    return {
      urls: [],
      keys: [],
      skipped: images.length + videos + overflow,
      note: `${images.length} photo${images.length === 1 ? '' : 's'} left out: connect Supabase Storage so cleaned copies can be hosted without their location data. ${droppedNote}`.trim(),
    };
  }

  const urls: string[] = [];
  const keys: string[] = [];
  let skipped = 0;
  for (const item of images) {
    try {
      const clean = await ImageManipulator.manipulateAsync(item.uri as string, [], {
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      const body = await readLocalBytes(clean.uri);
      const key = `published/${jobId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error } = await supabase.storage
        .from('media')
        .upload(key, body, { contentType: 'image/jpeg', upsert: false });
      if (error) {
        skipped += 1;
        continue;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from('media').getPublicUrl(key);
      urls.push(publicUrl);
      keys.push(key);
    } catch {
      skipped += 1;
    }
  }

  const failureNote =
    skipped > 0
      ? `${skipped} photo${skipped === 1 ? '' : 's'} left out — the location data could not be stripped, so ${skipped === 1 ? 'it was' : 'they were'} not published.`
      : '';
  const note = [failureNote, droppedNote].filter(Boolean).join(' ');
  return { urls, keys, skipped: skipped + videos + overflow, note: note || undefined };
}

/**
 * Undo the uploads a failed publish made.
 *
 * Nothing references these objects once the handoff has failed: the post they
 * were re-encoded for does not exist anywhere. Leaving them behind means every
 * retry strands another full set of images in Storage, so we delete them.
 * Best-effort by design — a failed cleanup must not turn into a second error
 * on top of the one the user is already being shown.
 */
async function discardUploadedPhotos(keys: string[]): Promise<void> {
  if (keys.length === 0 || !isSupabaseConfigured) return;
  try {
    await supabase.storage.from('media').remove(keys);
  } catch {
    // Swallowed on purpose — see above.
  }
}

// ───────────────────────── handoff to the web app ────────────────────────

/** Transport-level statuses. 'demo' is decided here, never by the server. */
type HandoffStatus = 'queued' | 'sent' | 'failed' | 'not-configured';

interface HandoffResult {
  status: HandoffStatus;
  detail: string;
  /**
   * True only when we KNOW the web app never took the payload: it answered and
   * refused, or we never sent anything at all. A timed-out or dropped request
   * leaves this false, because the server may have received and acted on the
   * post regardless of what our socket did. Only a `true` here makes it safe to
   * delete the uploaded images — see the cleanup in publishJob.
   */
  certainlyNotAccepted: boolean;
  /**
   * Per-destination outcomes the server reported for itself, when it did.
   * The web app is the only thing that knows where a post really went, so if
   * it tells us, that is what we show.
   */
  perDestination?: DestinationResult[];
}

const HANDOFF_STATUSES: HandoffStatus[] = ['queued', 'sent', 'failed', 'not-configured'];

/** Default sentence for a status the server named without explaining. */
const HANDOFF_DETAIL: Record<HandoffStatus, string> = {
  queued: 'Your web app accepted this and will publish it.',
  sent: 'Handed off to your web app, which publishes it from here.',
  failed: 'Your web app rejected the handoff — nothing was published.',
  'not-configured': NOT_CONFIGURED_DETAIL,
};

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await response.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** The server's own words for a failure, when it gave any. */
function serverError(response: Response, body: Record<string, unknown>): string {
  const message = body.error ?? body.message;
  if (typeof message === 'string' && message.trim()) {
    const said = message.trim();
    const sentence = /[.!?]$/.test(said) ? said : `${said}.`;
    return `Your web app rejected the handoff: ${sentence} Nothing was published.`;
  }
  return `Your web app rejected the handoff (HTTP ${response.status}) — nothing was published.`;
}

/** Whatever reference the run came back with, so the user can find it. */
function runReference(body: Record<string, unknown>): string | undefined {
  for (const candidate of [body.executionId, body.execution_id, body.id]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return undefined;
}

/**
 * Per-destination outcomes lifted out of the response, if it carried any.
 *
 * Strict on purpose: a destination we did not ask for is ignored, and a status
 * outside the known set is ignored rather than guessed at. Anything this does
 * not accept falls back to the transport result, which can only ever
 * understate what happened.
 */
function serverDestinationResults(
  body: Record<string, unknown>,
  requested: Destination[],
): DestinationResult[] | undefined {
  const raw = Array.isArray(body.results)
    ? body.results
    : Array.isArray(body.destinations)
      ? body.destinations
      : null;
  if (!raw) return undefined;

  const results: DestinationResult[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const destination = row.destination;
    const status = row.status;
    if (typeof destination !== 'string' || typeof status !== 'string') continue;
    if (!requested.includes(destination as Destination)) continue;
    if (!HANDOFF_STATUSES.includes(status as HandoffStatus)) continue;
    if (results.some((result) => result.destination === destination)) continue;
    const detail = typeof row.detail === 'string' && row.detail.trim() ? row.detail.trim() : '';
    results.push({
      destination: destination as Destination,
      status: status as HandoffStatus,
      detail: detail || HANDOFF_DETAIL[status as HandoffStatus],
    });
  }
  return results.length > 0 ? results : undefined;
}

/**
 * Hand the approved, scrubbed post to the web app. This is the only way a post
 * leaves this device, and this client makes no decision about what happens to
 * it next.
 */
async function handOffToWebApp(
  payload: Record<string, unknown>,
  requested: Destination[],
): Promise<HandoffResult> {
  const url = publishApiUrl();
  if (!url) {
    return { status: 'not-configured', detail: NOT_CONFIGURED_DETAIL, certainlyNotAccepted: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    // Let the web app attribute the handoff when we are signed in. Absent in
    // demo mode, and this client holds no other credential of any kind.
    if (isSupabaseConfigured) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await readJson(response);
    // The server answered and refused: this one we are sure about.
    if (!response.ok) {
      return {
        status: 'failed',
        detail: serverError(response, body),
        certainlyNotAccepted: true,
      };
    }

    const perDestination = serverDestinationResults(body, requested);
    const reference = runReference(body);
    if (reference) {
      return {
        status: 'queued',
        detail: `Your web app accepted this (run ${reference}) and publishes it from there.`,
        certainlyNotAccepted: false,
        perDestination,
      };
    }
    return {
      status: 'sent',
      detail: HANDOFF_DETAIL.sent,
      certainlyNotAccepted: false,
      perDestination,
    };
  } catch (error) {
    // We never heard back, which is not the same as "it did not arrive" — say
    // exactly that rather than claiming nothing was published.
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        status: 'failed',
        detail:
          'Your web app did not answer in time, so this was not confirmed. It may still have received the post — check your web app before publishing again.',
        certainlyNotAccepted: false,
      };
    }
    const reason = error instanceof Error ? error.message : String(error);
    return {
      status: 'failed',
      detail: `Could not reach your web app (${reason}), so nothing was confirmed as published.`,
      certainlyNotAccepted: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

export interface PublishOutcome {
  error?: string;
  /** One entry per chosen destination; empty when publishing errored out. */
  results: DestinationResult[];
  /** What the privacy gate removed from the copy, if anything. */
  redactions?: PrivacyRedaction[];
  /** Present when photos were left out of the post. */
  photoNote?: string;
}

export interface PublishJobInput {
  job: Job;
  media: MediaItem[];
  destinations: Destination[];
  content: PublishContent;
  /**
   * A human read the copy and approved it. Required — publishJob refuses
   * without it, so no code path can publish unreviewed text.
   */
  approved: boolean;
}

/**
 * Mark the job completed. This happens once the gates have passed, whatever
 * the handoff then does: the work really is finished, and a delivery failure
 * is reported separately rather than by pretending the job is still open.
 */
async function markJobCompleted(jobId: string, at: string): Promise<void> {
  if (isSupabaseConfigured) {
    // Web Project shape: status + completed_at.
    await supabase.from('jobs').update({ status: 'completed', completed_at: at }).eq('id', jobId);
  } else {
    await jobsStore.updateStatus(jobId, 'completed');
  }
}

export async function publishJob(options: PublishJobInput): Promise<PublishOutcome> {
  const { job, media, destinations, content, approved } = options;

  // Gate 1 — human review.
  if (!approved) {
    return { error: 'Read and approve the post copy before publishing.', results: [] };
  }

  // Gate 2 — the photo release, before any photo is touched.
  const photos = media.filter((item) => item.media_type !== 'video' && item.uri);
  if (photos.length > 0) {
    const release = await getPhotoRelease(job.id);
    if (!release?.granted) {
      return {
        error:
          'This job has no photo release on file. Confirm the customer agreed to their photos being published, or publish without photos.',
        results: [],
      };
    }
  }

  // Gate 2 (continued) — scrub again here, whatever the UI did. The reviewer
  // may have typed the customer's name straight back in.
  const scrubbedTitle = scrubPublishText(content.title, job);
  const scrubbedBody = scrubPublishText(content.content, job);
  const redactions = mergeRedactions(scrubbedTitle.redactions, scrubbedBody.redactions);
  const safe: PublishContent = {
    ...content,
    title: scrubbedTitle.text,
    content: scrubbedBody.text,
    location: publishableLocation(job),
  };

  const now = new Date().toISOString();

  // Nothing to hand off to anywhere: demo mode, not a delivery failure.
  const demoMode = !isSupabaseConfigured && !isPublishApiConfigured;

  /** Save the record and wake the job screens. Shared by every exit below. */
  const finish = async (
    results: DestinationResult[],
    sanitized: SanitizedPhotos,
  ): Promise<PublishOutcome> => {
    // Record what genuinely went somewhere — plus demo results, so the demo
    // flow is complete. A real destination we never reached is still left out,
    // so the job screen cannot show a "Published to…" badge we did not earn.
    const recorded = results.filter((result) => isRecorded(result.status));
    if (recorded.length > 0) {
      await savePublishRecord({
        job_id: job.id,
        destinations: recorded.map((result) => result.destination),
        published_at: now,
        title: safe.title,
      });
    }
    jobsStore.notifyChanged();
    return {
      results,
      redactions: redactions.length > 0 ? redactions : undefined,
      // Only worth raising when something really did leave the post out.
      photoNote: sanitized.skipped > 0 ? sanitized.note : undefined,
    };
  };

  const nothingUploaded: SanitizedPhotos = { urls: [], keys: [], skipped: 0 };

  // ── Demo mode ───────────────────────────────────────────────────────────
  // No network, no uploads, and every destination says plainly that nothing
  // was posted. Checked before anything else so a demo build cannot touch
  // Storage or the wire at all.
  if (demoMode) {
    await markJobCompleted(job.id, now);
    return finish(
      destinations.map((destination) => ({
        destination,
        status: 'demo' as const,
        detail: DEMO_DETAIL[destination],
      })),
      nothingUploaded,
    );
  }

  // ── Gate 3 — a real account, checked BEFORE anything is uploaded ────────
  // This used to sit after sanitisation, so a signed-out publish re-encoded
  // and uploaded every photo before refusing.
  if (isSupabaseConfigured) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      return { error: 'Sign in with your real account to publish.', results: [] };
    }
  }

  await markJobCompleted(job.id, now);

  // ── Gate 4 — is there a route off the device at all? ────────────────────
  // Answered before sanitisation for the same reason: with nowhere to send
  // the post, uploading cleaned copies would strand them in Storage.
  if (!isPublishApiConfigured) {
    return finish(
      destinations.map((destination) => ({
        destination,
        status: 'not-configured' as const,
        detail: NOT_CONFIGURED_DETAIL,
      })),
      nothingUploaded,
    );
  }

  // ── Gate 2 (continued) — EXIF-free copies, or no photos at all ──────────
  // Last, because this is the first step that writes anything anywhere.
  const business = await workspace.getCurrent();
  const sanitized = await sanitizePhotosForPublish(job.id, media);

  const handoff = await handOffToWebApp(
    {
      event: 'job.completed',
      job_id: job.id,
      // Scrubbed copy only — this payload leaves the device.
      title: safe.title,
      business: business?.name,
      city: job.city,
      state: job.state,
      zip: job.zip,
      service_type: job.service_type,
      // Requests, not instructions: the web app decides how each is fulfilled.
      destinations,
      post: {
        title: safe.title,
        content: safe.content,
        hashtags: safe.hashtags,
        keywords: safe.keywords,
        location: safe.location,
      },
      images: sanitized.urls,
      completed_at: now,
    },
    destinations,
  );

  // The web app answered and refused, so the copies we just uploaded are
  // referenced by nothing. Delete them rather than leaving an orphan set
  // behind for this attempt and one more for every retry.
  //
  // Deliberately NOT done when the request merely timed out or the network
  // dropped: the server may have taken the post anyway, and deleting the
  // images would break a post that is about to go out. An orphan is cheap; a
  // published post full of broken images is not.
  if (handoff.certainlyNotAccepted) {
    await discardUploadedPhotos(sanitized.keys);
  }

  const results: DestinationResult[] = destinations.map((destination) => {
    // Prefer what the server said about this destination; fall back to what
    // the transport told us, which can only understate what happened.
    const reported = handoff.perDestination?.find(
      (result) => result.destination === destination,
    );
    return reported ?? { destination, status: handoff.status, detail: handoff.detail };
  });

  return finish(results, sanitized);
}
