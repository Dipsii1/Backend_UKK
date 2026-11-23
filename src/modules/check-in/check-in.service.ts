import { CheckInRepository } from "./check-in.repository.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../utils/app-error.js";
import type { CheckInInput, CheckInRules } from "./check-in.types.js";

export const checkInRules: CheckInRules = {
  verify(ticket, eventId) {
    if (ticket.ticketType.event_id !== eventId) return "wrong_event";
    if (ticket.order.status !== "paid" || ticket.status === "cancelled" || ticket.status === "expired") return "invalid";
    if (ticket.status === "checked_in") return "duplicate";
    return "ok";
  },
};

export class CheckInService {
  constructor(private readonly checkInRepo: CheckInRepository = new CheckInRepository(checkInRules)) {}

  async checkIn(userId: bigint, role: string | undefined, input: CheckInInput) {
    const event = await this.checkInRepo.findEvent(input.event_id);
    if (!event) throw new NotFoundError("Event tidak ditemukan");
    if (role !== "admin" && (event.organizer.user_id !== userId || event.organizer.status !== "verified")) {
      throw new ForbiddenError("Anda tidak memiliki akses check-in untuk event ini");
    }

    const result = await this.checkInRepo.checkIn(input.event_id, input.qr_token, userId);
    if (result.reason === "not_found") throw new NotFoundError("Tiket tidak ditemukan");
    if (result.reason === "wrong_event") throw new ConflictError("Tiket bukan untuk event ini");
    if (result.reason === "invalid") throw new ConflictError("Tiket tidak valid atau order belum dibayar");
    if (result.reason === "duplicate") throw new ConflictError("Tiket sudah digunakan");

    return {
      ticket_code: result.ticket.ticket_code,
      ticket_type: result.ticket.ticketType.name,
      status: "USED" as const,
      checked_in_at: result.ticket.checked_in_at,
    };
  }
}
