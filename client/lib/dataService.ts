import { supabaseClient as supabase } from "./supabaseClient";
import { workspaceService } from "./workspaceService";

export { supabase };

// Types for our data structures
export interface Project {
  id: string;
  business_id: string;
  name: string;
  description: string;
  type:
    | "seo_audit"
    | "local_optimization"
    | "content_marketing"
    | "reputation_management"
    | "technical_seo"
    | "link_building"
    | "ongoing_optimization";
  status:
    | "draft"
    | "active"
    | "in_progress"
    | "paused"
    | "completed"
    | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to?: string;
  client_contact?: {
    name: string;
    email: string;
    phone: string;
  };
  objectives?: string[];
  deliverables?: string[];
  timeline?: any;
  budget?: any;
  seo_targets?: any;
  competitors?: any;
  progress?: any;
  metadata?: any;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  due_date?: string;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  address: any;
  phone: string;
  email: string;
  website?: string;
  category: string;
  subcategory?: string;
  google_place_id?: string;
  google_my_business?: any;
  business_hours?: any;
  social_media?: any;
  metadata?: any;
  status:
    | "active"
    | "inactive"
    | "pending_verification"
    | "suspended"
    | "deleted";
  created_at: string;
  updated_at: string;
  verified_at?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "super_admin" | "agency_admin" | "business_owner" | "staff" | "viewer";
  is_2fa_enabled: boolean;
  avatar_url?: string;
  phone?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
  last_login?: string;
  email_verified: boolean;
  phone_verified: boolean;
}

