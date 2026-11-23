import { Router } from "express";
import { OrganizerController } from "./organizer.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/error.middleware.js";
import { requireNumericId } from "../../middlewares/security.middleware.js";
import {
  eventCreateSchema,
  eventUpdateSchema,
  ticketCreateSchema,
  ticketUpdateSchema,
} from "./organizer.validation.js";

const router = Router();

// Organizer only
router.use(authenticate, authorize("organizer"));

// Festival management
router.get("/event", OrganizerController.listEvents);
router.post("/event", validate(eventCreateSchema), OrganizerController.createEvent);
router.get("/event/:id", requireNumericId, OrganizerController.getEvent);
router.patch("/event/:id", requireNumericId, validate(eventUpdateSchema), OrganizerController.updateEvent);
router.delete("/event/:id", requireNumericId, OrganizerController.deleteEvent);
router.post("/event/:id/submit", requireNumericId, OrganizerController.submitEvent);

// Tickets and sales monitoring
router.get("/event/:id/tickets", requireNumericId, OrganizerController.listTickets);
router.get("/event/:id/sales", requireNumericId, OrganizerController.getSales);
router.get("/tickets/:id", requireNumericId, OrganizerController.getTicket);
router.post("/tickets", validate(ticketCreateSchema), OrganizerController.createTicket);
router.patch("/tickets/:id", requireNumericId, validate(ticketUpdateSchema), OrganizerController.updateTicket);
router.delete("/tickets/:id", requireNumericId, OrganizerController.deleteTicket);

export default router;
