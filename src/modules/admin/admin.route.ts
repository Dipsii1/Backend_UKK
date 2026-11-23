import { Router } from "express";
import { AdminController } from "./admin.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/error.middleware.js";
import { requireNumericId } from "../../middlewares/security.middleware.js";
import { organizerStatusSchema, userStatusSchema } from "./admin.validation.js";

const router = Router();

// Admin only
router.use(authenticate, authorize("admin"));

// Event approval
router.put("/event/:id/approve", requireNumericId, AdminController.approveEvent);

// Account management
router.get("/users", AdminController.listUsers);
router.patch("/users/:id/status", requireNumericId, validate(userStatusSchema), AdminController.updateUserStatus);
router.get("/organizers", AdminController.listOrganizers);
router.patch("/organizers/:id/status", requireNumericId, validate(organizerStatusSchema), AdminController.updateOrganizerStatus);

// System monitoring
router.get("/dashboard", AdminController.getDashboard);
router.get("/transaction-logs", AdminController.listTransactionLogs);

export default router;
