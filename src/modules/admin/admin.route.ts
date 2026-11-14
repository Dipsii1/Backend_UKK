import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { requireNumericId } from "../../middlewares/security.middleware.js";
import { AdminController } from "./admin.controller.js";

const router = Router();

// Admin only - approval, account management, and system monitoring
router.use(requireAuth, requireRole("admin"));
router.put("/event/:id/approve", requireNumericId, AdminController.approveEvent);
router.get("/users", AdminController.listUsers);
router.patch("/users/:id/status", requireNumericId, AdminController.updateUserStatus);
router.get("/organizers", AdminController.listOrganizers);
router.patch("/organizers/:id/status", requireNumericId, AdminController.updateOrganizerStatus);
router.get("/dashboard", AdminController.getDashboard);
router.get("/transaction-logs", AdminController.listTransactionLogs);
export default router;
