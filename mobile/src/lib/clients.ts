/**
 * Clients CRM — reads the same `clients` table as the web Clients page,
 * with job counts derived from the jobs list. Demo mode derives clients
 * from the demo jobs.
 */

import { fetchJobs } from '@/lib/data';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { ClientRecord, Job } from '@/lib/types';

type Row = Record<string, unknown>;
const str = (row: Row, key: string): string => (typeof row[key] === 'string' ? (row[key] as string) : '');

const DEMO_CONTACTS: Record<string, { phone: string; email: string }> = {
  'Sarah Mitchell': { phone: '(440) 555-0142', email: 'sarah.mitchell@email.com' },
  'Tom Rivera': { phone: '(440) 555-0186', email: 'tom.rivera@email.com' },
  'Linda Okafor': { phone: '(440) 555-0168', email: 'linda.okafor@email.com' },
  'Greenfield HOA': { phone: '(216) 555-0195', email: 'board@greenfieldhoa.org' },
  'Mike Donnelly': { phone: '(440) 555-0121', email: 'mike.donnelly@email.com' },
  'Priya Shah': { phone: '(216) 555-0133', email: 'priya.shah@email.com' },
};

function deriveFromJobs(jobs: Job[]): ClientRecord[] {
  const byName = new Map<string, ClientRecord>();
  for (const job of jobs) {
    const name = job.client_name;
    if (!name || name === 'Unknown client') continue;
    const existing = byName.get(name);
    if (existing) {
      existing.jobs_count += 1;
      if (job.start_date > existing.last_job_at) existing.last_job_at = job.start_date;
    } else {
      const contact = DEMO_CONTACTS[name] ?? { phone: '', email: '' };
      byName.set(name, {
        id: `client-${name.toLowerCase().replace(/[^a-z]/g, '-')}`,
        name,
        phone: contact.phone,
        email: contact.email,
        jobs_count: 1,
        last_job_at: job.start_date,
      });
    }
  }
  return [...byName.values()].sort((a, b) => (a.last_job_at < b.last_job_at ? 1 : -1));
}

export async function fetchClients(): Promise<ClientRecord[]> {
  const jobs = await fetchJobs();

  if (!isSupabaseConfigured) return deriveFromJobs(jobs);

  const { data, error } = await supabase.from('clients').select('*').limit(100);
  if (error || !data?.length) return deriveFromJobs(jobs);

  return (data as Row[]).map((row) => {
    const name = str(row, 'name') || str(row, 'full_name') || 'Client';
    const clientJobs = jobs.filter(
      (job) => job.client_name.toLowerCase() === name.toLowerCase(),
    );
    return {
      id: String(row.id),
      name,
      phone: str(row, 'phone') || str(row, 'mobile_phone'),
      email: str(row, 'email'),
      jobs_count: clientJobs.length,
      last_job_at: clientJobs[0]?.start_date ?? str(row, 'created_at'),
    };
  });
}

export async function fetchClient(id: string): Promise<ClientRecord | undefined> {
  const clients = await fetchClients();
  return clients.find((client) => client.id === id);
}

export async function fetchClientJobs(clientName: string): Promise<Job[]> {
  const jobs = await fetchJobs();
  return jobs.filter((job) => job.client_name.toLowerCase() === clientName.toLowerCase());
}
