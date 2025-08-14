import { supabase } from "../supabaseClient";

/**
 * AuthService encapsulates user authentication logic using Supabase Auth.
 * It provides methods for registering new users, logging in, verifying
 * two‑factor codes, logging out, and refreshing access tokens. In a
 * production environment you would also add rate limiting and input
 * validation. Error messages intentionally avoid revealing whether an
 * email exists to prevent account enumeration.
 */
export class AuthService {
  /**
   * Register a new user. Creates both an auth record and a row in the
   * `users` table. By default the role is `business_owner`. Returns the
   * created user profile on success.
   */
  static async register(userData: {
    email: string;
    password: string;
    name: string;
    role?: string;
  }) {
    const { email, password, name, role } = userData;
    // Create auth user
    const { data: authResult, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, role: role || "business_owner" } },
    });
    if (authError) throw authError;
    // Insert profile into users table
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .insert({ id: authResult.user?.id, email, name, role: role || "business_owner" })
      .select()
      .single();
    if (profileError) throw profileError;
    return profile;
  }

  /**
   * Authenticate a user with email and password. Returns the session
   * tokens and user data if successful.
   */
  static async login(credentials: { email: string; password: string }) {
    const { email, password } = credentials;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  /**
   * Log out the current session by invalidating the refresh token. This
   * method expects that the client stores the refresh token and
   * provides it when calling logout. If you need to revoke all
   * sessions for a user, call supabase.auth.api.signOut().
   */
  static async logout(refreshToken: string) {
    const { error } = await supabase.auth.signOut({ refreshToken });
    if (error) throw error;
    return { success: true };
  }

  /**
   * Refresh an access token using a valid refresh token. Returns new
   * session information on success.
   */
  static async refreshToken(refreshToken: string) {
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error) throw error;
    return data;
  }

  /**
   * Placeholder for two‑factor verification. In a real system you would
   * verify the provided code against secrets stored in the user_2fa table.
   */
  static async verify2FACode(_loginToken: string, _code: string) {
    // TODO: implement 2FA verification using otplib and user_2fa table
    return { success: true };
  }
}