import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/error.middleware.js";
import { rateLimit } from "../middlewares/security.middleware.js";
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
router.post("/register", rateLimit(15 * 60 * 1000, 10), validate(registerSchema), AuthController.register);
router.post("/login", rateLimit(15 * 60 * 1000, 10), validate(loginSchema), AuthController.login);
router.post("/refresh-token", rateLimit(15 * 60 * 1000, 30), validate(refreshSchema), AuthController.refreshToken);

// Password reset routes
router.post("/reset-password/request", rateLimit(15 * 60 * 1000, 5), validate(resetPasswordRequestSchema), AuthController.requestPasswordReset);
router.post("/reset-password/confirm", rateLimit(15 * 60 * 1000, 10), validate(resetPasswordSchema), AuthController.resetPassword);
router.get("/reset-password", AuthController.resetPasswordPage);

// Email verification routes
router.post("/verify-email/request", rateLimit(15 * 60 * 1000, 5), validate(verifyEmailRequestSchema), AuthController.requestEmailVerification);
router.post("/verify-email/confirm", rateLimit(15 * 60 * 1000, 10), validate(verifyEmailConfirmSchema), AuthController.confirmEmailVerification);
router.get("/verify-email", AuthController.verifyEmailPage);

// Protected routes
router.use(requireAuth);
router.get("/me", AuthController.profile);
router.post("/logout", AuthController.logout);

export default router;