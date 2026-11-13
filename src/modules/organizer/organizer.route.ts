import { Router } from "express";
import { OrganizerController } from "./organizer.controller.js";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { requireNumericId } from "../../middlewares/security.middleware.js";

const router = Router();

// Organizer only - festival management
router.get("/event", requireAuth, requireRole("organizer"), OrganizerController.listEvents);
router.post("/event", requireAuth, requireRole("organizer"), OrganizerController.createEvent);
router.get("/event/:id", requireNumericId, requireAuth, requireRole("organizer"), OrganizerController.getEvent);
router.patch("/event/:id", requireNumericId, requireAuth, requireRole("organizer"), OrganizerController.updateEvent);
router.delete("/event/:id", requireNumericId, requireAuth, requireRole("organizer"), OrganizerController.deleteEvent);

// Organizer only - tickets and sales monitoring
router.get("/event/:id/tickets", requireNumericId, requireAuth, requireRole("organizer"), OrganizerController.listTickets);
router.get("/event/:id/sales", requireNumericId, requireAuth, requireRole("organizer"), OrganizerController.getSales);
router.get("/tickets/:id", requireNumericId, requireAuth, requireRole("organizer"), OrganizerController.getTicket);
router.post("/tickets", requireAuth, requireRole("organizer"), OrganizerController.createTicket);
router.patch("/tickets/:id", requireNumericId, requireAuth, requireRole("organizer"), OrganizerController.updateTicket);
router.delete("/tickets/:id", requireNumericId, requireAuth, requireRole("organizer"), OrganizerController.deleteTicket);

export default router;
