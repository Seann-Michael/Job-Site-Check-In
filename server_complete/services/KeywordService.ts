import { supabase } from "../supabaseClient";

/**
 * KeywordService encapsulates CRUD operations for the keywords table.
 * Keywords are associated with a business and can later be used for
 * ranking tracking. Each method returns the Supabase response.
 */
export class KeywordService {
  /** List all keywords for a business */
  static async listKeywords(businessId: string) {
    return supabase.from("keywords").select("*").eq("business_id", businessId);
  }
  /** Get a single keyword by id */
  static async getKeyword(id: string) {
    return supabase.from("keywords").select("*").eq("id", id).single();
  }
  /** Create a keyword */
  static async createKeyword(data: {
    business_id: string;
    keyword: string;
    competition_level?: string;
    search_intent?: string;
    importance?: number;
  }) {
    return supabase.from("keywords").insert(data).select().single();
  }
  /** Update a keyword */
  static async updateKeyword(id: string, updates: Record<string, any>) {
    return supabase
      .from("keywords")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
  }
  /** Delete a keyword */
  static async deleteKeyword(id: string) {
    return supabase.from("keywords").delete().eq("id", id).select().single();
  }
}