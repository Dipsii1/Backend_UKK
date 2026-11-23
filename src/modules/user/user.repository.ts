import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";

export class UserRepository {
  private userSelect = {
    id: true,
    public_id: true,
    email: true,
    is_active: true,
    created_at: true,
    updated_at: true,
    role: { select: { name: true } },
    userProfiles: true,
  } as const;

  async findAll(page: number, limit: number) {
    const [data, total] = await prisma.$transaction([
      prisma.users.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: "desc" },
        select: this.userSelect,
      }),
      prisma.users.count(),
    ]);
    return { data, total };
  }

  async findById(id: bigint) {
    return prisma.users.findUnique({
      where: { id },
      select: this.userSelect,
    });
  }

  async findByEmail(email: string) {
    return prisma.users.findUnique({
      where: { email },
      include: { role: true, userProfiles: true },
    });
  }

  async findByRole(roleId: bigint) {
    return prisma.users.findMany({
      where: { role_id: roleId },
    });
  }

  // Email baru wajib diverifikasi ulang, sesi lama dicabut.
  async update(id: bigint, data: { email?: string }) {
    if (!data.email) return this.findById(id);
    const email = data.email;
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.refresh_tokens.updateMany({
        where: { user_id: id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
      return tx.users.update({
        where: { id },
        data: { email, email_verified: false },
        select: this.userSelect,
      });
    });
  }

  async changeRole(id: bigint, roleId: bigint, actorId: bigint) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const before = await tx.users.findUnique({ where: { id }, select: { role_id: true } });
      await tx.users.update({ where: { id }, data: { role_id: roleId } });
      await tx.audit_logs.create({
        data: {
          user_id: actorId,
          action: "update",
          table_name: "users",
          record_id: id,
          old_data: { role_id: before?.role_id.toString() ?? null },
          new_data: { role_id: roleId.toString() },
        },
      });
    });
  }

  // Soft delete: user punya banyak relasi (order, tiket, audit) yang tidak boleh hilang.
  async deactivate(id: bigint, actorId: bigint) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.users.update({ where: { id }, data: { is_active: false } });
      await tx.refresh_tokens.updateMany({
        where: { user_id: id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
      await tx.audit_logs.create({
        data: {
          user_id: actorId,
          action: "delete",
          table_name: "users",
          record_id: id,
          new_data: { is_active: false },
        },
      });
    });
  }

  async updateFullName(id: bigint, full_name: string) {
    return prisma.user_profiles.upsert({
      where: { user_id: id },
      update: { full_name },
      create: { user_id: id, full_name },
    });
  }
}
