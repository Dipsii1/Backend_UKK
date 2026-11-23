import { prisma } from "../../lib/prisma.js";
import type { BroadcastInput } from "./notification.types.js";

export class NotificationRepository {
  async findByUser(userId: bigint, page: number, limit: number) {
    const where = { user_id: userId };
    const [data, total, unread] = await prisma.$transaction([
      prisma.notifications.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      prisma.notifications.count({ where }),
      prisma.notifications.count({ where: { ...where, is_read: false } }),
    ]);
    return { data, total, unread };
  }

  async findByIdAndUser(id: bigint, userId: bigint) {
    return prisma.notifications.findFirst({
      where: { id, user_id: userId },
    });
  }

  async markRead(id: bigint) {
    return prisma.notifications.update({
      where: { id },
      data: { is_read: true, read_at: new Date() },
    });
  }

  // Satu token hanya milik satu user: perangkat yang ganti akun memindahkan token ke user baru.
  async upsertPushToken(userId: bigint, token: string) {
    return prisma.push_tokens.upsert({
      where: { token },
      create: { user_id: userId, token },
      update: { user_id: userId },
    });
  }

  async deletePushToken(userId: bigint, token: string) {
    const result = await prisma.push_tokens.deleteMany({
      where: { token, user_id: userId },
    });
    return result.count;
  }

  async deletePushTokens(tokens: string[]) {
    await prisma.push_tokens.deleteMany({
      where: { token: { in: tokens } },
    });
  }

  async findPushTokens(userIds: bigint[]) {
    const rows = await prisma.push_tokens.findMany({
      where: { user_id: { in: userIds } },
      select: { token: true },
    });
    return rows.map((row) => row.token);
  }

  // Simpan notifikasi untuk semua user aktif sesuai role, plus audit log, dalam satu transaksi.
  async broadcast(adminId: bigint, input: BroadcastInput) {
    return prisma.$transaction(async (tx) => {
      const users = await tx.users.findMany({
        where: {
          is_active: true,
          ...(input.role !== "all" && { role: { name: input.role } }),
        },
        select: { id: true },
      });
      const userIds = users.map((user) => user.id);

      await tx.notifications.createMany({
        data: userIds.map((user_id) => ({
          user_id,
          title: input.title,
          message: input.message,
          type: input.type ?? "system",
        })),
      });

      await tx.audit_logs.create({
        data: {
          user_id: adminId,
          action: "create",
          table_name: "notifications",
          new_data: { broadcast: true, role: input.role, title: input.title, recipients: userIds.length },
        },
      });

      return userIds;
    });
  }
}
