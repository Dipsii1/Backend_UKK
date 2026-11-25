import { Router } from "express";
import { AdminController } from "./admin.controller.js";
import { AnalyticsController } from "../analytics/analytics.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/error.middleware.js";
import { requireNumericId } from "../../middlewares/security.middleware.js";
import { organizerStatusSchema, userStatusSchema } from "./admin.validation.js";

const router = Router();

// Admin only
router.use(authenticate, authorize("admin"));

// Event approval
router.get("/event/:id/documents", requireNumericId, AdminController.getEventDocuments);
router.put("/event/:id/approve", requireNumericId, AdminController.approveEvent);

// Account management
router.get("/users", AdminController.listUsers);
router.patch("/users/:id/status", requireNumericId, validate(userStatusSchema), AdminController.updateUserStatus);
router.get("/organizers", AdminController.listOrganizers);
router.get("/organizers/:id/documents", requireNumericId, AdminController.getOrganizerDocuments);
router.patch("/organizers/:id/status", requireNumericId, validate(organizerStatusSchema), AdminController.updateOrganizerStatus);

// System monitoring
router.get("/dashboard", AdminController.getDashboard);
router.get("/dashboard/charts", AnalyticsController.getAdminCharts);
router.get("/transaction-logs", AdminController.listTransactionLogs);

export default router;
