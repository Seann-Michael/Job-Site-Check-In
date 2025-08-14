import { Router } from "express";
import { WebhookService } from "../services/WebhookService";

const router = Router();

// POST /webhooks/register - register a new webhook endpoint
router.post("/register", async (req, res) => {
  try {
    const webhook = await WebhookService.register(req.body);
    res.status(201).json({ success: true, webhook });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;