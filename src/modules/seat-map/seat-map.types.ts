import type { z } from "zod";
import type { reserveSeatsSchema, seatMapSchema, viewportSchema } from "./seat-map.validation.js";

export type SeatMapInput = z.output<typeof seatMapSchema>;
export type SeatReservationInput = z.output<typeof reserveSeatsSchema>;
export type SeatMapViewport = z.output<typeof viewportSchema>;
export type SeatStatusDelta = {
  id: bigint;
  status: "available" | "held" | "sold" | "blocked";
};
