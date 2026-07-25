/**
 * Demo dataset shown when Supabase isn't configured — the same graceful
 * fallback strategy the web app uses in client/lib/dataService.ts.
 */

import type {
  Business,
  GmbAuditItem,
  GmbProfile,
  Job,
  JobTask,
  MediaItem,
  ReviewRequest,
} from '@/lib/types';

export const DEMO_BUSINESS: Business = {
  id: 'demo-business',
  name: 'Westside Home Services',
  plan: 'Pro Plan',
};

export const DEMO_JOBS: Job[] = [
  {
    id: 'job-1',
    title: 'Gutter guard installation',
    client_name: 'Sarah Mitchell',
    address: '214 Maple Ave',
    city: 'Westlake',
    status: 'in_progress',
    service_type: 'gutters',
    start_date: '2026-07-21',
    photo_count: 14,
    review_requested: false,
  },
  {
    id: 'job-2',
    title: 'Backyard French drain',
    client_name: 'Tom Rivera',
    address: '88 Birchwood Ct',
    city: 'Avon Lake',
    status: 'active',
    service_type: 'drainage',
    start_date: '2026-07-24',
    photo_count: 6,
    review_requested: false,
  },
  {
    id: 'job-3',
    title: 'Sump pump replacement',
    client_name: 'Linda Okafor',
    address: '12 Harbor View Dr',
    city: 'Bay Village',
    status: 'completed',
    service_type: 'plumbing',
    start_date: '2026-07-18',
    photo_count: 22,
    review_requested: true,
  },
  {
    id: 'job-4',
    title: 'Roof soft wash',
    client_name: 'Greenfield HOA',
    address: '400 Commons Blvd',
    city: 'North Olmsted',
    status: 'active',
    service_type: 'roofing',
    start_date: '2026-07-29',
    photo_count: 0,
    review_requested: false,
  },
  {
    id: 'job-5',
    title: 'Patio drainage regrade',
    client_name: 'Mike Donnelly',
    address: '61 Cedar Point Rd',
    city: 'Rocky River',
    status: 'paused',
    service_type: 'landscaping',
    start_date: '2026-07-15',
    photo_count: 9,
    review_requested: false,
  },
  {
    id: 'job-6',
    title: 'Downspout extension install',
    client_name: 'Priya Shah',
    address: '730 Lakewood Heights Blvd',
    city: 'Lakewood',
    status: 'completed',
    service_type: 'gutters',
    start_date: '2026-07-12',
    photo_count: 11,
    review_requested: true,
  },
];

export const DEMO_REVIEW_REQUESTS: ReviewRequest[] = [
  {
    id: 'rr-1',
    customer_name: 'Dana White',
    contact: '(440) 555-0142',
    channel: 'sms',
    status: 'sent',
    sent_at: '2026-07-25T09:20:00Z',
    job_title: 'Gutter cleaning',
  },
  {
    id: 'rr-2',
    customer_name: 'James Carter',
    contact: 'jcarter@email.com',
    channel: 'email',
    status: 'viewed',
    sent_at: '2026-07-24T15:00:00Z',
    job_title: 'Yard drainage assessment',
  },
  {
    id: 'rr-3',
    customer_name: 'Maria Gonzalez',
    contact: '(216) 555-0177',
    channel: 'sms',
    status: 'sent',
    sent_at: '2026-07-23T18:40:00Z',
    job_title: 'Downspout repair',
  },
  {
    id: 'rr-4',
    customer_name: 'Linda Okafor',
    contact: '(440) 555-0168',
    channel: 'sms',
    status: 'completed',
    sent_at: '2026-07-19T13:10:00Z',
    job_title: 'Sump pump replacement',
    rating: 5,
  },
  {
    id: 'rr-5',
    customer_name: 'Priya Shah',
    contact: 'priya.shah@email.com',
    channel: 'email',
    status: 'completed',
    sent_at: '2026-07-13T16:30:00Z',
    job_title: 'Downspout extension install',
    rating: 4,
  },
  {
    id: 'rr-6',
    customer_name: 'Robert Fields',
    contact: '(216) 555-0110',
    channel: 'sms',
    status: 'expired',
    sent_at: '2026-06-28T12:00:00Z',
    job_title: 'Gutter guard quote visit',
  },
  {
    id: 'rr-7',
    customer_name: 'Kevin Bright',
    contact: '(440) 555-0129',
    channel: 'sms',
    status: 'scheduled',
    sent_at: '2026-07-28T14:00:00Z',
    job_title: 'Roof soft wash',
  },
];

