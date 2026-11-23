import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { UpdateProfileInput } from "./auth.types.js";

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

  async findOrganizerBySlug(slug: string) {
    return prisma.organizers.findUnique({ where: { slug } });
  }

  async upsertProfile(userId: bigint, data: UpdateProfileInput, fallbackName: string) {
    return prisma.user_profiles.upsert({
      where: { user_id: userId },
      update: data,
      create: { ...data, user_id: userId, full_name: data.full_name ?? fallbackName },
    });
  }

  async findAuthUserById(id: bigint) {
    return prisma.users.findUnique({
      where: { id },
      select: {
        id: true,
        is_active: true,
        email_verified: true,
        role: { select: { name: true } },
      },
    });
  }

  // register (default: buyer)
  async createBuyerUser(data: {
    email: string;
    password: string;
    fullName: string;
  }) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

  async createOrganizerUser(data: {
    email: string;
    password: string;
    fullName: string;
    companyName: string;
    slug: string;
    phone?: string;
    website?: string;
    description?: string;
    verificationToken: string;
    verificationExpiresAt: Date;
  }) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const role = await tx.roles.upsert({
        where: { name: "organizer" },
        update: {},
        create: { name: "organizer" },
      });

      const user = await tx.users.create({
        data: { email: data.email, password: data.password, role_id: role.id },
      });

      await tx.user_profiles.create({
        data: { user_id: user.id, full_name: data.fullName, phone: data.phone },
      });

      const organizer = await tx.organizers.create({
        data: {
          user_id: user.id,
          company_name: data.companyName,
          slug: data.slug,
          phone: data.phone,
          website: data.website,
          description: data.description,
        },
      });

      await tx.email_verifications.create({
        data: { user_id: user.id, token: data.verificationToken, expired_at: data.verificationExpiresAt },
      });

      return { user, organizer };
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

  async revokeRefreshTokenIfActive(id: bigint) {
    return prisma.refresh_tokens.updateMany({
      where: { id, revoked_at: null },
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

  async completePasswordReset(id: bigint, userId: bigint, password: string) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const consumed = await tx.password_resets.updateMany({
        where: { id, used_at: null, expired_at: { gt: new Date() } },
        data: { used_at: new Date() },
      });
      if (consumed.count === 0) return false;

      await tx.users.update({ where: { id: userId }, data: { password } });
      await tx.refresh_tokens.updateMany({
        where: { user_id: userId, revoked_at: null },
        data: { revoked_at: new Date() },
      });
      return true;
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

  // Konsumsi token dan tandai email terverifikasi dalam satu transaksi.
  async consumeEmailVerificationToken(id: bigint) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const consumed = await tx.email_verifications.updateMany({
        where: { id, verified_at: null, expired_at: { gt: new Date() } },
        data: { verified_at: new Date() },
      });
      if (consumed.count > 0) {
        await tx.users.updateMany({
          where: { emailVerifications: { some: { id } } },
          data: { email_verified: true },
        });
      }
      return consumed;
    });
  }
}
