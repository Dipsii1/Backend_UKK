import { prisma } from "../../lib/prisma.js";
import type { OrganizerStatus, Prisma } from "../../generated/prisma/client.js";
import type { OrganizerQuery, TransactionLogQuery, UserQuery } from "./admin.types.js";


export class AdminRepository {
  async approveEvent(eventId: bigint, adminId: bigint) {
    return prisma.$transaction(async (tx) => {
      const event = await tx.events.findUnique({ where: { id: eventId } });
      if (!event) return null;
      if (event.status !== "pending_review") return { event: null, currentStatus: event.status };
      const updated = await tx.events.update({
        where: { id: eventId },
        data: { status: "published", is_published: true, approved_by: adminId, approved_at: new Date(), rejected_reason: null },
      });
      await tx.audit_logs.create({
        data: { user_id: adminId, action: "update", table_name: "events", record_id: eventId, old_data: { status: event.status, is_published: event.is_published }, new_data: { status: updated.status, is_published: updated.is_published } },
      });
      return { event: updated, currentStatus: event.status };
    });
  }

  async findUsers(filters: UserQuery) {
    const where: Prisma.usersWhereInput = {
      ...(filters.is_active !== undefined ? { is_active: filters.is_active } : {}),
      ...(filters.role ? { role: { name: filters.role } } : {}),
      ...(filters.search ? { OR: [{ email: { contains: filters.search, mode: "insensitive" } }, { userProfiles: { some: { full_name: { contains: filters.search, mode: "insensitive" } } } }] } : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.users.findMany({ where, skip: (filters.page - 1) * filters.limit, take: filters.limit, orderBy: { created_at: "desc" }, select: { id: true, public_id: true, email: true, email_verified: true, is_active: true, created_at: true, role: { select: { name: true } }, userProfiles: { select: { full_name: true, phone: true } }, organizers: { select: { id: true, company_name: true, status: true } } } }),
      prisma.users.count({ where }),
    ]);
    return { data, total };
  }

  async setUserActive(id: bigint, isActive: boolean, adminId: bigint) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.users.findUnique({ where: { id } });
      if (!user) return null;
      const updated = await tx.users.update({ where: { id }, data: { is_active: isActive }, select: { id: true, public_id: true, email: true, is_active: true, role: { select: { name: true } } } });
      await tx.audit_logs.create({ data: { user_id: adminId, action: "update", table_name: "users", record_id: id, old_data: { is_active: user.is_active }, new_data: { is_active: isActive } } });
      return updated;
    });
  }

  async findOrganizers(filters: OrganizerQuery) {
    const where: Prisma.organizersWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search ? { OR: [{ company_name: { contains: filters.search, mode: "insensitive" } }, { email: { contains: filters.search, mode: "insensitive" } }, { owner: { email: { contains: filters.search, mode: "insensitive" } } }] } : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.organizers.findMany({ where, skip: (filters.page - 1) * filters.limit, take: filters.limit, orderBy: { created_at: "desc" }, include: { owner: { select: { id: true, email: true, userProfiles: { select: { full_name: true } } } }, _count: { select: { events: true } } } }),
      prisma.organizers.count({ where }),
    ]);
    return { data, total };
  }

  async setOrganizerStatus(id: bigint, status: OrganizerStatus, adminId: bigint) {
    return prisma.$transaction(async (tx) => {
      const organizer = await tx.organizers.findUnique({ where: { id } });
      if (!organizer) return null;
      const updated = await tx.organizers.update({ where: { id }, data: { status, verified_at: status === "verified" ? new Date() : null } });
      await tx.audit_logs.create({ data: { user_id: adminId, action: "update", table_name: "organizers", record_id: id, old_data: { status: organizer.status }, new_data: { status } } });
      return updated;
    });
  }

  async getDashboard() {
    const [users, organizers, events, pendingEvents, paidOrders, paidAggregate, recentOrders] = await Promise.all([
      prisma.users.count(), prisma.organizers.count(), prisma.events.count(), prisma.events.count({ where: { status: "pending_review" } }), prisma.orders.count({ where: { status: "paid" } }), prisma.orders.aggregate({ where: { status: "paid" }, _sum: { total: true } }),
      prisma.orders.findMany({ take: 5, orderBy: { created_at: "desc" }, select: { id: true, order_number: true, total: true, status: true, created_at: true, user: { select: { email: true } } } }),
    ]);
    return { totals: { users, organizers, events, pending_events: pendingEvents, paid_orders: paidOrders, paid_revenue: paidAggregate._sum.total ?? 0 }, recent_orders: recentOrders };
  }

  async findTransactionLogs(filters: TransactionLogQuery) {
    const where: Prisma.ordersWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...((filters.start_date || filters.end_date) ? { created_at: { ...(filters.start_date ? { gte: filters.start_date } : {}), ...(filters.end_date ? { lte: filters.end_date } : {}) } } : {}),
    };
    const [data, total] = await prisma.$transaction([
      prisma.orders.findMany({ where, skip: (filters.page - 1) * filters.limit, take: filters.limit, orderBy: { created_at: "desc" }, select: { id: true, public_id: true, order_number: true, subtotal: true, discount: true, service_fee: true, tax: true, total: true, status: true, created_at: true, user: { select: { id: true, email: true, userProfiles: { select: { full_name: true } } } }, payments: { select: { public_id: true, payment_method: true, provider: true, transaction_id: true, gross_amount: true, status: true, paid_at: true } } } }),
      prisma.orders.count({ where }),
    ]);
    return { data, total };
  }
}
