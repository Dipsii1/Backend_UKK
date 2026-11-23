import { emitToAll } from "../../lib/socket.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../../utils/app-error.js";
import { SeatMapRepository } from "./seat-map.repository.js";
import type {
  SeatMapInput,
  SeatMapViewport,
  SeatReservationInput,
} from "./seat-map.types.js";

export class SeatMapService {
  constructor(private readonly seatMapRepo: SeatMapRepository = new SeatMapRepository()) {}

  async getOrganizerMap(userId: bigint, eventId: bigint) {
    const map = await this.seatMapRepo.findOrganizerMap(eventId, userId);
    if (!map) throw new NotFoundError("Denah atau festival tidak ditemukan");
    return map;
  }

  async getPublicMap(eventId: bigint, viewport: SeatMapViewport) {
    const map = await this.seatMapRepo.findPublicMap(eventId, viewport);
    if (!map) throw new NotFoundError("Denah event tidak ditemukan");
    return map;
  }

  async save(userId: bigint, eventId: bigint, data: SeatMapInput) {
    const result = await this.seatMapRepo.replace(eventId, userId, data);
    if (result.reason === "not_found") {
      throw new NotFoundError("Festival tidak ditemukan atau organizer belum terverifikasi");
    }
    if (result.reason === "locked") throw new ConflictError("Denah hanya dapat diubah saat event draft atau rejected");
    if (result.reason === "ticket_mismatch") {
      throw new ForbiddenError("Tipe tiket pada denah bukan milik event ini");
    }
    if (result.reason === "used") throw new ConflictError("Denah yang sudah masuk checkout tidak dapat diganti");
    return result.map;
  }

  async reserve(userId: bigint, mapId: bigint, data: SeatReservationInput) {
    const result = await this.seatMapRepo.reserve(mapId, userId, data.seat_ids);
    if (result.reason === "not_found") throw new NotFoundError("Kursi tidak ditemukan");
    if (result.reason === "unavailable") {
      throw new ConflictError("Satu atau lebih kursi sudah tidak tersedia");
    }
    // Emit only status deltas, never the full map or buyer identity.
    emitToAll("seat:status-changed", {
      seat_map_id: mapId,
      seats: result.seats.map((seat) => ({ id: seat.id, status: "held" })),
      expires_at: result.expiresAt,
    });
    return { seat_ids: result.seats.map((seat) => seat.id), expires_at: result.expiresAt };
  }

  async expireStaleReservations() {
    const expired = await this.seatMapRepo.expireStaleReservations();
    const byMap = new Map<bigint, bigint[]>();
    for (const item of expired) {
      byMap.set(item.seat.seat_map_id, [...(byMap.get(item.seat.seat_map_id) ?? []), item.seat_id]);
    }
    for (const [seatMapId, seatIds] of byMap) {
      emitToAll("seat:status-changed", {
        seat_map_id: seatMapId,
        seats: seatIds.map((id) => ({ id, status: "available" })),
      });
    }
  }
}
