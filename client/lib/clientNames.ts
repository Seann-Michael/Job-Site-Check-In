/**
 * Client-name helpers shared by the Clients list and ClientDetail pages.
 *
 * Jobs reference their client two ways: the web writes `jobs.client_id`, and
 * the mobile app writes the NAME STRING inside `jobs.client_contact` (its
 * fetchClientJobs matches `job.client_name === client.name`, case-
 * insensitively — see mobile/src/lib/clients.ts). The name string is a live
 * join key, so renaming a client without moving those jobs silently detaches
 * every one of them on mobile. This module is the web mirror of the mobile
 * cascade in mobile/src/lib/data.ts (renameClientAcrossJobs).
 */

import { supabase } from "@/lib/dataService";

/**
 * Escape a literal value for a PostgREST like/ilike pattern. With no
 * wildcards, ilike is a case-insensitive equality match — which is exactly
 * how mobile compares job.client_name to client.name.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/**
 * The label both platforms should show for a client. Mirrors mobile's
 * clientDisplayName precedence: person (`first_name last_name`) → `name` →
 * `business_name` → "Client". The raw `name` stays the join key and is never
 * rewritten here — this is display only.
 */
export function clientDisplayLabel(client: {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  business_name?: string | null;
}): string {
  const person = [client.first_name, client.last_name]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  return person || client.name?.trim() || client.business_name?.trim() || "Client";
}

/**
 * Move every one of a client's jobs onto their new name — run this BEFORE
 * writing the client row, and abort the rename if it fails, so the client's
 * jobs are never orphaned. Mirrors mobile's renameClientAcrossJobs:
 * `client_contact` also carries email and phone, so the blobs are read first
 * and rewritten with only the name changed.
 *
 * Returns how many jobs moved so the caller can tell the user; `error` means
 * the cascade stopped (or never started) and the client row should keep its
 * old name.
 *
 * `businessId` is REQUIRED for the cascade to run: without it the name match
 * would rewrite client_contact.name on every same-named job in every tenant.
 * The cascade fails closed instead — no business scope, no cascade.
 */
export async function renameClientAcrossJobs(
  oldName: string,
  newName: string,
  businessId?: string | null,
): Promise<{ updated: number; error?: string }> {
  const from = oldName.trim();
  const to = newName.trim();
  if (!from || !to || from.toLowerCase() === to.toLowerCase()) return { updated: 0 };

  if (!businessId) {
    return {
      updated: 0,
      error:
        "this client isn't linked to a business workspace, so their jobs can't be safely moved to the new name",
    };
  }

  const { data, error: readError } = await supabase
    .from("jobs")
    .select("id, client_contact")
    .ilike("client_contact->>name", escapeLikePattern(from))
    .eq("business_id", businessId);
  if (readError) return { updated: 0, error: readError.message };

  // Re-verify in JS: the ilike narrowed the fetch, but the write list is held
  // to exact case-insensitive equality so an odd pattern can never move a job
  // that belongs to a different client.
  const rows = ((data || []) as { id: string; client_contact: Record<string, unknown> | null }[])
    .filter((row) => {
      const contactName = row.client_contact?.["name"];
      return (
        typeof contactName === "string" &&
        contactName.trim().toLowerCase() === from.toLowerCase()
      );
    });

  let updated = 0;
  for (const row of rows) {
    const contact = row.client_contact ?? {};
    const { error } = await supabase
      .from("jobs")
      .update({ client_contact: { ...contact, name: to } })
      .eq("id", row.id);
    // Report the partial result rather than claiming a clean rename: some jobs
    // have already moved and the caller needs to know the split happened.
    if (error) return { updated, error: error.message };
    updated += 1;
  }
  return { updated };
}
