/**
 * GMB profile management — hours, Q&A, services, categories.
 * Mirrors the web GMBOptimization CRUD exactly (same tables, same write
 * patterns: hours are replaced wholesale, the rest are row inserts/deletes).
 * In demo mode everything works against an AsyncStorage-backed local store.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export interface GmbHourRow {
  id?: string;
  day: string;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export interface GmbQaRow {
  id: string;
  question: string;
  answer: string;
}

export interface GmbServiceRow {
  id: string;
  name: string;
  description: string;
  price: string;
}

export interface GmbCategoryRow {
  id: string;
  name: string;
  is_primary: boolean;
}

export interface GmbLists {
  hours: GmbHourRow[];
  qas: GmbQaRow[];
  services: GmbServiceRow[];
  categories: GmbCategoryRow[];
}

export const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const STORAGE_KEY = 'lsr-gmb-lists-v1';

const DEMO_LISTS: GmbLists = {
  hours: DAYS.map((day) => ({
    day,
    open_time: day === 'Sunday' ? '' : day === 'Saturday' ? '9:00 AM' : '8:00 AM',
    close_time: day === 'Sunday' ? '' : day === 'Saturday' ? '2:00 PM' : '6:00 PM',
    is_closed: day === 'Sunday',
  })),
  qas: [
    {
      id: 'qa-1',
      question: 'Do you offer free estimates?',
      answer: 'Yes — every job starts with a free on-site estimate.',
    },
    {
      id: 'qa-2',
      question: 'Are you licensed and insured?',
      answer: 'Fully licensed and insured in the state of Ohio.',
    },
  ],
  services: [
    { id: 'svc-1', name: 'Gutter cleaning', description: 'Full gutter and downspout clean-out.', price: '$149' },
    { id: 'svc-2', name: 'Gutter guard installation', description: 'Micro-mesh guards with lifetime warranty.', price: 'from $899' },
    { id: 'svc-3', name: 'French drain installation', description: 'Yard drainage design and install.', price: 'quote' },
    { id: 'svc-4', name: 'Sump pump replacement', description: 'Same-week replacement with backup options.', price: 'from $650' },
  ],
  categories: [
    { id: 'cat-1', name: 'Gutter Cleaning Service', is_primary: true },
    { id: 'cat-2', name: 'Drainage Service', is_primary: false },
    { id: 'cat-3', name: 'Waterproofing Company', is_primary: false },
  ],
};

let localLists: GmbLists | null = null;

async function getLocalLists(): Promise<GmbLists> {
  if (localLists) return localLists;
  let lists: GmbLists;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    lists = raw ? (JSON.parse(raw) as GmbLists) : (JSON.parse(JSON.stringify(DEMO_LISTS)) as GmbLists);
  } catch {
    lists = JSON.parse(JSON.stringify(DEMO_LISTS)) as GmbLists;
  }
  localLists = lists;
  return lists;
}

async function saveLocalLists(lists: GmbLists): Promise<void> {
  localLists = lists;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
  } catch {
    // Best-effort persistence.
  }
}

type Row = Record<string, unknown>;
const str = (row: Row, key: string): string => (typeof row[key] === 'string' ? (row[key] as string) : '');

export async function fetchGmbLists(businessId: string): Promise<GmbLists> {
  if (!isSupabaseConfigured) return getLocalLists();

  const [hoursRes, qaRes, svcRes, catRes] = await Promise.all([
    supabase.from('gmb_hours').select('*').eq('business_id', businessId).order('id'),
    supabase
      .from('gmb_qas')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false }),
    supabase.from('gmb_services').select('*').eq('business_id', businessId).order('created_at'),
    supabase
      .from('gmb_categories')
      .select('*')
      .eq('business_id', businessId)
      .order('is_primary', { ascending: false }),
  ]);

  const hours = ((hoursRes.data ?? []) as Row[]).map((row) => ({
    id: str(row, 'id') || undefined,
    day: str(row, 'day'),
    open_time: str(row, 'open_time'),
    close_time: str(row, 'close_time'),
    is_closed: Boolean(row.is_closed),
  }));

  return {
    // A fresh profile has no hours rows yet — start from a sensible template.
    hours: hours.length > 0 ? hours : JSON.parse(JSON.stringify(DEMO_LISTS.hours)),
    qas: ((qaRes.data ?? []) as Row[]).map((row) => ({
      id: str(row, 'id'),
      question: str(row, 'question'),
      answer: str(row, 'answer'),
    })),
    services: ((svcRes.data ?? []) as Row[]).map((row) => ({
      id: str(row, 'id'),
      name: str(row, 'name'),
      description: str(row, 'description'),
      price: str(row, 'price'),
    })),
    categories: ((catRes.data ?? []) as Row[]).map((row) => ({
      id: str(row, 'id'),
      name: str(row, 'name'),
      is_primary: Boolean(row.is_primary),
    })),
  };
}

/** Replace-all save, same as the web handleSaveHours. */
export async function saveGmbHours(
  businessId: string,
  hours: GmbHourRow[],
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) {
    const lists = await getLocalLists();
    await saveLocalLists({ ...lists, hours });
    return {};
  }
  const { error: deleteError } = await supabase
    .from('gmb_hours')
    .delete()
    .eq('business_id', businessId);
  if (deleteError) return { error: deleteError.message };
  const toInsert = hours.map(({ id: _id, ...hour }) => ({ ...hour, business_id: businessId }));
  const { error } = await supabase.from('gmb_hours').insert(toInsert);
  return error ? { error: error.message } : {};
}

export async function addGmbQa(
  businessId: string,
  question: string,
  answer: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) {
    const lists = await getLocalLists();
    await saveLocalLists({
      ...lists,
      qas: [{ id: `local-${Date.now()}`, question, answer }, ...lists.qas],
    });
    return {};
  }
  const { error } = await supabase
    .from('gmb_qas')
    .insert({ business_id: businessId, question, answer, author: 'Business Owner', source: 'manual' });
  return error ? { error: error.message } : {};
}

export async function deleteGmbQa(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const lists = await getLocalLists();
    await saveLocalLists({ ...lists, qas: lists.qas.filter((qa) => qa.id !== id) });
    return;
  }
  await supabase.from('gmb_qas').delete().eq('id', id);
}

export async function addGmbService(
  businessId: string,
  service: { name: string; description: string; price: string },
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) {
    const lists = await getLocalLists();
    await saveLocalLists({
      ...lists,
      services: [...lists.services, { id: `local-${Date.now()}`, ...service }],
    });
    return {};
  }
  const { error } = await supabase
    .from('gmb_services')
    .insert({ business_id: businessId, ...service, category: '', image_url: '' });
  return error ? { error: error.message } : {};
}

export async function deleteGmbService(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const lists = await getLocalLists();
    await saveLocalLists({ ...lists, services: lists.services.filter((s) => s.id !== id) });
    return;
  }
  await supabase.from('gmb_services').delete().eq('id', id);
}

export async function addGmbCategory(
  businessId: string,
  name: string,
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured) {
    const lists = await getLocalLists();
    await saveLocalLists({
      ...lists,
      categories: [...lists.categories, { id: `local-${Date.now()}`, name, is_primary: false }],
    });
    return {};
  }
  const { error } = await supabase
    .from('gmb_categories')
    .insert({ business_id: businessId, name, is_primary: false });
  return error ? { error: error.message } : {};
}

export async function deleteGmbCategory(id: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const lists = await getLocalLists();
    await saveLocalLists({
      ...lists,
      categories: lists.categories.filter((category) => category.id !== id),
    });
    return;
  }
  await supabase.from('gmb_categories').delete().eq('id', id);
}
