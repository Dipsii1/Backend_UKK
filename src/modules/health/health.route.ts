import { Router } from "express";
import { HealthController } from "./health.controller.js";

const router = Router();

// Publik - GET /api/v1/health (untuk uptime monitor / load balancer)
router.get("/", HealthController.check);

export default router;
