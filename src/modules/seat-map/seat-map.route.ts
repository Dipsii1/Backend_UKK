import { Router } from "express";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/error.middleware.js";
import { requireNumericId } from "../../middlewares/security.middleware.js";
import { SeatMapController } from "./seat-map.controller.js";
import { reserveSeatsSchema, seatMapSchema } from "./seat-map.validation.js";

const router = Router();
const organizerRouter = Router();
const buyerRouter = Router();

// Public SVG viewer
router.get("/events/:id/seat-map", requireNumericId, SeatMapController.getPublic);

// Organizer only - React-Konva editor
organizerRouter.use(authenticate, authorize("organizer"));
organizerRouter.get("/event/:id/seat-map", requireNumericId, SeatMapController.getOrganizer);
organizerRouter.put(
  "/event/:id/seat-map",
  requireNumericId,
  validate(seatMapSchema),
  SeatMapController.save,
);
router.use("/organizer", organizerRouter);

// Buyer only - temporary five-minute seat hold
buyerRouter.use(authenticate, authorize("buyer"));
buyerRouter.post(
  "/:id/reservations",
  requireNumericId,
  validate(reserveSeatsSchema),
  SeatMapController.reserve,
);
router.use("/seat-maps", buyerRouter);

export default router;
