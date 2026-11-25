import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { toNumber } from "../../utils/currency.js";
import { runSerializable } from "../cart/cart.repository.js";
import type { SeatMapInput, SeatMapViewport } from "./seat-map.types.js";

// Kursi beririsan dengan viewport bila x + width >= viewport.x; Prisma tidak bisa menjumlah kolom, jadi pakai margin.
const SEAT_CULL_MARGIN = 200;

export class SeatMapRepository {
  async expireStaleReservations() {
    return runSerializable(async (tx) => {
      const expired = await tx.seat_reservations.findMany({
        where: {
          expires_at: { lte: new Date() },
          order_id: null,
        },
        select: {
          seat_id: true,
          seat: { select: { seat_map_id: true } },
        },
      });
      if (!expired.length) return [];
      const seatIds = expired.map((item) => item.seat_id);
      await tx.seats.updateMany({
        where: {
          id: { in: seatIds },
          status: "held",
        },
        data: { status: "available" },
      });
      await tx.seat_reservations.deleteMany({
        where: { seat_id: { in: seatIds } },
      });
      return expired;
    });
  }

  async findOrganizerMap(eventId: bigint, userId: bigint) {
    return prisma.seat_maps.findFirst({
      where: {
        event_id: eventId,
        event: { organizer: { user_id: userId } },
      },
      include: {
        sections: {
          orderBy: { sort_order: "asc" },
        },
        shapes: { orderBy: { sort_order: "asc" } },
        event: { select: { ticketTypes: { select: { id: true, name: true, color: true } } } },
        seats: {
          orderBy: [{ y: "asc" }, { x: "asc" }],
        },
      },
    });
  }

  async findPublicMap(eventId: bigint, viewport: SeatMapViewport) {
    const seatWhere: Prisma.seatsWhereInput = {};
    if (viewport?.width !== undefined && viewport.height !== undefined) {
      // shortcut: batas kiri/atas memakai margin ukuran kursi maksimum yang wajar; kursi lebih besar dari margin bisa terpotong di tepi.
      seatWhere.AND = [
        { x: { gte: viewport.x! - SEAT_CULL_MARGIN, lte: viewport.x! + viewport.width } },
        { y: { gte: viewport.y! - SEAT_CULL_MARGIN, lte: viewport.y! + viewport.height } },
      ];
    }
    return prisma.seat_maps.findFirst({
      where: {
        event_id: eventId,
        event: {
          status: "published",
          is_published: true,
        },
      },
      select: {
        id: true,
        event_id: true,
        width: true,
        height: true,
        version: true,
        sections: {
          orderBy: { sort_order: "asc" },
        },
        shapes: { orderBy: { sort_order: "asc" } },
        event: { select: { ticketTypes: { select: { id: true, name: true, color: true } } } },
        seats: {
          where: seatWhere,
          orderBy: [{ y: "asc" }, { x: "asc" }],
          select: {
            id: true,
            public_id: true,
            section_id: true,
            ticket_type_id: true,
            label: true,
            row_label: true,
            seat_number: true,
            x: true,
            y: true,
            width: true,
            height: true,
            status: true,
          },
        },
      },
    });
  }

