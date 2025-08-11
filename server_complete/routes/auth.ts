import { Router } from "express";
import { AuthService } from "../services/AuthService";

const router = Router();

// POST /auth/register - Register a new user
router.post("/register", async (req, res) => {
  try {
    const profile = await AuthService.register(req.body);
    res.status(201).json({ success: true, user: profile });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /auth/login - Login and return session tokens
router.post("/login", async (req, res) => {
  try {
    const session = await AuthService.login(req.body);
    res.json({ success: true, data: session });
  } catch (error: any) {
    res.status(401).json({ success: false, error: error.message });
  }
});

// POST /auth/refresh - Refresh an access token
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: "refreshToken is required" });
    }
    const session = await AuthService.refreshToken(refreshToken);
    res.json({ success: true, data: session });
  } catch (error: any) {
    res.status(401).json({ success: false, error: error.message });
  }
});

// POST /auth/logout - Log out by revoking refresh token
router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: "refreshToken is required" });
    }
    const result = await AuthService.logout(refreshToken);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /auth/2fa/verify - Verify two‑factor authentication code
router.post("/2fa/verify", async (req, res) => {
  try {
    const { loginToken, code } = req.body;
    if (!loginToken || !code) {
      return res.status(400).json({ success: false, error: "loginToken and code are required" });
    }
    const result = await AuthService.verify2FACode(loginToken, code);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;