/**
 * Client for the /api/automation backend (super-admin worker control).
 * Each function throws ApiError on failure.
 */
import { apiFetch } from "./api";

export interface TriggerActionResult {
  type: string;
  ok: boolean;
  detail: string;
}

export interface TriggerRunResult {
  triggerId: string;
  event: string;
  status: "success" | "failed" | "skipped";
  matched: number;
  actions: TriggerActionResult[];
  notes: string[];
  detail: string;
}

export interface TriggerRunRow {
  id: string;
  trigger_id: string;
  event: string;
  status: "success" | "failed" | "skipped";
  detail: Record<string, unknown> | null;
  created_at: string;
}

export interface TickSummary {
  broadcasts: { processed: number; sent: number; failed: number };
  campaigns: { processed: number; sent: number; skipped: number; failed: number };
  triggers: { evaluated: number; fired: number; failed: number };
}

/** Run a single event trigger immediately. */
export function runTrigger(id: string): Promise<{ success: boolean; result: TriggerRunResult }> {
  return apiFetch(`/api/automation/triggers/${id}/run`, { method: "POST" });
}

/** Recent execution log rows for a trigger. */
export function triggerRuns(id: string): Promise<{ runs: TriggerRunRow[] }> {
  return apiFetch(`/api/automation/triggers/${id}/runs`);
}

/** Kick a full worker tick (all processors) now. */
export function tick(): Promise<{ success: boolean; summary: TickSummary }> {
  return apiFetch("/api/automation/tick", { method: "POST" });
}
