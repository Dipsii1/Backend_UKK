import { Router } from "express";
import { OrganizerController } from "./organizer.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { requireNumericId } from "../../middlewares/security.middleware.js";

const router = Router();

// Organizer only - festival management
router.get("/event", authenticate, authorize("organizer"), OrganizerController.listEvents);
router.post("/event", authenticate, authorize("organizer"), OrganizerController.createEvent);
router.get("/event/:id", requireNumericId, authenticate, authorize("organizer"), OrganizerController.getEvent);
router.patch("/event/:id", requireNumericId, authenticate, authorize("organizer"), OrganizerController.updateEvent);
router.delete("/event/:id", requireNumericId, authenticate, authorize("organizer"), OrganizerController.deleteEvent);

// Organizer only - tickets and sales monitoring
router.get("/event/:id/tickets", requireNumericId, authenticate, authorize("organizer"), OrganizerController.listTickets);
router.get("/event/:id/sales", requireNumericId, authenticate, authorize("organizer"), OrganizerController.getSales);
router.get("/tickets/:id", requireNumericId, authenticate, authorize("organizer"), OrganizerController.getTicket);
router.post("/tickets", authenticate, authorize("organizer"), OrganizerController.createTicket);
router.patch("/tickets/:id", requireNumericId, authenticate, authorize("organizer"), OrganizerController.updateTicket);
router.delete("/tickets/:id", requireNumericId, authenticate, authorize("organizer"), OrganizerController.deleteTicket);

export default router;