export const DEMO_MEDIA: MediaItem[] = [
  { id: 'm-1', job_id: 'job-1', job_title: 'Gutter guard installation', media_type: 'image', category: 'before', taken_at: '2026-07-21T14:02:00Z' },
  { id: 'm-2', job_id: 'job-1', job_title: 'Gutter guard installation', media_type: 'image', category: 'progress', taken_at: '2026-07-22T10:15:00Z' },
  { id: 'm-3', job_id: 'job-1', job_title: 'Gutter guard installation', media_type: 'video', category: 'progress', taken_at: '2026-07-22T10:40:00Z' },
  { id: 'm-4', job_id: 'job-3', job_title: 'Sump pump replacement', media_type: 'image', category: 'before', taken_at: '2026-07-18T09:05:00Z' },
  { id: 'm-5', job_id: 'job-3', job_title: 'Sump pump replacement', media_type: 'image', category: 'after', taken_at: '2026-07-18T15:48:00Z' },
  { id: 'm-6', job_id: 'job-3', job_title: 'Sump pump replacement', media_type: 'video', category: 'final', taken_at: '2026-07-18T16:02:00Z' },
  { id: 'm-7', job_id: 'job-2', job_title: 'Backyard French drain', media_type: 'image', category: 'before', taken_at: '2026-07-24T08:30:00Z' },
  { id: 'm-8', job_id: 'job-2', job_title: 'Backyard French drain', media_type: 'image', category: 'progress', taken_at: '2026-07-24T13:20:00Z' },
  { id: 'm-9', job_id: 'job-5', job_title: 'Patio drainage regrade', media_type: 'image', category: 'before', taken_at: '2026-07-15T11:00:00Z' },
  { id: 'm-10', job_id: 'job-6', job_title: 'Downspout extension install', media_type: 'image', category: 'after', taken_at: '2026-07-12T15:30:00Z' },
  { id: 'm-11', job_id: 'job-6', job_title: 'Downspout extension install', media_type: 'image', category: 'final', taken_at: '2026-07-12T15:55:00Z' },
  { id: 'm-12', job_id: 'job-5', job_title: 'Patio drainage regrade', media_type: 'video', category: 'progress', taken_at: '2026-07-16T09:45:00Z' },
];

export const DEMO_GMB_PROFILE: GmbProfile = {
  name: 'Westside Home Services',
  category: 'Gutter Cleaning Service',
  score: 72,
  rating: 4.8,
  review_count: 47,
  photo_count: 132,
};

export const DEMO_GMB_AUDIT: GmbAuditItem[] = [
  {
    id: 'a-1',
    label: 'Business name matches website',
    detail: 'Name is consistent across profile and site',
    status: 'pass',
  },
  {
    id: 'a-2',
    label: 'Primary category set',
    detail: 'Gutter Cleaning Service',
    status: 'pass',
  },
  {
    id: 'a-3',
    label: 'Photo activity is low',
    detail: '4 photos added this month — aim for 8+',
    status: 'warn',
  },
  {
    id: 'a-4',
    label: 'Services list incomplete',
    detail: 'Missing: French drain installation, sump pumps',
    status: 'fail',
  },
  {
    id: 'a-5',
    label: 'Unanswered Q&A',
    detail: '2 customer questions need answers',
    status: 'warn',
  },
  {
    id: 'a-6',
    label: 'Hours are up to date',
    detail: 'Last confirmed Jul 20',
    status: 'pass',
  },
  {
    id: 'a-7',
    label: 'No recent posts',
    detail: 'Last post was 34 days ago',
    status: 'fail',
  },
];

export const DEMO_JOB_TASKS: JobTask[] = [
  { id: 't-1', label: 'Before photos captured', done: true },
  { id: 't-2', label: 'Old guards removed', done: true },
  { id: 't-3', label: 'New guards installed', done: false },
  { id: 't-4', label: 'After photos + walkthrough video', done: false },
  { id: 't-5', label: 'Send review request', done: false },
];
