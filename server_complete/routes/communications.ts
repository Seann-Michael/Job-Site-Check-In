import { Router } from "express";
import { CommunicationService } from "../services/CommunicationService";

const router = Router();

// POST /communications/sms - send an SMS message
router.post("/sms", async (req, res) => {
  try {
    const result = await CommunicationService.sendSMS(req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /communications/email - send an email message
router.post("/email", async (req, res) => {
  try {
    const result = await CommunicationService.sendEmail(req.body);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;