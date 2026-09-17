import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/error.middleware.js";
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordRequestSchema,
  resetPasswordSchema,
  verifyEmailRequestSchema,
  verifyEmailConfirmSchema,
} from "../validations/auth.validation.js";

const router = Router();

// Public auth routes
router.post("/register", validate(registerSchema), AuthController.register);
router.post("/login", validate(loginSchema), AuthController.login);
router.post("/refresh-token", validate(refreshSchema), AuthController.refreshToken);

// Password reset routes
router.post("/reset-password/request", validate(resetPasswordRequestSchema), AuthController.requestPasswordReset);
router.post("/reset-password/confirm", validate(resetPasswordSchema), AuthController.resetPassword);

// Email verification routes
router.post("/verify-email/request", validate(verifyEmailRequestSchema), AuthController.requestEmailVerification);
router.post("/verify-email/confirm", validate(verifyEmailConfirmSchema), AuthController.confirmEmailVerification);

// Protected routes
router.use(requireAuth);
router.get("/me", AuthController.profile);
router.post("/logout", AuthController.logout);

export default router;