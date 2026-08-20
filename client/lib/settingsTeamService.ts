import supabaseClient from "@/lib/supabaseClient";
import { isSuperAdmin } from "@/lib/auth";

/**
 * Business-level values of the `users.role` enum
 * (`user_role`: super_admin | agency_admin | business_owner | staff | viewer).
 * Platform roles (super_admin, agency_admin) are managed in Super Admin > Staff.
 */
export const TEAM_ROLES = [
  { value: "business_owner", label: "Owner", description: "Full access to this business" },
  { value: "staff", label: "Staff", description: "Work on assigned jobs and upload media" },
  { value: "viewer", label: "Viewer", description: "Read-only access" },
] as const;

export type TeamRole = (typeof TEAM_ROLES)[number]["value"];

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  const found = TEAM_ROLES.find((r) => r.value === role);
  if (found) return found.label;
  if (role === "super_admin") return "Super Admin";
  if (role === "agency_admin") return "Agency Admin";
  return role.replace(/_/g, " ");
}

export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: string;
  phone: string | null;
  last_login: string | null;
  created_at: string | null;
  email_verified?: boolean | null;
  isOwner: boolean;
}

/**
 * The people who belong to a business: its owner plus every user assigned to
 * one of its jobs. `users` has no business_id column — this mirrors how the
 * super-admin workspace detail page derives workspace users.
 */
export async function fetchBusinessTeam(businessId: string): Promise<TeamMember[]> {
  const { data: biz, error: bizError } = await supabaseClient
    .from("businesses")
    .select("owner_id")
    .eq("id", businessId)
    .maybeSingle();
  if (bizError) throw bizError;

  const { data: jobAssignees, error: jobsError } = await supabaseClient
    .from("jobs")
    .select("assigned_to")
    .eq("business_id", businessId)
    .not("assigned_to", "is", null);
  if (jobsError) throw jobsError;

  const ownerId: string | null = biz?.owner_id ?? null;
  const ids = [
    ...new Set(
      [ownerId, ...(jobAssignees ?? []).map((j: any) => j.assigned_to)].filter(
        Boolean,
      ),
    ),
  ] as string[];
  if (ids.length === 0) return [];

  const { data: users, error: usersError } = await supabaseClient
    .from("users")
    .select("id, name, email, role, phone, last_login, created_at, email_verified")
    .in("id", ids)
    // Super admins have access to every account but are not part of any
    // business's team; never surface them in tenant-facing lists.
    .neq("role", "super_admin")
    .order("created_at", { ascending: true });
  if (usersError) throw usersError;

  return (users ?? [])
    .filter((u: any) => u.role !== "super_admin")
    .map((u: any) => ({
      id: u.id,
      name: u.name ?? null,
      email: u.email,
      role: u.role ?? "",
      phone: u.phone ?? null,
      last_login: u.last_login ?? null,
      created_at: u.created_at ?? null,
      email_verified: u.email_verified ?? null,
      isOwner: u.id === ownerId,
    }));
}

export async function updateTeamMemberRole(userId: string, role: TeamRole) {
  // `users.role` is column-restricted by RLS: only super admins may change it.
  if (!isSuperAdmin()) {
    throw new Error(
      "Only a super admin can change team member roles. Contact support to request a role change.",
    );
  }
  const { error } = await supabaseClient
    .from("users")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}
