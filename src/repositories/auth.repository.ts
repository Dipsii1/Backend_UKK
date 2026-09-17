import { prisma } from "../config/database.js";

export class UserAuthRepository {
  async findByEmail(email: string) {
    return prisma.users.findUnique({
      where: { email },
      include: { role: true, userProfiles: true },
    });
  }

  async findById(id: bigint) {
    return prisma.users.findUnique({
      where: { id },
      include: { role: true, userProfiles: true },
    });
  }

  // register (default: buyer)
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

  async createPasswordResetToken(data: { userId: bigint; token: string; expiredAt: Date }) {
    return prisma.password_resets.create({
      data: {
        user_id: data.userId,
        token: data.token,
        expired_at: data.expiredAt,
      },
    });
  }

  async findPasswordResetToken(token: string) {
    return prisma.password_resets.findUnique({ where: { token } });
  }

  async markPasswordResetUsed(id: bigint) {
    return prisma.password_resets.update({
      where: { id },
      data: { used_at: new Date() },
    });
  }

  async updatePassword(userId: bigint, password: string) {
    return prisma.users.update({
      where: { id: userId },
      data: { password },
    });
  }

  // Email verification methods
  async createEmailVerificationToken(data: { userId: bigint; token: string; expiredAt: Date }) {
    return prisma.email_verifications.create({
      data: {
        user_id: data.userId,
        token: data.token,
        expired_at: data.expiredAt,
      },
    });
  }

  async findEmailVerificationToken(token: string) {
    return prisma.email_verifications.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async setEmailVerified(userId: bigint) {
    return prisma.users.update({
      where: { id: userId },
      data: { email_verified: true },
    });
  }
}