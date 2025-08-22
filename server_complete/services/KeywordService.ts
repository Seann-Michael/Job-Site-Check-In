import { supabase } from "../supabaseClient";

/**
 * KeywordService encapsulates CRUD operations for the keywords table.
 * Keywords are associated with a business and can later be used for
 * ranking tracking. Each method returns the Supabase response.
 */
export class KeywordService {
  /** List all keywords for a business with pagination */
  static async listKeywords(businessId: string, filters: Record<string, any> = {}) {
    const page = parseInt(filters.page || '1');
    const limit = parseInt(filters.limit || '20');
    const offset = (page - 1) * limit;

    let query = supabase
      .from("keywords")
      .select("*", { count: 'exact' })
      .eq("business_id", businessId);

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    return query;
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
