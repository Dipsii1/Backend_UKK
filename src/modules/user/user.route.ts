import { Router } from "express";
import { UserController } from "./user.controller.js";
import { requireAuth, requireRole, requireSelfOrRole } from "../../middlewares/auth.middleware.js";
import { requireNumericId } from "../../middlewares/security.middleware.js";

const router = Router();

// Admin only - GET /api/users, DELETE /api/users/:id
router.get("/", requireAuth, requireRole("admin"), UserController.getAll);
router.delete("/:id", requireNumericId, requireAuth, requireRole("admin"), UserController.delete);

// Owner or admin - GET /api/users/:id, PUT /api/users/:id
router.get("/:id", requireNumericId, requireAuth, requireSelfOrRole("admin"), UserController.getById);
router.put("/:id", requireNumericId, requireAuth, requireSelfOrRole("admin"), UserController.update);

// Owner only - PATCH /api/users/:id/profile
router.patch("/:id/profile", requireNumericId, requireAuth, requireSelfOrRole("admin"), UserController.updateProfile);

export default router;
