import { Router } from "express";
import { UserController } from "./user.controller.js";
import { authenticate, authorize, authorizeSelfOrRole } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/error.middleware.js";
import { requireNumericId } from "../../middlewares/security.middleware.js";
import { updateUserProfileSchema, updateUserSchema } from "./user.validation.js";

const router = Router();

// Admin only - GET /api/v1/users, DELETE /api/v1/users/:id (soft delete)
router.get("/", authenticate, authorize("admin"), UserController.getAll);
router.delete("/:id", requireNumericId, authenticate, authorize("admin"), UserController.delete);

// Owner or admin - GET/PUT /api/v1/users/:id, PATCH /api/v1/users/:id/profile
router.get("/:id", requireNumericId, authenticate, authorizeSelfOrRole("admin"), UserController.getById);
router.put("/:id", requireNumericId, authenticate, authorizeSelfOrRole("admin"), validate(updateUserSchema), UserController.update);
router.patch("/:id/profile", requireNumericId, authenticate, authorizeSelfOrRole("admin"), validate(updateUserProfileSchema), UserController.updateProfile);

export default router;
