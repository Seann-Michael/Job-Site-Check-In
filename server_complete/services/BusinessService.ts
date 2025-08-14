import { supabase } from "../supabaseClient";

/**
 * BusinessService encapsulates all database operations related to the
 * businesses table. Each method returns the Supabase response
 * so the caller can handle errors or data as needed.
 */
export class BusinessService {
  /**
   * Fetch all businesses owned by the given user. Agency admins or
   * super admins may want to retrieve all businesses; this implementation
   * filters by owner_id by default.
   */
  static async listBusinesses(ownerId: string) {
    return supabase
      .from("businesses")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
  }

  /**
   * Fetch a single business by its UUID primary key.
   */
  static async getBusiness(id: string) {
    return supabase.from("businesses").select("*").eq("id", id).single();
  }

  /**
   * Create a new business record. Accepts an object conforming to
   * the businesses table schema. Returns the inserted row on success.
   */
  static async createBusiness(data: Record<string, any>) {
    return supabase.from("businesses").insert(data).select().single();
  }

  /**
   * Update an existing business. Partial updates are allowed; only
   * fields present in the `updates` object will be modified.
   */
  static async updateBusiness(id: string, updates: Record<string, any>) {
    return supabase
      .from("businesses")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
  }

  /**
   * Delete a business by its id. Returns the deleted row on success.
   */
  static async deleteBusiness(id: string) {
    return supabase.from("businesses").delete().eq("id", id).select().single();
  }
}