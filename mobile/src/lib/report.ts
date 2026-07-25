/**
 * Branded PDF job report: job details, checklist, site visits, notes and a
 * photo grid, rendered via expo-print and handed to the native share sheet.
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { getLogoUri } from '@/lib/logo';
import { formatDate, JOB_STATUS_LABELS } from '@/lib/format';
import { visitDuration, type JobExtras } from '@/lib/job-extras';
import type { Job, JobTask, MediaItem } from '@/lib/types';

const MAX_PHOTOS = 12;

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function imageSrc(uri: string): Promise<string | null> {
  if (uri.startsWith('http') || uri.startsWith('data:')) return uri;
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return null;
  }
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export async function buildJobReportHtml(options: {
  job: Job;
  media: MediaItem[];
  tasks: JobTask[];
  extras: JobExtras;
  businessName: string;
  businessId?: string;
}): Promise<string> {
  const { job, media, tasks, extras, businessName, businessId } = options;

  const logoUri = businessId ? await getLogoUri(businessId) : null;
  const logoSrc = logoUri ? await imageSrc(logoUri) : null;

  const photos = media.filter((item) => item.uri && item.media_type === 'image').slice(0, MAX_PHOTOS);
  const photoCells = (
    await Promise.all(
      photos.map(async (item) => {
        const src = await imageSrc(item.uri!);
        if (!src) return '';
        return `<div class="photo"><img src="${src}" /><div class="photo-cap">${esc(
          item.category.toUpperCase(),
        )} · ${esc(formatDate(item.taken_at))}</div></div>`;
      }),
    )
  ).join('');

  const visitRows = extras.checkins
    .map((visit, index) => {
      const end = visit.checked_out_at ? fmtTime(visit.checked_out_at) : 'on site';
      return `<tr><td>Day ${index + 1}</td><td>${esc(formatDate(visit.checked_in_at))}</td><td>${fmtTime(
        visit.checked_in_at,
      )} – ${end}</td><td>${esc(visitDuration(visit.checked_in_at, visit.checked_out_at))}</td></tr>`;
    })
    .join('');

  const taskRows = tasks
    .map((task) => `<li class="${task.done ? 'done' : ''}">${task.done ? '☑' : '☐'} ${esc(task.label)}</li>`)
    .join('');

  const noteRows = extras.notes
    .map(
      (note) =>
        `<div class="note"><div class="note-meta">${esc(note.author)} · ${esc(
          formatDate(note.created_at),
        )}</div>${esc(note.text)}</div>`,
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #101219; margin: 28px; }
    .head { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0697E0; padding-bottom: 14px; }
    .brand { font-size: 20px; font-weight: 800; color: #0697E0; }
    .head img { max-height: 44px; max-width: 150px; }
    h1 { font-size: 22px; margin: 18px 0 2px; }
    .sub { color: #5A6B85; font-size: 13px; margin-bottom: 14px; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.06em; color: #0697E0; margin: 22px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    td, th { text-align: left; padding: 6px 8px; border-bottom: 1px solid #E3E8F0; }
    ul { list-style: none; padding: 0; margin: 0; font-size: 13px; }
    li { padding: 3px 0; }
    li.done { color: #5A6B85; }
    .note { font-size: 12.5px; border-left: 3px solid #E3E8F0; padding: 4px 10px; margin-bottom: 8px; }
    .note-meta { color: #5A6B85; font-size: 11px; margin-bottom: 2px; }
    .grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .photo { width: 31%; }
    .photo img { width: 100%; height: 150px; object-fit: cover; border-radius: 6px; }
    .photo-cap { font-size: 10px; color: #5A6B85; margin-top: 2px; }
    .meta-table td:first-child { color: #5A6B85; width: 120px; }
    .foot { margin-top: 26px; padding-top: 10px; border-top: 1px solid #E3E8F0; font-size: 11px; color: #5A6B85; }
  </style></head><body>
    <div class="head">
      <div class="brand">${esc(businessName)}</div>
      ${logoSrc ? `<img src="${logoSrc}" />` : ''}
    </div>
    <h1>${esc(job.title)}</h1>
    <div class="sub">Job report · ${esc(formatDate(new Date().toISOString()))}</div>
    <h2>Job details</h2>
    <table class="meta-table">
      <tr><td>Client</td><td>${esc(job.client_name || '—')}</td></tr>
      <tr><td>Address</td><td>${esc([job.address, job.city].filter(Boolean).join(', ') || '—')}</td></tr>
      <tr><td>Status</td><td>${esc(JOB_STATUS_LABELS[job.status])}</td></tr>
      <tr><td>Started</td><td>${esc(formatDate(job.start_date))}</td></tr>
      ${job.tags?.length ? `<tr><td>Tags</td><td>${esc(job.tags.map((t) => `#${t}`).join(' '))}</td></tr>` : ''}
    </table>
    ${visitRows ? `<h2>Site visits</h2><table><tr><th>Visit</th><th>Date</th><th>Time</th><th>Duration</th></tr>${visitRows}</table>` : ''}
    ${taskRows ? `<h2>Checklist</h2><ul>${taskRows}</ul>` : ''}
    ${noteRows ? `<h2>Notes</h2>${noteRows}` : ''}
    ${photoCells ? `<h2>Photos (${photos.length})</h2><div class="grid">${photoCells}</div>` : ''}
    <div class="foot">Generated by ${esc(businessName)} with Local SEO Ranker</div>
  </body></html>`;
}

/** Render the report and open print (web) or the share sheet (phone). */
export async function exportJobReport(
  options: Parameters<typeof buildJobReportHtml>[0],
): Promise<{ error?: string }> {
  try {
    const html = await buildJobReportHtml(options);
    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
      return {};
    }
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${options.job.title} report`,
        UTI: 'com.adobe.pdf',
      });
    }
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Could not create the report.' };
  }
}
