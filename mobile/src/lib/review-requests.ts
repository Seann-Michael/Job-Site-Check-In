/**
 * Review requests from the phone. Connected: inserts the same
 * review_requests row the web dashboard lists (the web app's Twilio
 * pipeline handles actual SMS delivery). Demo: a local record that shows
 * up in the Reviews tab immediately.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { Job, ReviewRequest } from '@/lib/types';

const STORAGE_KEY = 'lsr-review-requests-v1';

export interface SendReviewInput {
  customerName: string;
  phone: string;
  channel: 'sms' | 'email';
}

export async function getLocalReviewRequests(): Promise<ReviewRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ReviewRequest[]) : [];
  } catch {
    return [];
  }
}

export async function sendReviewRequest(
  job: Job,
  input: SendReviewInput,
): Promise<{ error?: string }> {
  const record: ReviewRequest = {
    id: `rr-local-${Date.now()}`,
    customer_name: input.customerName.trim() || job.client_name,
    contact: input.phone.trim(),
    channel: input.channel,
    status: 'scheduled',
    sent_at: new Date().toISOString(),
    job_title: job.title,
  };

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('review_requests').insert({
        customer_name: record.customer_name,
        customer_phone: record.contact,
        project_name: job.title,
        status: 'pending',
        sent_at: record.sent_at,
      });
      if (error) return { error: error.message };
      return {};
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Could not send the request.' };
    }
  }

  // Demo mode: persist locally so the Reviews tab reflects it.
  const existing = await getLocalReviewRequests();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...existing])).catch(
    () => undefined,
  );
  return {};
}
