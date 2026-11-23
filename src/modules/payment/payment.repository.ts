import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import { lockTicketType, releasePendingOrder, runSerializable } from "../cart/cart.repository.js";
import type { SnapTransaction } from "../../utils/midtrans.js";
import type { MidtransNotification, NotificationResult, PaymentRules, PaymentTarget } from "./payment.types.js";

const lockOrder = (tx: Prisma.TransactionClient, orderId: bigint) =>
  tx.$queryRaw(Prisma.sql`SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE`);

const asJson = (value: unknown) => value as Prisma.InputJsonValue;

export class PaymentRepository {
  constructor(private readonly rules: PaymentRules) {}

  // Lock baris order agar request paralel untuk order yang sama tidak membuat dua transaksi.
  async reserve(orderId: bigint, userId: bigint) {
    return runSerializable(async (tx) => {
      const now = new Date();
      await lockOrder(tx, orderId);
      const order = await tx.orders.findUnique({ where: { id: orderId } });
      if (!order || order.user_id !== userId) return { reason: "not_found" as const };
      if (!this.rules.isPayable(order, now)) return { reason: "not_payable" as const };

      const existing = await tx.payments.findFirst({ where: { order_id: orderId, status: "pending" } });
      if (existing) return { reason: "exists" as const, order, payment: existing, now };

      const payment = await tx.payments.create({
        data: { order_id: orderId, provider: "midtrans", gross_amount: this.rules.grossAmount(order), status: "pending" },
      });
      return { reason: "created" as const, order, payment, now };
    });
  }

  async saveSnap(paymentId: bigint, snap: SnapTransaction) {
    return prisma.payments.update({
      where: { id: paymentId },
      data: { snap_token: snap.token, redirect_url: snap.redirect_url },
    });
  }

  async deletePayment(paymentId: bigint) {
    await prisma.payments.delete({ where: { id: paymentId } });
  }

  async findByOrderNumber(orderNumber: string) {
    return prisma.payments.findFirst({
      where: { provider: "midtrans", order: { order_number: orderNumber } },
      orderBy: { created_at: "desc" },
      include: { order: { select: { user_id: true } } },
    });
  }

  async logNotification(paymentId: bigint, payload: MidtransNotification) {
    await prisma.payment_logs.create({ data: { payment_id: paymentId, payload: asJson(payload) } });
  }

  async findSeatIdsByOrder(orderId: bigint) {
    return prisma.seat_reservations.findMany({ where: { order_id: orderId }, select: { seat_id: true, seat: { select: { seat_map_id: true, status: true } } } });
  }

  async applyNotification(
    payment: { id: bigint; order_id: bigint },
    payload: MidtransNotification,
    target: PaymentTarget | null,
  ): Promise<NotificationResult> {
    return runSerializable(async (tx) => {
      const now = new Date();
      const items = await tx.order_items.findMany({
        where: { order_id: payment.order_id },
        select: { id: true, ticket_type_id: true, quantity: true },
      });
      const reservedSeats = (await tx.seat_reservations.findMany({ where: { order_id: payment.order_id }, select: { seat_id: true, seat: { select: { ticket_type_id: true } } }, orderBy: { seat_id: "asc" } })) ?? [];
      // Urutan lock sama dengan cart (ticket_types lalu orders) agar tidak deadlock.
      const ticketTypeIds = [...new Set(items.map((item) => item.ticket_type_id))].sort((a, b) => Number(a - b));
      for (const ticketTypeId of ticketTypeIds) await lockTicketType(tx, ticketTypeId);
      await lockOrder(tx, payment.order_id);

      await tx.payment_logs.create({ data: { payment_id: payment.id, payload: asJson(payload) } });
      if (!target) return "ignored";

      const current = await tx.payments.findUniqueOrThrow({ where: { id: payment.id } });
      const order = await tx.orders.findUniqueOrThrow({ where: { id: payment.order_id } });
      const providerData = {
        provider_transaction_id: payload.transaction_id ?? current.provider_transaction_id,
        payment_method: payload.payment_type ?? current.payment_method,
      };

      if (current.status === "pending" && target.payment === "pending") {
        await tx.payments.update({ where: { id: current.id }, data: providerData });
        return "applied";
      }
      if (!this.rules.canTransition(current.status, target.payment)) return "unchanged";

      await tx.payments.update({
        where: { id: current.id },
        data: { ...providerData, status: target.payment, ...(target.payment === "settlement" && { paid_at: now }) },
      });
      await tx.audit_logs.create({
        data: {
          user_id: order.user_id,
          action: "update",
          table_name: "payments",
          record_id: current.id,
          old_data: { status: current.status },
          new_data: { status: target.payment, provider_transaction_id: providerData.provider_transaction_id },
        },
      });

      if (target.order === "paid") {
        // Stok order ini sudah dilepas (expired/cancelled): jangan terbitkan tiket, tandai untuk refund manual.
        if (order.status !== "pending") {
          await tx.audit_logs.create({
            data: {
              user_id: order.user_id,
              action: "update",
              table_name: "orders",
              record_id: order.id,
              old_data: { status: order.status },
              new_data: { status: order.status, late_settlement: true, needs_refund: true },
            },
          });
          return "late_settlement";
        }

        await tx.orders.update({ where: { id: order.id }, data: { status: "paid" } });
        // Satu tiket per unit; (order_item_id, sequence) unik sehingga penerbitan ulang tidak menambah record.
        const seatsByTicketType = new Map<bigint, bigint[]>();
        for (const reservation of reservedSeats) {
          if (reservation.seat.ticket_type_id) {
            const bucket = seatsByTicketType.get(reservation.seat.ticket_type_id) ?? [];
            bucket.push(reservation.seat_id);
            seatsByTicketType.set(reservation.seat.ticket_type_id, bucket);
          }
        }
        const tickets = items.flatMap((item) =>
          Array.from({ length: item.quantity }, (_, index) => ({
            order_id: order.id,
            order_item_id: item.id,
            ticket_type_id: item.ticket_type_id,
            owner_id: order.user_id,
            sequence: index + 1,
            ticket_code: `TCK-${randomUUID()}`,
            qr_token: randomBytes(32).toString("base64url"),
            seat_id: seatsByTicketType.get(item.ticket_type_id)?.shift(),
          })),
        );
        await tx.tickets.createMany({ data: tickets, skipDuplicates: true });
        if (reservedSeats.length) await tx.seats.updateMany({ where: { id: { in: reservedSeats.map((seat) => seat.seat_id) } }, data: { status: "sold" } });
        await tx.audit_logs.create({
          data: {
            user_id: order.user_id,
            action: "update",
            table_name: "orders",
            record_id: order.id,
            old_data: { status: "pending" },
            new_data: { status: "paid", tickets_issued: tickets.length },
          },
        });
      } else if (target.order === "expired" || target.order === "cancelled") {
        await releasePendingOrder(tx, { id: order.id, user_id: order.user_id, orderItems: items }, target.order);
      } else if (target.order === "refunded" && order.status === "paid") {
        await tx.orders.update({ where: { id: order.id }, data: { status: "refunded" } });
        await tx.tickets.updateMany({
          where: { orderItem: { order_id: order.id }, status: "issued" },
          data: { status: "cancelled" },
        });
        await tx.audit_logs.create({
          data: {
            user_id: order.user_id,
            action: "update",
            table_name: "orders",
            record_id: order.id,
            old_data: { status: "paid" },
            new_data: { status: "refunded" },
          },
        });
      }
      return "applied";
    });
  }
}
