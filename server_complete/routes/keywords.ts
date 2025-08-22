import { Router } from "express";
import { KeywordService } from "../services/KeywordService";
import { SEOService } from "../services/SEOService";

const router = Router();

// GET /keywords?businessId=... - list all keywords for a business with pagination
router.get("/", async (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) {
      return res.status(400).json({ success: false, error: "businessId query parameter is required" });
    }

    const filters: any = {};
    if (req.query.page) filters.page = req.query.page;
    if (req.query.limit) filters.limit = req.query.limit;

    const { data, error, count } = await KeywordService.listKeywords(businessId, filters);
    if (error) throw error;

    const page = parseInt(filters.page || '1');
    const limit = parseInt(filters.limit || '20');

    res.json({
      success: true,
      data: data,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil((count || 0) / limit),
      }
    });
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
