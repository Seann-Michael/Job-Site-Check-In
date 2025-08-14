import { Router } from "express";
import { SEOService } from "../services/SEOService";

const router = Router();

// POST /seo/audit - perform a basic SEO audit
router.post("/audit", async (req, res) => {
  try {
    const result = await SEOService.performAudit(req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /seo/track - track keyword rankings
router.post("/track", async (req, res) => {
  try {
    const result = await SEOService.trackKeywords(req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;