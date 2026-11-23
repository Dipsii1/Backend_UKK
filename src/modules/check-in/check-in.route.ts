import { Router } from "express";
import { CheckInController } from "./check-in.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/error.middleware.js";
import { checkInSchema } from "./check-in.validation.js";

const router = Router();

// Organizer pemilik event atau admin - scan QR e-ticket
router.use(authenticate, authorize("organizer", "admin"));
router.post("/", validate(checkInSchema), CheckInController.checkIn);

export default router;
