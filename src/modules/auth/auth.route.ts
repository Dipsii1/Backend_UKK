import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/error.middleware.js";
import { rateLimit } from "../../middlewares/security.middleware.js";
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  registerOrganizerSchema,
  resetPasswordRequestSchema,
  resetPasswordSchema,
  verifyEmailRequestSchema,
  verifyEmailConfirmSchema,
  updateProfileSchema,
} from "./auth.validation.js";

const router = Router();

// Public auth routes
router.post("/register", rateLimit(15 * 60 * 1000, 10), validate(registerSchema), AuthController.register);
router.post("/register-organizer", rateLimit(15 * 60 * 1000, 5), validate(registerOrganizerSchema), AuthController.registerOrganizer);
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
router.use(authenticate);
router.get("/me", AuthController.profile);
router.patch("/me", validate(updateProfileSchema), AuthController.updateProfile);
router.post("/logout", AuthController.logout);

export default router;
