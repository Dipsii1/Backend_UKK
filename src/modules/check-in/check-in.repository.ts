import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { CheckInRules } from "./check-in.types.js";

export class CheckInRepository {
  constructor(private readonly rules: CheckInRules) {}

  async findEvent(eventId: bigint) {
    return prisma.events.findUnique({
      where: { id: eventId },
      select: { id: true, organizer: { select: { user_id: true, status: true } } },
    });
  }

  async checkIn(eventId: bigint, qrToken: string, scannerId: bigint) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Lock baris tiket agar dua scan bersamaan tidak sama-sama lolos.
      const [locked] = await tx.$queryRaw<{ id: bigint }[]>(
        Prisma.sql`SELECT "id" FROM "tickets" WHERE "qr_token" = ${qrToken} FOR UPDATE`,
      );
      if (!locked) return { reason: "not_found" as const };

      const ticket = await tx.tickets.findUniqueOrThrow({
        where: { id: locked.id },
        include: {
          order: { select: { status: true } },
          ticketType: { select: { event_id: true, name: true } },
        },
      });

      const reason = this.rules.verify(ticket, eventId);
      const checkedIn =
        reason === "ok"
          ? await tx.tickets.update({
              where: { id: ticket.id },
              data: { status: "checked_in", checked_in_at: new Date() },
            })
          : null;

      await tx.ticket_scans.create({
        data: {
          ticket_id: ticket.id,
          scanned_by: scannerId,
          scan_result: reason === "ok" ? "success" : reason === "duplicate" ? "duplicate" : "invalid",
        },
      });

      if (checkedIn) {
        await tx.audit_logs.create({
          data: {
            user_id: scannerId,
            action: "update",
            table_name: "tickets",
            record_id: ticket.id,
            old_data: { status: ticket.status },
            new_data: { status: checkedIn.status, checked_in_at: checkedIn.checked_in_at },
          },
        });
      }

      return { reason, ticket: { ...ticket, ...checkedIn } };
    });
  }
}
