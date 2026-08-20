/**
 * Client for the Google Business Profile live API (/api/gbp/*).
 *
 * Every method calls apiFetch, which attaches the Supabase bearer token and
 * throws ApiError on non-2xx. Callers should distinguish:
 *   - 409  → not connected (connect in Settings)
 *   - 403  → connected but the Business Profile API is not approved yet
 */
import { apiFetch } from "./api";

export interface GbpStatus {
  connected: boolean;
  email?: string | null;
  locationName?: string | null;
  approved?: boolean;
  message?: string;
}

export interface GbpReview {
  name: string;
  reviewId: string;
  reviewer: string;
  rating: number;
  comment: string;
  createTime: string | null;
  updateTime: string | null;
  reply: { comment: string; updateTime: string | null } | null;
}

export interface GbpLocalPost {
  name: string;
  summary: string;
  state: string | null;
  topicType: string | null;
  createTime: string | null;
  searchUrl: string | null;
  callToAction: { actionType?: string; url?: string } | null;
  media: Array<{ googleUrl?: string; sourceUrl?: string }>;
}

export interface GbpQuestion {
  name: string;
  text: string;
  author: string;
  createTime: string | null;
  totalAnswerCount: number;
  topAnswer: { text: string; author: string } | null;
}

export interface GbpInsights {
  calls: number;
  websiteClicks: number;
  directionRequests: number;
  views: number;
  searches: number;
  rangeDays: number;
}

export interface GbpSyncResult {
  locationSynced: boolean;
  reviews: number;
  questions: number;
  insights: GbpInsights | null;
  approved: boolean;
  message?: string;
}

export interface CreatePostBody {
  summary: string;
  topicType?: string;
  callToAction?: { actionType: string; url?: string };
}

export const gbpService = {
  status: (businessId: string) => apiFetch<GbpStatus>(`/api/gbp/${businessId}/status`),

  sync: (businessId: string) => apiFetch<GbpSyncResult>(`/api/gbp/${businessId}/sync`, { method: "POST" }),

  reviews: (businessId: string) =>
    apiFetch<{ reviews: GbpReview[] }>(`/api/gbp/${businessId}/reviews`).then((r) => r.reviews),

  replyReview: (businessId: string, reviewId: string, comment: string) =>
    apiFetch<{ success: boolean }>(`/api/gbp/${businessId}/reviews/${encodeURIComponent(reviewId)}/reply`, {
      method: "POST",
      body: { comment },
    }),

  posts: (businessId: string) =>
    apiFetch<{ posts: GbpLocalPost[] }>(`/api/gbp/${businessId}/posts`).then((r) => r.posts),

  createPost: (businessId: string, body: CreatePostBody) =>
    apiFetch<{ success: boolean; post: GbpLocalPost }>(`/api/gbp/${businessId}/posts`, {
      method: "POST",
      body: body as unknown as Record<string, unknown>,
    }),

  questions: (businessId: string) =>
    apiFetch<{ questions: GbpQuestion[] }>(`/api/gbp/${businessId}/questions`).then((r) => r.questions),

  insights: (businessId: string) =>
    apiFetch<{ insights: GbpInsights }>(`/api/gbp/${businessId}/insights`).then((r) => r.insights),
};
