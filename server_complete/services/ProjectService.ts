import { supabase } from "../supabaseClient";

/**
 * ProjectService provides helper functions for CRUD operations on the
 * projects table. Each method wraps a Supabase query and returns
 * the full response for upstream error handling.
 */
export class ProjectService {
  /**
   * List all projects belonging to a specific business. Optionally
   * filter by status or assigned user.
   */
  static async listProjects(businessId: string, filters: Record<string, any> = {}) {
    let query = supabase.from("projects").select("*").eq("business_id", businessId);
    if (filters.status) {
      query = query.eq("status", filters.status);
    }
    if (filters.assigned_to) {
      query = query.eq("assigned_to", filters.assigned_to);
    }
    return query.order("created_at", { ascending: false });
  }

  /** Fetch a single project by its UUID. */
  static async getProject(id: string) {
    return supabase.from("projects").select("*").eq("id", id).single();
  }

  /** Create a new project record. */
  static async createProject(data: Record<string, any>) {
    return supabase.from("projects").insert(data).select().single();
  }

  /** Update an existing project. */
  static async updateProject(id: string, updates: Record<string, any>) {
    return supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
  }

  /** Delete a project by its id. */
  static async deleteProject(id: string) {
    return supabase.from("projects").delete().eq("id", id).select().single();
  }
}