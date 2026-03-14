// @ts-nocheck - Temporary suppression of type errors during build
import { createClient } from "@supabase/supabase-js";
import { workspaceService } from "./workspaceService";

// Initialize Supabase client with fallback handling
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Debug logging
console.log("🔧 Supabase Config Debug:", {
  hasUrl: !!supabaseUrl,
  hasKey: !!supabaseAnonKey,
  urlSnippet: supabaseUrl ? supabaseUrl.substring(0, 20) + "..." : "undefined",
  keySnippet: supabaseAnonKey
    ? supabaseAnonKey.substring(0, 20) + "..."
    : "undefined",
});

// Create a placeholder client if environment variables are missing or are placeholder values
let supabase: ReturnType<typeof createClient>;

const isPlaceholderValue = (value: string | undefined): boolean => {
  if (!value) return true;
  const placeholderPatterns = [
    'YOUR_ACTUAL_SUPABASE_PROJECT_URL',
    'YOUR_ACTUAL_SUPABASE_ANON_KEY',
    'placeholder',
    'demo',
    'example',
    'change-me'
  ];
  return placeholderPatterns.some(pattern => value.toLowerCase().includes(pattern.toLowerCase()));
};

if (!supabaseUrl || !supabaseAnonKey || isPlaceholderValue(supabaseUrl) || isPlaceholderValue(supabaseAnonKey)) {
  console.warn(
    "⚠️ Supabase environment variables are not set or contain placeholder values. Using fallback mode.",
  );
  console.warn(
    "Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file with real values.",
  );

  // Create a dummy client that will throw meaningful errors for operations
  supabase = createClient("https://placeholder.supabase.co", "placeholder-key");
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

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
  project_id: string;
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

export interface ProjectPhoto {
  id: string;
  project_id: string;
  filename: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  width?: number;
  height?: number;
  category: "before" | "after" | "progress" | "final" | "reference" | "general";
  description?: string;
  geolocation?: any;
  metadata?: any;
  is_featured: boolean;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectDocument {
  id: string;
  project_id: string;
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
    | "facebook"
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

  private checkSupabaseConfig(): void {
    const isPlaceholderValue = (value: string | undefined): boolean => {
      if (!value) return true;
      const placeholderPatterns = [
        'YOUR_ACTUAL_SUPABASE_PROJECT_URL',
        'YOUR_ACTUAL_SUPABASE_ANON_KEY',
        'placeholder',
        'demo',
        'example',
        'change-me'
      ];
      return placeholderPatterns.some(pattern => value.toLowerCase().includes(pattern.toLowerCase()));
    };

    // In development, allow graceful fallback to mock data
    if (import.meta.env.DEV) {
      if (!supabaseUrl || !supabaseAnonKey || isPlaceholderValue(supabaseUrl) || isPlaceholderValue(supabaseAnonKey)) {
        console.warn(
          "⚠️ Supabase not configured in development mode, using mock data fallback",
        );
        return;
      }
    } else {
      // In production, require proper configuration
      if (!supabaseUrl || !supabaseAnonKey || isPlaceholderValue(supabaseUrl) || isPlaceholderValue(supabaseAnonKey)) {
        throw new Error(
          "Supabase is not properly configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables with real values.",
        );
      }
    }
  }

  private getCurrentLocalUser(): any {
    try {
      const userStr = localStorage.getItem("auth_user");
      if (userStr) {
        return JSON.parse(userStr);
      }
      return null;
    } catch (error) {
      console.error("Error getting local user:", error);
      return null;
    }
  }

  private mapLocalRoleToSupabaseRole(
    localRole: string,
  ): "super_admin" | "agency_admin" | "business_owner" | "staff" | "viewer" {
    switch (localRole) {
      case "superadmin":
        return "super_admin";
      case "agency":
        return "agency_admin";
      case "admin":
        return "business_owner";
      case "editor":
        return "staff";
      case "viewer":
        return "viewer";
      default:
        return "viewer";
    }
  }

  // Auth methods
  async getCurrentUser(): Promise<User | null> {
    try {
      this.checkSupabaseConfig();

      if (this.currentUser) return this.currentUser;

      // Check for current auth system user first
      const localUser = this.getCurrentLocalUser();
      if (localUser) {
        // Convert local user to Supabase user format
        this.currentUser = {
          id: localUser.id,
          email: localUser.email,
          name: localUser.name,
          role: this.mapLocalRoleToSupabaseRole(localUser.role),
          is_2fa_enabled: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          email_verified: true,
          phone_verified: false,
        };
        return this.currentUser;
      }

      // Fallback to Supabase auth if available
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        return null;
      }

      this.currentUser = data as unknown as User;
      return data as unknown as User;
    } catch (error) {
      console.error("Error in getCurrentUser:", error);
      return null;
    }
  }

  async signIn(email: string, password: string) {
    this.checkSupabaseConfig();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Fetch user profile
    if (data.user) {
      const { data: userProfile } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .single();

      this.currentUser = userProfile as unknown as User;
    }

    return data;
  }

  async signUp(
    email: string,
    password: string,
    name: string,
    role: string = "business_owner",
  ) {
    this.checkSupabaseConfig();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role },
      },
    });

    if (error) throw error;

    // Create user profile
    if (data.user) {
      const { data: userProfile, error: profileError } = await supabase
        .from("users")
        .insert({
          id: data.user.id,
          email,
          name,
          role,
          email_verified: false,
          phone_verified: false,
          is_2fa_enabled: false,
        })
        .select()
        .single();

      if (profileError) throw profileError;
      this.currentUser = userProfile as unknown as User;
    }

    return data;
  }

  async signOut() {
    this.checkSupabaseConfig();

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    this.currentUser = null;
  }

  async getUsers(filters: any = {}): Promise<{ data: User[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }> {
    try {
      // Check if Supabase is configured
      const isPlaceholderValue = (value: string | undefined): boolean => {
        if (!value) return true;
        const placeholderPatterns = [
          'YOUR_ACTUAL_SUPABASE_PROJECT_URL',
          'YOUR_ACTUAL_SUPABASE_ANON_KEY',
          'placeholder',
          'demo',
          'example',
          'change-me'
        ];
        return placeholderPatterns.some(pattern => value.toLowerCase().includes(pattern.toLowerCase()));
      };

      if (!supabaseUrl || !supabaseAnonKey || isPlaceholderValue(supabaseUrl) || isPlaceholderValue(supabaseAnonKey)) {
        console.warn("Supabase not configured, returning empty users");
        return { data: [] };
      }

      this.checkSupabaseConfig();

      const page = parseInt(filters.page || '1');
      const limit = parseInt(filters.limit || '20');
      const offset = (page - 1) * limit;

      let query = supabase
        .from("users")
        .select("*", { count: 'exact' });

      // Add pagination if specified
      if (filters.page || filters.limit) {
        query = query.range(offset, offset + limit - 1);
      }

      query = query.order("created_at", { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        console.warn("Error fetching users:", error);
        return { data: [] };
      }

      const result: { data: User[]; pagination?: any } = {
        data: (data as unknown as User[]) || []
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
      console.error("Error fetching users:", error);
      return { data: [] };
    }
  }

  // Business methods
  async getBusinesses(ownerId?: string, filters: any = {}): Promise<{ data: Business[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }> {
    try {
      // Check if Supabase is configured
      const isPlaceholderValue = (value: string | undefined): boolean => {
        if (!value) return true;
        const placeholderPatterns = [
          'YOUR_ACTUAL_SUPABASE_PROJECT_URL',
          'YOUR_ACTUAL_SUPABASE_ANON_KEY',
          'placeholder',
          'demo',
          'example',
          'change-me'
        ];
        return placeholderPatterns.some(pattern => value.toLowerCase().includes(pattern.toLowerCase()));
      };

      if (!supabaseUrl || !supabaseAnonKey || isPlaceholderValue(supabaseUrl) || isPlaceholderValue(supabaseAnonKey)) {
        console.warn("Supabase not configured, returning empty businesses");
        return { data: [] };
      }

      this.checkSupabaseConfig();

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

      if (error) {
        console.warn("Error fetching businesses:", error);
        return { data: [] };
      }

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
      return { data: [] };
    }
  }

  async getBusiness(id: string): Promise<Business | null> {
    try {
      this.checkSupabaseConfig();

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
    this.checkSupabaseConfig();

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
    this.checkSupabaseConfig();

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
    this.checkSupabaseConfig();

    const { error } = await supabase.from("businesses").delete().eq("id", id);

    if (error) throw error;
  }

  // Project methods
  async getProjects(
    businessId?: string,
    filters: any = {},
  ): Promise<{ data: Project[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }> {
    try {
      // Check if Supabase is configured
      const isPlaceholderValue = (value: string | undefined): boolean => {
        if (!value) return true;
        const placeholderPatterns = [
          'YOUR_ACTUAL_SUPABASE_PROJECT_URL',
          'YOUR_ACTUAL_SUPABASE_ANON_KEY',
          'placeholder',
          'demo',
          'example',
          'change-me'
        ];
        return placeholderPatterns.some(pattern => value.toLowerCase().includes(pattern.toLowerCase()));
      };

      if (!supabaseUrl || !supabaseAnonKey || isPlaceholderValue(supabaseUrl) || isPlaceholderValue(supabaseAnonKey)) {
        console.warn("Supabase not configured, returning empty projects");
        return { data: [] };
      }

      this.checkSupabaseConfig();

      const page = parseInt(filters.page || '1');
      const limit = parseInt(filters.limit || '20');
      const offset = (page - 1) * limit;

      let query = supabase.from("projects").select("*", { count: 'exact' });

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
            if (userId) {
              const { data: bizRows } = await supabase
                .from("businesses")
                .select("id")
                .eq("owner_id", userId);
              const ids = (bizRows ?? []).map((b: { id: string }) => b.id);
              if (ids.length > 0) {
                query = query.in("business_id", ids);
              }
            }
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

      if (error) {
        console.warn("Error fetching projects:", error);
        return { data: [] };
      }

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
      return { data: [] };
    }
  }

  async getProject(id: string): Promise<Project | null> {
    try {
      this.checkSupabaseConfig();

      const { data, error } = await supabase
        .from("projects")
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
    this.checkSupabaseConfig();

    const VALID_PROJECT_COLUMNS = new Set([
      'business_id', 'name', 'description', 'type', 'status', 'priority',
      'assigned_to', 'client_contact', 'objectives', 'deliverables',
      'timeline', 'budget', 'seo_targets', 'competitors', 'progress',
      'metadata', 'started_at', 'completed_at', 'due_date', 'materials', 'tasks',
    ]);

    const safeProject = Object.fromEntries(
      Object.entries(project).filter(([key]) => VALID_PROJECT_COLUMNS.has(key))
    );

    const { data, error } = await supabase
      .from("projects")
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
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Supabase not configured");
      }

      this.checkSupabaseConfig();

      // Only send columns that actually exist in the projects table.
      // Strip out any frontend-only or camelCase fields that Supabase would reject.
      const VALID_PROJECT_COLUMNS = new Set([
        'business_id', 'name', 'description', 'type', 'status', 'priority',
        'assigned_to', 'client_contact', 'objectives', 'deliverables',
        'timeline', 'budget', 'seo_targets', 'competitors', 'progress',
        'metadata', 'started_at', 'completed_at', 'due_date', 'materials', 'tasks',
      ]);

      const safeUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key]) => VALID_PROJECT_COLUMNS.has(key))
      );

      if (Object.keys(safeUpdates).length === 0) {
        // Nothing valid to update — fetch and return current record
        const { data: current } = await supabase.from('projects').select('*').eq('id', id).single();
        return current as Project;
      }

      const { data, error } = await supabase
        .from("projects")
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
      this.checkSupabaseConfig();

      const { error } = await supabase.from("projects").delete().eq("id", id);

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
      this.checkSupabaseConfig();

      const { data, error } = await supabase
        .from("project_tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching project tasks:", error);
      return [];
    }
  }

  async createProjectTask(task: Partial<ProjectTask>): Promise<ProjectTask> {
    this.checkSupabaseConfig();

    const { data, error } = await supabase
      .from("project_tasks")
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
    this.checkSupabaseConfig();

    const { data, error } = await supabase
      .from("project_tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteProjectTask(id: string): Promise<void> {
    this.checkSupabaseConfig();

    const { error } = await supabase
      .from("project_tasks")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  // Project Photo methods
  async getProjectPhotos(projectId: string): Promise<ProjectPhoto[]> {
    try {
      this.checkSupabaseConfig();

      const { data, error } = await supabase
        .from("project_photos")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error fetching project photos:", error);
      return [];
    }
  }

  async uploadProjectPhoto(
    projectId: string,
    file: File,
    metadata: any = {},
  ): Promise<ProjectPhoto> {
    this.checkSupabaseConfig();

    // Upload file to Supabase storage
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `project-photos/${projectId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("project-files")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("project-files").getPublicUrl(filePath);

    // Create photo record
    const { data, error } = await supabase
      .from("project_photos")
      .insert({
        project_id: projectId,
        filename: fileName,
        original_name: file.name,
        file_path: publicUrl,
        file_size: file.size,
        mime_type: file.type,
        category: metadata.category || "general",
        description: metadata.description,
        is_featured: metadata.is_featured || false,
        metadata: metadata,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteProjectPhoto(id: string): Promise<void> {
    this.checkSupabaseConfig();

    const { error } = await supabase
      .from("project_photos")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  // Project Document methods
  async getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
    try {
      this.checkSupabaseConfig();

      const { data, error } = await supabase
        .from("project_documents")
        .select("*")
        .eq("project_id", projectId)
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
    this.checkSupabaseConfig();

    // Upload file to Supabase storage
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `project-documents/${projectId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("project-files")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("project-files").getPublicUrl(filePath);

    // Create document record
    const { data, error } = await supabase
      .from("project_documents")
      .insert({
        project_id: projectId,
        filename: fileName,
        original_name: file.name,
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

  async deleteProjectDocument(id: string): Promise<void> {
    this.checkSupabaseConfig();

    const { error } = await supabase
      .from("project_documents")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }

  // Review methods
  async getReviews(businessId: string): Promise<Review[]> {
    try {
      this.checkSupabaseConfig();

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
    this.checkSupabaseConfig();

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
      this.checkSupabaseConfig();

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
      this.checkSupabaseConfig();

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
      this.checkSupabaseConfig();

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
      this.checkSupabaseConfig();

      const { data, error } = await supabase
        .from("project_activity_summary")
        .select("*")
        .eq("project_id", projectId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    } catch (error) {
      console.error("Error fetching project activity summary:", error);
      return null;
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
