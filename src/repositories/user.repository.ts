import { prisma } from "../config/database.js";

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

  async findAll() {
    return prisma.users.findMany({
      select: this.userSelect,
    });
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

  async update(id: bigint, data: {
    email?: string;
    role_id?: bigint;
  }) {
    return prisma.users.update({
      where: { id },
      data: {
        ...(data.email && { email: data.email }),
        ...(data.role_id && { role_id: data.role_id }),
      },
      select: this.userSelect,
    });
  }

  async delete(id: bigint) {
    return prisma.users.delete({
      where: { id },
    });
  }

  async updateFullName(id: bigint, full_name: string) {
    return prisma.user_profiles.update({
      where: { user_id: id },
      data: { full_name },
    });
  }
}