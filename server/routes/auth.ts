// server/routes/auth.ts
import { supabaseAdmin } from "../lib/supabaseService";

export async function handleLogin(req: Request, res: Response) {
  try {
    const { email, password } = req.body;
    
    // Use Supabase Auth for authentication
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
      });
    }
    
    // Create session token
    const sessionToken = data.session?.access_token;
    
    // Set secure HTTP-only cookie
    res.cookie("auth_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    return res.json({
      success: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        role: data.user?.user_metadata?.role || "admin",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
}
