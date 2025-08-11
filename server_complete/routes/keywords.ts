import { Router } from "express";
import { KeywordService } from "../services/KeywordService";
import { SEOService } from "../services/SEOService";

const router = Router();

// GET /keywords?businessId=... - list all keywords for a business
router.get("/", async (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) {
      return res.status(400).json({ success: false, error: "businessId query parameter is required" });
    }
    const { data, error } = await KeywordService.listKeywords(businessId);
    if (error) throw error;
    res.json({ success: true, keywords: data });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /keywords - create a new keyword
router.post("/", async (req, res) => {
  try {
    const { data, error } = await KeywordService.createKeyword(req.body);
    if (error) throw error;
    res.status(201).json({ success: true, keyword: data });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// PUT /keywords/:id - update a keyword
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await KeywordService.updateKeyword(id, req.body);
    if (error) throw error;
    res.json({ success: true, keyword: data });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /keywords/:id - delete a keyword
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await KeywordService.deleteKeyword(id);
    if (error) throw error;
    res.json({ success: true, keyword: data });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /keywords/track - track rankings for a list of keywords
router.post("/track", async (req, res) => {
  try {
    const result = await SEOService.trackKeywords(req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;