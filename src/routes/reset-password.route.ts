import { Router } from "express";
import { PasswordResetController } from "../controllers/password-reset.controller.js";

const router = Router();

// Public endpoint for password reset page
router.get("/", PasswordResetController.resetPage);

export default router;