import { Router } from "express";
import { NotificationController } from "./notification.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/error.middleware.js";
import { requireNumericId } from "../../middlewares/security.middleware.js";
import { broadcastSchema, pushTokenSchema } from "./notification.validation.js";

const router = Router();

// Semua user login - notifikasi & perangkat milik sendiri
router.use(authenticate);
router.get("/", NotificationController.getMine);
router.patch("/:id/read", requireNumericId, NotificationController.markRead);
router.post("/push-tokens", validate(pushTokenSchema), NotificationController.registerPushToken);
router.delete("/push-tokens", validate(pushTokenSchema), NotificationController.removePushToken);

// Admin only - broadcast per role
router.post("/broadcast", authorize("admin"), validate(broadcastSchema), NotificationController.broadcast);

export default router;
