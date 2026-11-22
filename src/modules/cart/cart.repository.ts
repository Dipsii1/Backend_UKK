import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";

const CART_LOCK_MINUTES = 15;
const TAX_RATE = 0.11;
const SERVICE_FEE = 5000;

const toNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in value) return (value as { toNumber: () => number }).toNumber();
  return 0;
};

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export class CartRepository {
  private async lockTicketType(tx: Prisma.TransactionClient, ticketTypeId: bigint): Promise<void> {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "ticket_types" WHERE "id" = ${ticketTypeId} FOR UPDATE`,
    );
  }

  private async getOrCreateCart(tx: Prisma.TransactionClient, userId: bigint) {
    return tx.carts.upsert({
      where: { user_id: userId },
      create: { user_id: userId },
      update: {},
    });
  }

  private async expirePendingOrders(tx: Prisma.TransactionClient, now: Date): Promise<void> {
    const expiredOrders = await tx.orders.findMany({
      where: { status: "pending", expired_at: { lte: now } },
      include: { orderItems: { select: { ticket_type_id: true, quantity: true } } },
    });
    const ticketTypeIds = [
      ...new Set(expiredOrders.flatMap((order) => order.orderItems.map((item) => item.ticket_type_id))),
    ].sort((a, b) => Number(a - b));

    for (const ticketTypeId of ticketTypeIds) {
      await this.lockTicketType(tx, ticketTypeId);
    }

    for (const order of expiredOrders) {
      const updated = await tx.orders.updateMany({
        where: { id: order.id, status: "pending", expired_at: { lte: now } },
        data: { status: "expired" },
      });

      if (updated.count === 0) continue;

      for (const item of order.orderItems) {
        await tx.ticket_types.update({
          where: { id: item.ticket_type_id },
          data: { sold: { decrement: item.quantity } },
        });
      }

      await tx.audit_logs.create({
        data: {
          user_id: order.user_id,
          action: "update",
          table_name: "orders",
          record_id: order.id,
          old_data: { status: "pending" },
          new_data: { status: "expired" },
        },
      });
    }
  }

  async getCart(userId: bigint) {
    const now = new Date();

    await prisma.ticket_locks.deleteMany({
      where: { expires_at: { lte: now } },
    });

    return prisma.carts.findUnique({
      where: { user_id: userId },
      include: {
        items: {
          include: {
            ticketType: {
              include: {
                event: {
                  select: {
                    id: true,
                    title: true,
                    status: true,
                    is_published: true,
                  },
                },
              },
            },
          },
          orderBy: { created_at: "asc" },
        },
        locks: {
          where: { expires_at: { gt: now } },
          select: { ticket_type_id: true, expires_at: true },
        },
      },
    });
  }

  async upsertItem(userId: bigint, ticketTypeId: bigint, quantity: number) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const now = new Date();
      await this.expirePendingOrders(tx, now);
      await tx.ticket_locks.deleteMany({ where: { expires_at: { lte: now } } });
      await this.lockTicketType(tx, ticketTypeId);

      const ticket = await tx.ticket_types.findUnique({
        where: { id: ticketTypeId },
        include: { event: true },
      });

      if (!ticket) return { reason: "not_found" as const };

      const isUnavailable =
        ticket.status !== "active" ||
        ticket.event.status !== "published" ||
        !ticket.event.is_published ||
        (ticket.sale_start_at !== null && ticket.sale_start_at > now) ||
        (ticket.sale_end_at !== null && ticket.sale_end_at < now);

      if (isUnavailable) return { reason: "unavailable" as const };
      if (quantity > ticket.max_purchase) {
        return { reason: "max_purchase" as const, maxPurchase: ticket.max_purchase };
      }

      const cart = await this.getOrCreateCart(tx, userId);
      const reserved = await tx.ticket_locks.aggregate({
        where: {
          ticket_type_id: ticketTypeId,
          expires_at: { gt: now },
          NOT: { cart_id: cart.id },
        },
        _sum: { quantity: true },
      });

      if (ticket.sold + (reserved._sum.quantity ?? 0) + quantity > ticket.quota) {
        return { reason: "sold_out" as const };
      }

      const unitPrice = toNumber(ticket.price);
      const subtotal = money(unitPrice * quantity);
      await tx.cart_items.upsert({
        where: {
          cart_id_ticket_type_id: {
            cart_id: cart.id,
            ticket_type_id: ticketTypeId,
          },
        },
        create: {
          cart_id: cart.id,
          ticket_type_id: ticketTypeId,
          quantity,
          unit_price: unitPrice,
          subtotal,
        },
        update: { quantity, unit_price: unitPrice, subtotal },
      });

      const expiresAt = new Date(now.getTime() + CART_LOCK_MINUTES * 60_000);
      await tx.ticket_locks.upsert({
        where: {
          cart_id_ticket_type_id: {
            cart_id: cart.id,
            ticket_type_id: ticketTypeId,
          },
        },
        create: {
          cart_id: cart.id,
          ticket_type_id: ticketTypeId,
          quantity,
          expires_at: expiresAt,
        },
        update: { quantity, expires_at: expiresAt },
      });
      return { reason: "ok" as const, expiresAt };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async removeItem(userId: bigint, ticketTypeId: bigint) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const cart = await tx.carts.findUnique({ where: { user_id: userId } });
      if (!cart) return false;
      const deleted = await tx.cart_items.deleteMany({ where: { cart_id: cart.id, ticket_type_id: ticketTypeId } });
      await tx.ticket_locks.deleteMany({ where: { cart_id: cart.id, ticket_type_id: ticketTypeId } });
      return deleted.count > 0;
    });
  }

  async checkout(userId: bigint, voucherCode?: string) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const now = new Date();
      await this.expirePendingOrders(tx, now);
      await tx.ticket_locks.deleteMany({ where: { expires_at: { lte: now } } });
      const cart = await tx.carts.findUnique({
        where: { user_id: userId },
        include: {
          items: {
            include: {
              ticketType: { include: { event: true } },
            },
          },
          locks: true,
        },
      });

      if (!cart || cart.items.length === 0) return { reason: "empty" as const };

      const activeLocks = new Map(
        cart.locks
          .filter((lock) => lock.expires_at > now)
          .map((lock) => [lock.ticket_type_id.toString(), lock]),
      );
      const items = [...cart.items].sort((a, b) => Number(a.ticket_type_id - b.ticket_type_id));

      for (const item of items) {
        await this.lockTicketType(tx, item.ticket_type_id);

        const lock = activeLocks.get(item.ticket_type_id.toString());
        if (!lock || lock.quantity !== item.quantity) {
          return { reason: "lock_expired" as const };
        }

        const ticket = await tx.ticket_types.findUnique({
          where: { id: item.ticket_type_id },
          include: { event: true },
        });
        const isUnavailable =
          !ticket ||
          ticket.status !== "active" ||
          ticket.event.status !== "published" ||
          !ticket.event.is_published ||
          (ticket.sale_start_at !== null && ticket.sale_start_at > now) ||
          (ticket.sale_end_at !== null && ticket.sale_end_at < now) ||
          ticket.sold + item.quantity > ticket.quota;

        if (isUnavailable) return { reason: "unavailable" as const };
      }

      let voucher: {
        id: bigint;
        discount_type: "percentage" | "fixed";
        discount_value: unknown;
        max_discount: unknown;
        quota: number | null;
      } | null = null;

      if (voucherCode) {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "vouchers" WHERE "code" = ${voucherCode} FOR UPDATE`,
        );

        const found = await tx.vouchers.findUnique({ where: { code: voucherCode } });
        const isInvalidVoucher =
          !found ||
          !found.is_active ||
          (found.start_at !== null && found.start_at > now) ||
          (found.end_at !== null && found.end_at < now);

        if (isInvalidVoucher) return { reason: "invalid_voucher" as const };

        const usageCount = await tx.voucher_usages.count({ where: { voucher_id: found.id } });
        const previousUsage = await tx.voucher_usages.findFirst({
          where: { voucher_id: found.id, user_id: userId },
        });

        if ((found.quota !== null && usageCount >= found.quota) || previousUsage) {
          return { reason: "invalid_voucher" as const };
        }

        voucher = found;
      }
      const subtotal = money(
        items.reduce((total, item) => total + toNumber(item.ticketType.price) * item.quantity, 0),
      );
      const rawDiscount = voucher
        ? voucher.discount_type === "percentage"
          ? (subtotal * toNumber(voucher.discount_value)) / 100
          : toNumber(voucher.discount_value)
        : 0;
      const discount = money(
        Math.min(rawDiscount, toNumber(voucher?.max_discount) || rawDiscount, subtotal),
      );
      const taxable = money(subtotal - discount + SERVICE_FEE);
      const tax = money(taxable * TAX_RATE);
      const total = money(taxable + tax);

      const order = await tx.orders.create({
        data: {
          user_id: userId,
          order_number: `ORD-${randomUUID()}`,
          subtotal,
          discount,
          service_fee: SERVICE_FEE,
          tax,
          total,
          expired_at: new Date(now.getTime() + CART_LOCK_MINUTES * 60_000),
          orderItems: {
            create: items.map((item) => ({
              ticket_type_id: item.ticket_type_id,
              quantity: item.quantity,
              price: toNumber(item.ticketType.price),
              subtotal: money(toNumber(item.ticketType.price) * item.quantity),
            })),
          },
        },
      });

      for (const item of items) {
        await tx.ticket_types.update({
          where: { id: item.ticket_type_id },
          data: { sold: { increment: item.quantity } },
        });
      }

      if (voucher) {
        await tx.voucher_usages.create({
          data: {
            voucher_id: voucher.id,
            user_id: userId,
            order_id: order.id,
          },
        });
      }

      await tx.audit_logs.create({
        data: {
          user_id: userId,
          action: "create",
          table_name: "orders",
          record_id: order.id,
          new_data: {
            status: order.status,
            subtotal,
            discount,
            service_fee: SERVICE_FEE,
            tax,
            total,
          },
        },
      });

      await tx.cart_items.deleteMany({ where: { cart_id: cart.id } });
      await tx.ticket_locks.deleteMany({ where: { cart_id: cart.id } });
      return { reason: "ok" as const, order };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
