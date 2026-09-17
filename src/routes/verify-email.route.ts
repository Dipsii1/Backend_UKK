import { Router } from "express";
import { EmailVerificationController } from "../controllers/email-verification.controller.js";

const router = Router();

// Public endpoint for email verification via link
router.get("/", EmailVerificationController.verify);

export default router;