export interface ProjectTask {
  id: string;
  job_id: string;
  title: string;
  description?: string;
  status:
    | "todo"
    | "in_progress"
    | "review"
    | "completed"
    | "cancelled"
    | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to?: string;
  assigned_by?: string;
  estimated_hours?: number;
  actual_hours?: number;
  due_date?: string;
  started_at?: string;
  completed_at?: string;
  dependencies?: any;
  labels?: string[];
  progress_percentage: number;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface ProjectMedia {
  id: string;
  job_id: string;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  media_type: "image" | "video" | "document";
  width?: number;
  height?: number;
  duration_seconds?: number;
  category: "before" | "after" | "progress" | "final" | "reference" | "general" | "walkthrough" | "demonstration";
  description?: string;
  geolocation?: any;
  metadata?: any;
  is_featured: boolean;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

// Legacy alias for backward compatibility
export type ProjectPhoto = ProjectMedia;

export interface ProjectDocument {
  id: string;
  job_id: string;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  document_type:
    | "contract"
    | "proposal"
    | "report"
    | "invoice"
    | "receipt"
    | "correspondence"
    | "technical"
    | "legal"
    | "general";
  description?: string;
  tags?: string[];
  version: number;
  is_final: boolean;
  access_level: "public" | "client" | "team" | "admin" | "private";
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  business_id: string;
  platform:
    | "google"
    | "yelp"
    | "tripadvisor"
    | "better_business_bureau"
    | "glassdoor"
    | "custom";
  platform_review_id?: string;
  rating: number;
  title?: string;
  text: string;
  author?: any;
  date: string;
  response?: any;
  sentiment?: any;
  keywords_mentioned?: string[];
  photos?: any;
  is_verified: boolean;
  is_featured: boolean;
  metadata?: any;
  created_at: string;
  updated_at: string;
}

/**
 * DataService handles all interactions with Supabase for the application.
 * It provides a clean interface for CRUD operations on all entities.
 */
export class DataService {
  private static instance: DataService;
  private currentUser: User | null = null;

  static getInstance(): DataService {
    if (!DataService.instance) {
      DataService.instance = new DataService();
    }
    return DataService.instance;
  }

  // Auth methods
  async getCurrentUser(): Promise<User | null> {
    try {

      if (this.currentUser) return this.currentUser;

      // Identity comes solely from the Supabase auth session.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching user profile:", error);
        return null;
      }
      if (!data) {
        console.warn("No public.users profile for authenticated user", user.id);
        return null;
      }

      this.currentUser = data as unknown as User;
      return data as unknown as User;
    } catch (error) {
      console.error("Error in getCurrentUser:", error);
      return null;
    }
  }

  // Business methods
  async getBusinesses(ownerId?: string, filters: any = {}): Promise<{ data: Business[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }> {
    try {

      const user = await this.getCurrentUser();
      if (!user) {
        console.warn("User not authenticated, returning empty businesses");
        return { data: [] };
      }

      const page = parseInt(filters.page || '1');
      const limit = parseInt(filters.limit || '20');
      const offset = (page - 1) * limit;

      let query = supabase.from("businesses").select("*", { count: 'exact' });

      if (ownerId) {
        query = query.eq("owner_id", ownerId);
      } else if (user.role === "business_owner") {
        query = query.eq("owner_id", user.id);
      }

      // Add pagination if specified
      if (filters.page || filters.limit) {
        query = query.range(offset, offset + limit - 1);
      }

      query = query.order("created_at", { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      const result: { data: Business[]; pagination?: any } = {
        data: (data as unknown as Business[]) || []
      };

      // Add pagination info if paginated query was made
      if (filters.page || filters.limit) {
        result.pagination = {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        };
      }

      return result;
    } catch (error) {
      console.error("Error fetching businesses:", error);
      throw error instanceof Error ? error : new Error("Failed to fetch businesses");
    }
  }

  async getBusiness(id: string): Promise<Business | null> {
    try {

      const { data, error } = await supabase
        .from("businesses")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }
      return data as unknown as Business;
    } catch (error) {
      console.error("Error fetching business:", error);
      return null;
    }
  }

  async createBusiness(business: Partial<Business>): Promise<Business> {

    const user = await this.getCurrentUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("businesses")
      .insert({
        ...business,
        owner_id: user.id,
        status: "active",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateBusiness(
    id: string,
    updates: Partial<Business>,
  ): Promise<Business> {

    const { data, error } = await supabase
      .from("businesses")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteBusiness(id: string): Promise<void> {

    const { error } = await supabase.from("businesses").delete().eq("id", id);

    if (error) throw error;
  }

  // Project methods
  async getProjects(
    businessId?: string,
    filters: any = {},
  ): Promise<{ data: Project[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }> {
    try {

      const page = parseInt(filters.page || '1');
      const limit = parseInt(filters.limit || '20');
      const offset = (page - 1) * limit;

      let query = supabase.from("jobs").select("*", { count: 'exact' });

      if (businessId) {
        // Specific business requested by caller
        query = query.eq("business_id", businessId);
      } else {
        // Prefer the currently selected business in the workspace
        const currentBizId = workspaceService.getCurrentBusinessId();
        if (currentBizId) {
          query = query.eq("business_id", currentBizId);
        } else {
          // Fall back to all businesses the user owns
          const wsBusinessIds = workspaceService.getBusinessIds();
          if (wsBusinessIds.length > 0) {
            query = query.in("business_id", wsBusinessIds);
          } else {
            // Workspace not initialized yet — scope via sub-select
            const userId = workspaceService.getUserId();
            let ids: string[] = [];
            if (userId) {
              const { data: bizRows, error: bizError } = await supabase
                .from("businesses")
                .select("id")
                .eq("owner_id", userId);
              if (bizError) throw bizError;
              ids = (bizRows ?? []).map((b: { id: string }) => b.id);
            }
            // Never run an unscoped jobs query: no businesses means no jobs.
            if (ids.length === 0) {
              return { data: [] };
            }
            query = query.in("business_id", ids);
          }
        }
      }

      // Apply filters (excluding pagination params)
      Object.entries(filters).forEach(([key, value]) => {
        if (key !== 'page' && key !== 'limit' && value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });

      // Add pagination if specified
      if (filters.page || filters.limit) {
        query = query.range(offset, offset + limit - 1);
      }

      query = query.order("created_at", { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      const result: { data: Project[]; pagination?: any } = {
        data: (data as unknown as Project[]) || []
      };

      // Add pagination info if paginated query was made
      if (filters.page || filters.limit) {
        result.pagination = {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        };
      }

      return result;
    } catch (error) {
      console.error("Error fetching projects:", error);
      throw error instanceof Error ? error : new Error("Failed to fetch projects");
    }
  }

  async getProject(id: string): Promise<Project | null> {
    try {

      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // Not found
        throw error;
      }
      return data;
    } catch (error) {
      console.error("Error fetching project:", error);
      return null;
    }
  }

  async createProject(project: Partial<Project>): Promise<Project> {

    const VALID_PROJECT_COLUMNS = new Set([
      'business_id', 'client_id', 'name', 'description', 'type', 'status', 'priority',
      'assigned_to', 'client_contact', 'objectives', 'deliverables',
      'timeline', 'budget', 'seo_targets', 'competitors', 'progress',
      'metadata', 'started_at', 'completed_at', 'due_date', 'materials', 'tasks',
    ]);

    const safeProject = Object.fromEntries(
      Object.entries(project).filter(([key]) => VALID_PROJECT_COLUMNS.has(key))
    );

    const { data, error } = await supabase
      .from("jobs")
      .insert({
        ...safeProject,
        status: project.status || "draft",
      })
      .select()
      .single();

    if (error) {
      const msg = typeof error === 'object' && error !== null && 'message' in error
        ? (error as any).message
        : JSON.stringify(error);
      throw new Error(`Failed to create project: ${msg}`);
    }
    return data;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    try {

      // Only send columns that actually exist in the projects table.
      // Strip out any frontend-only or camelCase fields that Supabase would reject.
      const VALID_PROJECT_COLUMNS = new Set([
        'business_id', 'client_id', 'name', 'description', 'type', 'status', 'priority',
        'assigned_to', 'client_contact', 'objectives', 'deliverables',
        'timeline', 'budget', 'seo_targets', 'competitors', 'progress',
        'metadata', 'started_at', 'completed_at', 'due_date', 'materials', 'tasks',
      ]);

      const safeUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => VALID_PROJECT_COLUMNS.has(key))
      );

      if (Object.keys(safeUpdates).length === 0) {
        // Nothing valid to update — fetch and return current record
        const { data: current } = await supabase.from('jobs').select('*').eq('id', id).single();
        return current as Project;
      }

      const { data, error } = await supabase
        .from("jobs")
        .update(safeUpdates)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        const msg = typeof error === 'object' && error !== null && 'message' in error
          ? (error as any).message
          : JSON.stringify(error);
        console.error("Supabase update error:", msg);
        throw new Error(`Failed to update project: ${msg}`);
      }
      return data;
    } catch (error) {
      const msg = error instanceof Error ? error.message : JSON.stringify(error);
      console.error("Error in updateProject:", msg);
      throw error;
    }
  }

  async deleteProject(id: string): Promise<void> {
    try {

      const { error } = await supabase.from("jobs").delete().eq("id", id);

      if (error) {
        console.error("Supabase delete error:", error);
        throw new Error(`Failed to delete project: ${error.message}`);
      }
    } catch (error) {
      console.error("Error in deleteProject:", error);
      throw error;
    }
  }

  // Project Task methods
  async getProjectTasks(projectId: string): Promise<ProjectTask[]> {
    try {

      const { data, error } = await supabase
        .from("job_tasks")
        .select("*")
        .eq("job_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching project tasks:", error);
      return [];
    }
  }

  async createProjectTask(task: Partial<ProjectTask>): Promise<ProjectTask> {

    const { data, error } = await supabase
      .from("job_tasks")
      .insert({
        ...task,
        status: task.status || "todo",
        progress_percentage: task.progress_percentage || 0,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateProjectTask(
    id: string,
    updates: Partial<ProjectTask>,
  ): Promise<ProjectTask> {

    const { data, error } = await supabase
      .from("job_tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteProjectTask(id: string): Promise<void> {

    const { error } = await supabase
      .from("job_tasks")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  // Project Media methods (photos, videos, documents)
  async getProjectMedia(projectId: string): Promise<ProjectMedia[]> {
    try {

      const { data, error } = await supabase
        .from("job_media")
        .select("*")
        .eq("job_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching project media:", error);
      return [];
    }
  }

  async getProjectPhotos(projectId: string): Promise<ProjectMedia[]> {
    // Legacy method - returns all media items (photos and videos)
    return this.getProjectMedia(projectId);
  }

  async uploadProjectMedia(
    projectId: string,
    file: File,
    metadata: any = {},
  ): Promise<ProjectMedia> {

    // Ensure file is a File object
    if (!file || !file.name || typeof file.type !== "string") {
      throw new Error("Invalid file object provided for upload");
    }

    // Determine media type based on MIME type or file extension
    let mediaType: "image" | "video" | "document" = "document";
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
    const videoExtensions = ["mp4", "mov", "avi", "mkv", "webm", "flv", "wmv", "m4v"];
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"];

    if (file.type && file.type.startsWith("image/")) {
      mediaType = "image";
    } else if (file.type && file.type.startsWith("video/")) {
      mediaType = "video";
    } else if (videoExtensions.includes(fileExtension)) {
      // Fallback: check file extension for video
      mediaType = "video";
    } else if (imageExtensions.includes(fileExtension)) {
      // Fallback: check file extension for image
      mediaType = "image";
    }

    // Upload file to Supabase storage
    const fileExt = file.name.split(".").pop();
    const uid = Math.random().toString(36).substr(2, 8);
    const fileName = `${Date.now()}-${uid}.${fileExt}`;
    const filePath = `project-media/${projectId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(filePath, file, { upsert: false });

    if (uploadError) throw uploadError;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(filePath);

    // Attribution both apps can read: the uploaded_by column carries the auth
    // user id (the mobile app's "My Stuff" scope filters on it) and metadata
    // carries the display name (both galleries read metadata.uploaded_by_name).
    // Previously nothing set the column and metadata got a hardcoded
    // "Current User", so mobile could never attribute a web upload.
    const uploader = await this.getCurrentUser().catch(() => null);
    const uploaderId =
      uploader?.id &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uploader.id)
        ? uploader.id
        : undefined;
    const uploaderName = uploader?.name || uploader?.email || undefined;

    const mediaRecord = {
      job_id: projectId,
      filename: fileName,
      original_name: file.name,
      file_path: publicUrl,
      file_size: file.size,
      mime_type: file.type,
      media_type: mediaType,
      category: metadata.category || "general",
      description: metadata.description,
      is_featured: metadata.is_featured || false,
      metadata: {
        ...metadata,
        ...(uploaderId ? { uploaded_by: uploaderId } : {}),
        ...(uploaderName ? { uploaded_by_name: uploaderName } : {}),
      },
      ...(uploaderId ? { uploaded_by: uploaderId } : {}),
    };

    // Create media record
    let { data, error } = await supabase
      .from("job_media")
      .insert(mediaRecord)
      .select()
      .single();

    if (
      error &&
      uploaderId &&
      (error.code === "23503" || /foreign key|uuid/i.test(error.message || ""))
    ) {
      // The database refused the uploader id (no matching users row): keep the
      // upload and the name in metadata, drop only the column.
      const { uploaded_by: _droppedUploader, ...withoutUploader } = mediaRecord;
      ({ data, error } = await supabase
        .from("job_media")
        .insert(withoutUploader)
        .select()
        .single());
    }

    if (error) throw error;
    return data;
  }

  async uploadProjectPhoto(
    projectId: string,
    file: File,
    metadata: any = {},
  ): Promise<ProjectMedia> {
    // Legacy method - uses the new uploadProjectMedia method
    return this.uploadProjectMedia(projectId, file, metadata);
  }

  async uploadClientMedia(
    clientId: string,
    file: File,
    metadata: any = {},
  ): Promise<ProjectMedia> {

    if (!file || !file.name || typeof file.type !== "string") {
      throw new Error("Invalid file object provided for upload");
    }

    let mediaType: "image" | "video" | "document" = "document";
    const fileExtension = file.name.split(".").pop()?.toLowerCase() || "";
    const videoExtensions = ["mp4", "mov", "avi", "mkv", "webm", "flv", "wmv", "m4v"];
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"];

    if (file.type && file.type.startsWith("image/")) {
      mediaType = "image";
    } else if (file.type && file.type.startsWith("video/")) {
      mediaType = "video";
    } else if (videoExtensions.includes(fileExtension)) {
      mediaType = "video";
    } else if (imageExtensions.includes(fileExtension)) {
      mediaType = "image";
    }

    const fileExt = file.name.split(".").pop();
    const uid = Math.random().toString(36).substr(2, 8);
    const fileName = `${Date.now()}-${uid}.${fileExt}`;
    const filePath = `client-media/${clientId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(filePath, file, { upsert: false });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(filePath);

    const { data, error } = await supabase
      .from("job_media")
      .insert({
        client_id: clientId,
        job_id: null,
        filename: fileName,
        original_name: file.name,
        file_path: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        media_type: mediaType,
        category: metadata.category || "general",
        description: metadata.description,
        is_featured: false,
        metadata: metadata,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getClientMedia(clientId: string): Promise<ProjectMedia[]> {
    try {
      const { data, error } = await supabase
        .from("job_media")
        .select("*")
        .eq("client_id", clientId)
        .is("job_id", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching client media:", error);
      return [];
    }
  }

  /** Object key inside the 'media' bucket, recovered from a stored public URL. */
  private mediaStorageKey(url?: string | null): string | undefined {
    if (!url) return undefined;
    const marker = "/storage/v1/object/public/media/";
    const index = url.indexOf(marker);
    if (index === -1) return undefined;
    const key = url.slice(index + marker.length).split("?")[0];
    if (!key) return undefined;
    try {
      return decodeURIComponent(key);
    } catch {
      return key;
    }
  }

  /**
   * Keys for every object a media row points at: the original, plus the
   * thumbs/ copy the mobile capture pipeline uploads beside it (recorded at
   * metadata.thumbnail_path, or derivable from the original's key — removing
   * a key that never existed is a no-op, not an error).
   */
  private mediaObjectKeys(filePath?: string | null, metadata?: any): string[] {
    const key = this.mediaStorageKey(filePath);
    if (!key) return [];
    const keys = [key];
    let thumbKey = this.mediaStorageKey(metadata?.thumbnail_path);
    if (!thumbKey) {
      const slash = key.lastIndexOf("/");
      if (slash !== -1) {
        const name = key.slice(slash + 1).replace(/\.[^.]+$/, "");
        thumbKey = `${key.slice(0, slash)}/thumbs/${name}.jpg`;
      }
    }
    if (thumbKey && thumbKey !== key) keys.push(thumbKey);
    return keys;
  }

  async deleteProjectMedia(id: string): Promise<void> {

    // Read the row first: it is the only record of which objects in the
    // public 'media' bucket belong to it. Deleting only the row left the
    // file (and its thumbnail) fetchable by URL forever.
    const { data: row } = await supabase
      .from("job_media")
      .select("file_path, metadata")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase
      .from("job_media")
      .delete()
      .eq("id", id);

    if (error) throw error;

    // Best-effort: the row is gone either way, and an orphaned object costs
    // storage, not correctness.
    const keys = this.mediaObjectKeys(row?.file_path, row?.metadata);
    if (keys.length) {
      try {
        await supabase.storage.from("media").remove(keys);
      } catch (storageError) {
        console.warn("Could not remove storage objects for media", id, storageError);
      }
    }
  }

  async deleteProjectPhoto(id: string): Promise<void> {
    // Legacy method - uses the new deleteProjectMedia method
    return this.deleteProjectMedia(id);
  }

  async updateProjectMedia(id: string, updates: Partial<ProjectMedia>): Promise<void> {
    const { error } = await supabase
      .from("job_media")
      .update(updates)
      .eq("id", id);
    if (error) throw error;
  }

  /** Set one media record as the primary/featured photo and clear is_featured on all others in the project */
  async setFeaturedMedia(projectId: string, mediaId: string): Promise<void> {
    // Clear all featured flags for this project first
    const { error: clearError } = await supabase
      .from("job_media")
      .update({ is_featured: false })
      .eq("job_id", projectId);
    if (clearError) throw clearError;
    // Set the target as featured
    const { error: setError } = await supabase
      .from("job_media")
      .update({ is_featured: true })
      .eq("id", mediaId);
    if (setError) throw setError;
  }

  /** Clear the featured flag for a specific media record */
  async clearFeaturedMedia(mediaId: string): Promise<void> {
    const { error } = await supabase
      .from("job_media")
      .update({ is_featured: false })
      .eq("id", mediaId);
    if (error) throw error;
  }

  /** Batch fetch featured media for multiple projects. Returns a map of projectId -> file_path */
  async getFeaturedMediaForProjects(projectIds: string[]): Promise<Record<string, string>> {
    if (!projectIds.length) return {};
    try {
      const { data, error } = await supabase
        .from("job_media")
        .select("job_id, file_path")
        .in("job_id", projectIds)
        .eq("is_featured", true)
        .eq("media_type", "image");

      if (error) throw error;

      const map: Record<string, string> = {};
      for (const row of data || []) {
        if (row.job_id && row.file_path && !map[row.job_id]) {
          map[row.job_id] = row.file_path;
        }
      }
      return map;
    } catch (error) {
      console.error("Error fetching featured media for projects:", error);
      return {};
    }
  }

  // Project Document methods
  async getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
    try {

      const { data, error } = await supabase
        .from("job_documents")
        .select("*")
        .eq("job_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching project documents:", error);
      return [];
    }
  }

  async uploadProjectDocument(
    projectId: string,
    file: File,
    metadata: any = {},
  ): Promise<ProjectDocument> {

    // Upload file to Supabase storage
    const fileExt = file.name.split(".").pop();
    const uid = Math.random().toString(36).substr(2, 8);
    const fileName = `${Date.now()}-${uid}.${fileExt}`;
    const filePath = `project-documents/${projectId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(filePath, file, { upsert: false });

    if (uploadError) throw uploadError;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(filePath);

    // Create document record
    const { data, error } = await supabase
      .from("job_documents")
      .insert({
        job_id: projectId,
        filename: fileName,
        original_name: metadata.custom_name || file.name,
        file_path: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        document_type: metadata.document_type || "general",
        description: metadata.description,
        version: metadata.version || 1,
        is_final: metadata.is_final || false,
        access_level: metadata.access_level || "team",
        tags: metadata.tags || [],
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async uploadClientDocument(
    clientId: string,
    file: File,
    metadata: any = {},
  ): Promise<ProjectDocument> {

    const fileExt = file.name.split(".").pop();
    const uid = Math.random().toString(36).substr(2, 8);
    const fileName = `${Date.now()}-${uid}.${fileExt}`;
    const filePath = `client-documents/${clientId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("media")
      .upload(filePath, file, { upsert: false });

    if (uploadError) throw uploadError;

    const {
      data: { publicUrl },
    } = supabase.storage.from("media").getPublicUrl(filePath);

    const { data, error } = await supabase
      .from("job_documents")
      .insert({
        client_id: clientId,
        job_id: null,
        filename: fileName,
        original_name: metadata.custom_name || file.name,
        file_path: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        document_type: metadata.document_type || "general",
        description: metadata.description,
        version: metadata.version || 1,
        is_final: metadata.is_final || false,
        access_level: metadata.access_level || "team",
        tags: metadata.tags || [],
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getClientDocuments(clientId: string): Promise<ProjectDocument[]> {
    try {

      const { data, error } = await supabase
        .from("job_documents")
        .select("*")
        .eq("client_id", clientId)
        .is("job_id", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching client documents:", error);
      return [];
    }
  }

  async deleteProjectDocument(id: string): Promise<void> {

    const { error } = await supabase
      .from("job_documents")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  // Review methods
  async getReviews(businessId: string): Promise<Review[]> {
    try {

      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("business_id", businessId)
        .order("date", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching reviews:", error);
      return [];
    }
  }

  async createReview(review: Partial<Review>): Promise<Review> {

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        ...review,
        is_verified: review.is_verified || false,
        is_featured: review.is_featured || false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Analytics methods
  async getAnalytics(
    businessId: string,
    dateRange?: { start: string; end: string },
  ) {
    try {

      let query = supabase
        .from("analytics")
        .select("*")
        .eq("business_id", businessId);

      if (dateRange) {
        query = query.gte("date", dateRange.start).lte("date", dateRange.end);
      }

      const { data, error } = await query.order("date", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching analytics:", error);
      return [];
    }
  }

  // Dashboard summary methods
  async getDashboardSummary(userId?: string) {
    try {

      const user = await this.getCurrentUser();
      if (!user && !userId) throw new Error("User not authenticated");

      const targetUserId = userId || user!.id;

      const { data, error } = await supabase
        .from("user_dashboard_summary")
        .select("*")
        .eq("user_id", targetUserId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    } catch (error) {
      console.error("Error fetching dashboard summary:", error);
      return null;
    }
  }

  async getBusinessPerformanceSummary(businessId: string) {
    try {

      const { data, error } = await supabase
        .from("business_performance_summary")
        .select("*")
        .eq("business_id", businessId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    } catch (error) {
      console.error("Error fetching business performance summary:", error);
      return null;
    }
  }

  async getProjectActivitySummary(projectId: string) {
    try {

      const { data, error } = await supabase
        .from("project_activity_summary")
        .select("*")
        .eq("job_id", projectId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    } catch (error) {
      console.error("Error fetching project activity summary:", error);
      return null;
    }
  }

  // Workflow methods
  async createWorkflow(businessId: string, name: string, steps: any[], description?: string, presetId?: string) {
    try {

      const { data, error } = await supabase
        .from("workflows")
        .insert({
          ...(presetId ? { id: presetId } : {}),
          business_id: businessId,
          name,
          description,
          steps,
          is_active: true,
          is_published: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error creating workflow:", error);
      throw error;
    }
  }

  async updateWorkflow(workflowId: string, updates: Record<string, any>) {
    try {

      const { data, error } = await supabase
        .from("workflows")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workflowId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error updating workflow:", error);
      throw error;
    }
  }

  async publishWorkflow(workflowId: string) {
    return this.updateWorkflow(workflowId, { is_published: true });
  }

  async getWorkflows(businessId: string) {
    try {

      const { data, error } = await supabase
        .from("workflows")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching workflows:", error);
      return [];
    }
  }

  async getWorkflow(workflowId: string) {
    try {

      const { data, error } = await supabase
        .from("workflows")
        .select("*")
        .eq("id", workflowId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error fetching workflow:", error);
      return null;
    }
  }

  async deleteWorkflow(workflowId: string) {
    try {

      const { error } = await supabase
        .from("workflows")
        .delete()
        .eq("id", workflowId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Error deleting workflow:", error);
      throw error;
    }
  }

  // Webhook URL generation
  async generateWebhookUrl(workflowId: string, businessId: string) {
    try {
      const response = await fetch("/api/workflows/webhook-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-business-id": businessId,
        },
        body: JSON.stringify({ workflowId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate webhook URL: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error generating webhook URL:", error);
      throw error;
    }
  }

  // Get workflow executions
  async getWorkflowExecutions(workflowId: string) {
    try {

      const { data, error } = await supabase
        .from("workflow_executions")
        .select("*")
        .eq("workflow_id", workflowId)
        .order("started_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching workflow executions:", error);
      return [];
    }
  }

  // Get webhook deliveries for an execution
  async getWebhookDeliveries(executionId: string, businessId: string) {
    try {
      const response = await fetch(`/api/workflows/deliveries/${executionId}`, {
        headers: {
          "x-business-id": businessId,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch deliveries: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching webhook deliveries:", error);
      return { success: false, deliveries: [] };
    }
  }
}

// Export singleton instance
export const dataService = DataService.getInstance();

// Export types for use in components
// Commented out to avoid conflicts - types are already exported elsewhere
// export type {
//   Project,
//   Business,
//   User,
//   ProjectTask,
//   ProjectPhoto,
//   ProjectDocument,
//   Review,
// };
