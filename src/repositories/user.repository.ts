import { prisma } from "../config/database.js";

export class UserRepository {
  async findAll() {
    return prisma.users.findMany({
      include: { role: true, userProfiles: true },
    });
  }

  async findById(id: bigint) {
    return prisma.users.findUnique({
      where: { id },
      include: { role: true, userProfiles: true },
    });
  }

  async findByUsername(username: string) {
    return prisma.users.findFirst({
      where: { email: username },
      include: { role: true, userProfiles: true },
    });
  }

  async findByRole(roleId: bigint) {
    return prisma.users.findMany({
      where: { role_id: roleId },
    });
  }

  async update(id: bigint, data: {
    username?: string;
    email?: string;
    role_id?: bigint;
  }) {
    return prisma.users.update({
      where: { id },
      data: {
        ...(data.username && { email: data.username }),
        ...(data.email && { email: data.email }),
        ...(data.role_id && { role_id: data.role_id }),
      },
    });
  }

  async delete(id: bigint) {
    return prisma.users.delete({
      where: { id },
    });
  }
}