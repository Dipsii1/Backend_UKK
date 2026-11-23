import { CheckInRepository } from "./check-in.repository.js";
import { AppError } from "../../utils/app-error.js";
import type { CheckInInput, CheckInReason, CheckInRules } from "./check-in.types.js";

// Setiap penolakan punya HTTP status dan error code sendiri agar klien scanner bisa membedakannya.
const REJECTIONS: Record<Exclude<CheckInReason, "ok"> | "not_found", [number, string, string]> = {
  not_found: [404, "TICKET_NOT_FOUND", "Tiket tidak ditemukan"],
  wrong_event: [409, "WRONG_EVENT", "Tiket bukan untuk event ini"],
  not_open: [409, "CHECKIN_NOT_OPEN", "Check-in event belum dibuka"],
  closed: [409, "CHECKIN_CLOSED", "Check-in event sudah ditutup"],
  unpaid: [409, "TICKET_UNPAID", "Order tiket belum dibayar"],
  cancelled: [409, "TICKET_CANCELLED", "Tiket sudah dibatalkan"],
  expired: [409, "TICKET_EXPIRED", "Tiket sudah kadaluarsa"],
  duplicate: [409, "TICKET_USED", "Tiket sudah digunakan"],
};

export const checkInRules: CheckInRules = {
  verify(ticket, window, now) {
    if (ticket.ticketType.event_id !== window.eventId) return "wrong_event";
    if (now < window.opensAt) return "not_open";
    if (now > window.closesAt) return "closed";
    if (ticket.order.status !== "paid") return "unpaid";
    if (ticket.status === "cancelled") return "cancelled";
    if (ticket.status === "expired") return "expired";
    if (ticket.status === "checked_in") return "duplicate";
    return "ok";
  },
};

export class CheckInService {
  constructor(private readonly checkInRepo: CheckInRepository = new CheckInRepository(checkInRules)) {}

  async checkIn(userId: bigint, role: string | undefined, input: CheckInInput) {
    const event = await this.checkInRepo.findEvent(input.event_id);
    if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "Event tidak ditemukan");
    if (role !== "admin" && (event.organizer.user_id !== userId || event.organizer.status !== "verified")) {
      throw new AppError(403, "CHECKIN_FORBIDDEN", "Anda tidak memiliki akses check-in untuk event ini");
    }

    // Jendela check-in: dari gerbang dibuka (atau mulai event) sampai event berakhir.
    const window = { eventId: event.id, opensAt: event.gate_open_at ?? event.start_at, closesAt: event.end_at };
    const result = await this.checkInRepo.checkIn(window, input.qr_token, userId);
    if (result.reason !== "ok") {
      const [status, code, message] = REJECTIONS[result.reason];
      throw new AppError(status, code, message);
    }

    return {
      ticket_code: result.ticket.ticket_code,
      ticket_type: result.ticket.ticketType.name,
      status: "USED" as const,
      checked_in_at: result.ticket.checked_in_at,
      checked_in_by: result.ticket.checked_in_by,
    };
  }
}
