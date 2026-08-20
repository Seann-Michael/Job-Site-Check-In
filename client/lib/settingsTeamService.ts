/**
 * settingsTeamService.ts
 *
 * Thin client for the team-membership API (`/api/team/*`, `/api/admin/staff`).
 * Team membership lives in `business_members`; the owner is `businesses.owner_id`
 * and is never a member row.
 */
import { apiFetch } from "@/lib/api";

/** Roles a person can hold on a business (display order). */
export const TEAM_ROLES = [
  {
    value: "owner",
    label: "Owner",
    description: "Full access, including billing and team management",
  },
  {
    value: "staff",
    label: "Staff",
    description: "Can create and edit jobs, clients, media and reviews",
  },
  {
    value: "viewer",
    label: "Viewer",
    description: "Read-only access to everything in this business",
  },
] as const;

export type TeamRole = (typeof TEAM_ROLES)[number]["value"];

/** Roles that can be assigned to an invited member (owner is implicit). */
export type MemberRole = Exclude<TeamRole, "owner">;
export const MEMBER_ROLES = TEAM_ROLES.filter(
  (r): r is (typeof TEAM_ROLES)[1] | (typeof TEAM_ROLES)[2] => r.value !== "owner",
);

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  const found = TEAM_ROLES.find((r) => r.value === role);
  if (found) return found.label;
  if (role === "business_owner") return "Owner";
  if (role === "super_admin") return "Super Admin";
  if (role === "agency_admin") return "Agency Admin";
  return role.replace(/_/g, " ");
}

export interface TeamOwner {
  id: string;
  email: string;
  name: string | null;
}

export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: MemberRole;
  status: "active" | "invited";
  createdAt: string;
}

export interface BusinessTeam {
  owner: TeamOwner;
  members: TeamMember[];
}

export async function fetchBusinessTeam(businessId: string): Promise<BusinessTeam> {
  const res = await apiFetch<BusinessTeam>(
    `/api/team/${encodeURIComponent(businessId)}`,
  );
  return { owner: res.owner, members: res.members ?? [] };
}

export async function inviteTeamMember(
  businessId: string,
  input: { email: string; role: MemberRole; name?: string },
): Promise<TeamMember> {
  return apiFetch<TeamMember>(
    `/api/team/${encodeURIComponent(businessId)}/invite`,
    {
      method: "POST",
      body: {
        email: input.email.trim(),
        role: input.role,
        ...(input.name?.trim() ? { name: input.name.trim() } : {}),
      },
    },
  );
}

export async function updateTeamMemberRole(
  businessId: string,
  memberId: string,
  role: MemberRole,
): Promise<TeamMember> {
  return apiFetch<TeamMember>(
    `/api/team/${encodeURIComponent(businessId)}/members/${encodeURIComponent(memberId)}`,
    { method: "PATCH", body: { role } },
  );
}

export async function removeTeamMember(
  businessId: string,
  memberId: string,
): Promise<void> {
  await apiFetch(
    `/api/team/${encodeURIComponent(businessId)}/members/${encodeURIComponent(memberId)}`,
    { method: "DELETE" },
  );
}

/** Super admin only: invite an internal user who becomes a super admin. */
export async function inviteInternalUser(input: {
  email: string;
  name?: string;
}): Promise<{ id?: string; email: string }> {
  return apiFetch<{ id?: string; email: string }>("/api/admin/staff/invite", {
    method: "POST",
    body: {
      email: input.email.trim(),
      role: "super_admin",
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
    },
  });
}
