import { Router } from "express";
import { ProjectService } from "../services/ProjectService";

const router = Router();

// GET /api/projects?businessId=... - list projects for a business
router.get("/", async (req, res) => {
  try {
    const businessId = req.query.businessId as string;
    if (!businessId) {
      return res.status(400).json({ success: false, error: "businessId query parameter is required" });
    }
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.assigned_to) filters.assigned_to = req.query.assigned_to;
    const { data, error } = await ProjectService.listProjects(businessId, filters);
    if (error) throw error;
    res.json({ success: true, projects: data });
  } catch (error: any) {
    console.error("Error fetching projects", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/projects/:id - get a single project
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await ProjectService.getProject(id);
    if (error) throw error;
    res.json({ success: true, project: data });
  } catch (error: any) {
    console.error("Error fetching project", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/projects - create a new project
router.post("/", async (req, res) => {
  try {
    const projectData = req.body;
    const { data, error } = await ProjectService.createProject(projectData);
    if (error) throw error;
    res.status(201).json({ success: true, project: data });
  } catch (error: any) {
    console.error("Error creating project", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/projects/:id - update a project
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const { data, error } = await ProjectService.updateProject(id, updates);
    if (error) throw error;
    res.json({ success: true, project: data });
  } catch (error: any) {
    console.error("Error updating project", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/projects/:id - delete a project
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await ProjectService.deleteProject(id);
    if (error) throw error;
    res.json({ success: true, project: data });
  } catch (error: any) {
    console.error("Error deleting project", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;