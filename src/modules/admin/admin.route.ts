import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { requireNumericId } from "../../middlewares/security.middleware.js";
import { AdminController } from "./admin.controller.js";

const router = Router();

// Admin only - approval, account management, and system monitoring
router.use(authenticate, authorize("admin"));
router.put("/event/:id/approve", requireNumericId, AdminController.approveEvent);
router.get("/users", AdminController.listUsers);
router.patch("/users/:id/status", requireNumericId, AdminController.updateUserStatus);
router.get("/organizers", AdminController.listOrganizers);
router.patch("/organizers/:id/status", requireNumericId, AdminController.updateOrganizerStatus);
router.get("/dashboard", AdminController.getDashboard);
router.get("/transaction-logs", AdminController.listTransactionLogs);
export default router;
