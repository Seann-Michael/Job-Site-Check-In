/**
 * adminUserService.ts
 *
 * Client for platform-level (super admin) user management.
 *
 * The ONLY server endpoint that creates a login-capable account for internal
 * staff is `POST /api/admin/staff/invite` (super admin only). It creates the
 * Supabase auth user, sends the invite email, and sets the role. There is no
 * generic "create business user" endpoint, so inserting a bare `public.users`
 * row (as older code did) produces an orphaned record that can never log in.
 *
 * Every "Add / Invite internal user" flow in the super-admin pages should route
 * through `inviteInternalUser` so the created person can actually sign in.
 */
import { apiFetch } from "@/lib/api";

export interface InviteInternalUserInput {
  email: string;
  name?: string;
}

export interface InviteInternalUserResult {
  id?: string;
  email: string;
}

/**
 * Super admin only: invite an internal user. The invited user receives an email
 * to set a password and joins the platform as a `super_admin`. (The invite
 * endpoint only supports the `super_admin` role today.)
 */
export async function inviteInternalUser(
  input: InviteInternalUserInput,
): Promise<InviteInternalUserResult> {
  return apiFetch<InviteInternalUserResult>("/api/admin/staff/invite", {
    method: "POST",
    body: {
      email: input.email.trim(),
      role: "super_admin",
      ...(input.name?.trim() ? { name: input.name.trim() } : {}),
    },
  });
}
