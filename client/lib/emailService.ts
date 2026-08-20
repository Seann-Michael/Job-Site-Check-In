/**
 * Client for the /api/email backend (super-admin email sending).
 * Each function throws ApiError; callers should check `isApiError(e) &&
 * e.isUnavailable` (503) to detect "no provider configured".
 */
import { apiFetch } from "./api";

export interface EmailStatus {
  configured: boolean;
  provider: string | null;
}

export interface ProviderTestResult {
  success: boolean;
  id: string | null;
  provider: string;
}

export interface CampaignSendResult {
  success: boolean;
  sent: number;
  failed: number;
  recipientCount: number;
  errors: { email: string; error: string }[];
}

/** Whether email sending is configured, and the active provider's name. */
export function emailStatus(): Promise<EmailStatus> {
  return apiFetch<EmailStatus>("/api/email/status");
}

/** Send a real test email through a specific provider. */
export function testProvider(providerId: string, to: string): Promise<ProviderTestResult> {
  return apiFetch<ProviderTestResult>(`/api/email/providers/${providerId}/test`, {
    method: "POST",
    body: { to },
  });
}

/** Send a campaign now to its resolved target segment. */
export function sendCampaign(campaignId: string): Promise<CampaignSendResult> {
  return apiFetch<CampaignSendResult>(`/api/email/campaigns/${campaignId}/send`, {
    method: "POST",
  });
}
