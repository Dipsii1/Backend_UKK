import { Router } from "express";
import { EventController } from "../controllers/event.controller.js";

const router = Router();

router.get("/", EventController.getAll);
router.get("/:id", EventController.getById);

export default router;
