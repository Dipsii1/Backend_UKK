import { Router } from "express";
import { EventController } from "../controllers/event.controller.js";
import { requireNumericId } from "../middlewares/security.middleware.js";

const router = Router();

router.get("/", EventController.getAll);
router.get("/:id", requireNumericId, EventController.getById);

export default router;
