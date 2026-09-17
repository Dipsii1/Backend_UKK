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

  async findByEmail(email: string) {
    return prisma.users.findUnique({
      where: { email },
      include: { role: true },
    });
  }

  async findByRole(roleId: bigint) {
    return prisma.users.findMany({
      where: { role_id: roleId },
    });
  }

  async create(data: {
    public_id: string;
    role_id: bigint;
    username: string;
    email: string;
    password: string;
  }) {
    return prisma.users.create({
      data: {
        public_id: data.public_id || crypto.randomUUID(),
        role_id: data.role_id,
        email: data.email,
        password: data.password,
      },
    });
  }

  async update(
    id: bigint,
    data: {
      username?: string;
      email?: string;
      role_id?: bigint;
    }
  ) {
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

  async findProfileByUserId(userId: bigint) {
    return prisma.user_profiles.findUnique({
      where: { user_id: userId },
    });
  }

  async createBuyerUser(data: {
    email: string;
    password: string;
    fullName: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const role = await tx.roles.upsert({
        where: { name: "buyer" },
        update: {},
        create: { name: "buyer" },
      });

      const user = await tx.users.create({
        data: {
          email: data.email,
          password: data.password,
          role_id: role.id,
        },
      });

      await tx.user_profiles.create({
        data: {
          user_id: user.id,
          full_name: data.fullName,
        },
      });

      await tx.refresh_tokens.create({
        data: {
          user_id: user.id,
          token: crypto.randomUUID(),
          expired_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      return user;
    });
  }

  async createRefreshToken(data: { userId: bigint; token: string; expiredAt: Date }) {
    return prisma.refresh_tokens.create({
      data: {
        user_id: data.userId,
        token: data.token,
        expired_at: data.expiredAt,
      },
    });
  }

  async findRefreshToken(token: string) {
    return prisma.refresh_tokens.findUnique({ where: { token } });
  }

  async revokeRefreshToken(id: bigint) {
    return prisma.refresh_tokens.update({
      where: { id },
      data: { revoked_at: new Date() },
    });
  }

  async revokeAllUserRefreshTokens(userId: bigint) {
    return prisma.refresh_tokens.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }
}