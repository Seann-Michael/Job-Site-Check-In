import { Router } from "express";
import { BusinessService } from "../services/BusinessService";

const router = Router();

// GET /api/businesses?ownerId=... - list businesses for a given owner with pagination
router.get("/", async (req, res) => {
  try {
    const ownerId = req.query.ownerId as string;
    if (!ownerId) {
      return res.status(400).json({ success: false, error: "ownerId query parameter is required" });
    }

    const filters: any = {};
    if (req.query.page) filters.page = req.query.page;
    if (req.query.limit) filters.limit = req.query.limit;

    const { data, error, count } = await BusinessService.listBusinesses(ownerId, filters);
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
    console.error("Error fetching businesses", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/businesses/:id - get a single business by id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await BusinessService.getBusiness(id);
    if (error) throw error;
    res.json({ success: true, business: data });
  } catch (error: any) {
    console.error("Error fetching business", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/businesses - create a new business
router.post("/", async (req, res) => {
  try {
    const businessData = req.body;
    const { data, error } = await BusinessService.createBusiness(businessData);
    if (error) throw error;
    res.status(201).json({ success: true, business: data });
  } catch (error: any) {
    console.error("Error creating business", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/businesses/:id - update a business
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const { data, error } = await BusinessService.updateBusiness(id, updates);
    if (error) throw error;
    res.json({ success: true, business: data });
  } catch (error: any) {
    console.error("Error updating business", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/businesses/:id - delete a business
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await BusinessService.deleteBusiness(id);
    if (error) throw error;
    res.json({ success: true, business: data });
  } catch (error: any) {
    console.error("Error deleting business", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
