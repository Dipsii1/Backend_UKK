import { Router } from "express";
import { UserController } from "./user.controller.js";
import { authenticate, authorize, authorizeSelfOrRole } from "../../middlewares/auth.middleware.js";
import { requireNumericId } from "../../middlewares/security.middleware.js";

const router = Router();

// Admin only - GET /api/users, DELETE /api/users/:id
router.get("/", authenticate, authorize("admin"), UserController.getAll);
router.delete("/:id", requireNumericId, authenticate, authorize("admin"), UserController.delete);

// Owner or admin - GET /api/users/:id, PUT /api/users/:id
router.get("/:id", requireNumericId, authenticate, authorizeSelfOrRole("admin"), UserController.getById);
router.put("/:id", requireNumericId, authenticate, authorizeSelfOrRole("admin"), UserController.update);

// Owner only - PATCH /api/users/:id/profile
router.patch("/:id/profile", requireNumericId, authenticate, authorizeSelfOrRole("admin"), UserController.updateProfile);

export default router;