  async replace(eventId: bigint, userId: bigint, data: SeatMapInput) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const event = await tx.events.findFirst({
        where: {
          id: eventId,
          organizer: {
            user_id: userId,
            status: "verified",
          },
        },
        select: { status: true },
      });
      if (!event) return { reason: "not_found" as const };
      if (!["draft", "rejected"].includes(event.status)) return { reason: "locked" as const };
      const ticketTypeIds = [
        ...new Set(
          [...data.sections, ...data.seats]
            .map((item) => item.ticket_type_id)
            .filter((id): id is bigint => id !== undefined),
        ),
      ];
      if (ticketTypeIds.length) {
        const count = await tx.ticket_types.count({
          where: {
            id: { in: ticketTypeIds },
            event_id: eventId,
          },
        });
        if (count !== ticketTypeIds.length) return { reason: "ticket_mismatch" as const };
      }
      const map = await tx.seat_maps.upsert({
        where: { event_id: eventId },
        create: {
          event_id: eventId,
          width: data.width,
          height: data.height,
        },
        update: {
          width: data.width,
          height: data.height,
          version: { increment: 1 },
        },
      });
      const used = await tx.seat_reservations.count({
        where: {
          seat: { seat_map_id: map.id },
          order_id: { not: null },
        },
      });
      if (used) return { reason: "used" as const };
      await tx.seats.deleteMany({ where: { seat_map_id: map.id } });
      await tx.seat_sections.deleteMany({ where: { seat_map_id: map.id } });
      await tx.seat_map_shapes.deleteMany({ where: { seat_map_id: map.id } });
      await tx.seat_map_shapes.createMany({
        data: data.shapes.map((shape, index) => ({ ...shape, seat_map_id: map.id, sort_order: index })),
      });
      const sections = await Promise.all(
        data.sections.map((section) =>
          tx.seat_sections.create({
            data: {
              seat_map_id: map.id,
              label: section.label,
              ticket_type_id: section.ticket_type_id,
              x: section.x,
              y: section.y,
              width: section.width,
              height: section.height,
              sort_order: section.sort_order ?? 0,
            },
          }),
        ),
      );
      const sectionIds = new Map(sections.map((section) => [section.label, section.id]));
      await tx.seats.createMany({
        data: data.seats.map((seat) => ({
          seat_map_id: map.id,
          section_id: seat.section_label ? sectionIds.get(seat.section_label) : undefined,
          ticket_type_id: seat.ticket_type_id,
          label: seat.label,
          row_label: seat.row_label,
          seat_number: seat.seat_number,
          x: seat.x,
          y: seat.y,
          width: seat.width ?? 32,
          height: seat.height ?? 32,
          status: seat.status ?? "available",
        })),
      });
      return { reason: "ok" as const, map };
    });
  }

  async reserve(mapId: bigint, userId: bigint, seatIds: bigint[]) {
    return runSerializable(async (tx: Prisma.TransactionClient) => {
      const now = new Date();
      const expired = await tx.seat_reservations.findMany({
        where: {
          expires_at: { lte: now },
          order_id: null,
        },
        select: { seat_id: true },
      });
      if (expired.length) {
        const expiredSeatIds = expired.map((item) => item.seat_id);
        await tx.seats.updateMany({
          where: {
            id: { in: expiredSeatIds },
            status: "held",
          },
          data: { status: "available" },
        });
        await tx.seat_reservations.deleteMany({
          where: { seat_id: { in: expiredSeatIds } },
        });
      }
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "seats" WHERE "id" IN (${Prisma.join(seatIds)}) AND "seat_map_id" = ${mapId} FOR UPDATE`,
      );
      const seats = await tx.seats.findMany({
        where: {
          id: { in: seatIds },
          seat_map_id: mapId,
        },
        select: {
          id: true,
          status: true,
          ticket_type_id: true,
        },
      });
      if (seats.length !== seatIds.length) return { reason: "not_found" as const };
      if (seats.some((seat) => seat.status !== "available" || !seat.ticket_type_id)) return { reason: "unavailable" as const };
      const cart = await tx.carts.upsert({
        where: { user_id: userId },
        create: { user_id: userId },
        update: {},
      });
      const expiresAt = new Date(now.getTime() + 5 * 60_000);
      await tx.seat_reservations.createMany({
        data: seats.map((seat) => ({
          seat_id: seat.id,
          cart_id: cart.id,
          user_id: userId,
          expires_at: expiresAt,
        })),
      });
      await tx.seats.updateMany({
        where: { id: { in: seatIds } },
        data: { status: "held" },
      });
      const quantities = new Map<bigint, number>();
      for (const seat of seats) {
        const ticketTypeId = seat.ticket_type_id!;
        quantities.set(ticketTypeId, (quantities.get(ticketTypeId) ?? 0) + 1);
      }
      const ticketTypes = await tx.ticket_types.findMany({
        where: { id: { in: [...quantities.keys()] } },
        select: {
          id: true,
          price: true,
        },
      });
      for (const ticketType of ticketTypes) {
        const quantity = quantities.get(ticketType.id)!;
        const price = toNumber(ticketType.price);
        await tx.cart_items.upsert({
          where: {
            cart_id_ticket_type_id: {
              cart_id: cart.id,
              ticket_type_id: ticketType.id,
            },
          },
          create: {
            cart_id: cart.id,
            ticket_type_id: ticketType.id,
            quantity,
            unit_price: price,
            subtotal: price * quantity,
          },
          update: {
            quantity: { increment: quantity },
            subtotal: { increment: price * quantity },
          },
        });
        await tx.ticket_locks.upsert({
          where: {
            cart_id_ticket_type_id: {
              cart_id: cart.id,
              ticket_type_id: ticketType.id,
            },
          },
          create: {
            cart_id: cart.id,
            ticket_type_id: ticketType.id,
            quantity,
            expires_at: expiresAt,
          },
          update: {
            quantity: { increment: quantity },
            expires_at: expiresAt,
          },
        });
      }
      return { reason: "ok" as const, expiresAt, seats };
    });
  }
}
