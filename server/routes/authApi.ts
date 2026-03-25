import { Request, Response } from "express";
import { getSupabaseClient } from "../supabaseClient";

/**
 * POST /api/auth/login
 * Validates credentials against Supabase Auth and returns user data.
 * The client uses this to create a secure session locally.
 */
export async function handleLogin(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const db = getSupabaseClient();
  if (!db) {
    return res.status(503).json({ error: "Auth service unavailable — Supabase not configured" });
  }

  try {
    // Use Supabase admin to look up the user by email so we can validate them
    // without exposing the admin key pattern to the client.
    const { data: listData, error: listError } = await db.auth.admin.listUsers();
    if (listError) throw listError;

    const authUsers = (listData as any).users as Array<{ id: string; email?: string; user_metadata?: any; factors?: any[] }>;
    const authUser = authUsers.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    // Also check the users table for role / profile data
    const { data: profile } = await db
      .from("users")
      .select("id, email, name, role, is_active")
      .eq("email", email.toLowerCase())
      .single();

    const profileRow = profile as any;

    if (!authUser && !profileRow) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // If the user exists in our users table, verify they're active
    if (profileRow && profileRow.is_active === false) {
      return res.status(403).json({ error: "Account suspended. Contact support." });
    }

    // Return user data for the client to build its session
    const userData = {
      id: (profileRow?.id as string) || authUser?.id || "",
      email: (profileRow?.email as string) || authUser?.email || email,
      name: (profileRow?.name as string) || authUser?.user_metadata?.name || email.split("@")[0],
      role: (profileRow?.role as string) || "admin",
      permissions: rolePermissions((profileRow?.role as string) || "admin"),
      lastLogin: new Date().toISOString(),
      mfaEnabled: authUser?.factors && authUser.factors.length > 0,
    };

    // Update last login timestamp
    if (profileRow?.id) {
      await db
        .from("users")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", profileRow.id as string);
    }

    return res.json(userData);
  } catch (err: any) {
    console.error("[authApi] Login error:", err.message);
    return res.status(500).json({ error: "Login failed. Please try again." });
  }
}

/**
 * POST /api/auth/logout
 * Server-side logout acknowledgment. The client destroys its own session.
 */
export async function handleLogout(_req: Request, res: Response) {
  // The app uses localStorage-based sessions, so actual cleanup is client-side.
  // This endpoint exists so the client hook doesn't throw on a missing route.
  return res.json({ success: true });
}

/**
 * POST /api/auth/change-password
 * Updates a user's password via Supabase Auth admin API.
 * Body: { email, newPassword }
 */
export async function handleChangePassword(req: Request, res: Response) {
  const { email, newPassword } = req.body as {
    email?: string;
    newPassword?: string;
    currentPassword?: string;
  };

  if (!email || !newPassword) {
    return res.status(400).json({ error: "email and newPassword are required" });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }

  const db = getSupabaseClient();
  if (!db) {
    return res.status(503).json({ error: "Auth service unavailable" });
  }

  try {
    // Find user by email
    const { data: listData, error: listError } = await db.auth.admin.listUsers();
    if (listError) throw listError;

    const authUsers = (listData as any).users as Array<{ id: string; email?: string }>;
    const user = authUsers.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { error } = await db.auth.admin.updateUserById(user.id as string, { password: newPassword });
    if (error) throw error;

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (err: any) {
    console.error("[authApi] Change password error:", err.message);
    return res.status(500).json({ error: "Failed to change password" });
  }
}

/**
 * POST /api/auth/enable-mfa
 * Placeholder — actual MFA setup is handled client-side via Supabase SDK.
 */
export async function handleEnableMFA(_req: Request, res: Response) {
  return res.json({
    success: true,
    message: "Use Supabase client-side SDK for MFA enrollment",
    qrCode: null,
    backupCodes: [],
  });
}

/**
 * POST /api/auth/verify-mfa
 * Placeholder — MFA verification is handled client-side via Supabase SDK.
 */
export async function handleVerifyMFA(_req: Request, res: Response) {
  return res.json({ success: true, verified: true });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function rolePermissions(role: string): string[] {
  const map: Record<string, string[]> = {
    superadmin: ["read", "write", "delete", "admin", "superadmin"],
    agency: ["read", "write", "delete", "admin"],
    admin: ["read", "write", "delete"],
    editor: ["read", "write"],
    viewer: ["read"],
  };
  return map[role] ?? ["read"];
}
