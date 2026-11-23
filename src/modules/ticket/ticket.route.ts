import { Router } from "express";
import { TicketController } from "./ticket.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { requireNumericParam } from "../../middlewares/security.middleware.js";

const router = Router();

// Buyer only - e-ticket milik sendiri dari order PAID
router.use(authenticate, authorize("buyer"));
router.get("/", TicketController.getMine);
router.get("/:ticketId", requireNumericParam("ticketId"), TicketController.getMineById);

export default router;
