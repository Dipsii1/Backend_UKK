import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { UserAuthRepository } from "../repositories/auth.repository.js";
import {
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} from "../utils/app-error.js";
import type {
  LoginInput,
  LoginResult,
  ProfileResult,
  RefreshResult,
  RegisterInput,
  RegisterResult,
  ResetPasswordInput,
  ResetPasswordResult,
} from "../types/auth.js";

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 1 * 60 * 60 * 1000;

const hashPassword = (password: string) => bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);

const signAccessToken = (userId: bigint) =>
  jwt.sign({ sub: userId.toString() }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

const signRefreshToken = (userId: bigint) =>
  jwt.sign({ sub: userId.toString() }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

export class AuthService {
  constructor(private readonly userAuthRepo: UserAuthRepository = new UserAuthRepository()) {}

  async register(input: RegisterInput): Promise<RegisterResult> {
    const existingEmail = await this.userAuthRepo.findByEmail(input.email);
    if (existingEmail) throw new ConflictError("Email already exists");

    const user = await this.userAuthRepo.createBuyerUser({
      email: input.email,
      password: await hashPassword(input.password),
      fullName: input.fullName,
    });

    return {
      accessToken: signAccessToken(user.id),
      user: { public_id: user.public_id, email: user.email, full_name: input.fullName },
    };
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.userAuthRepo.findByEmail(input.email);
    if (!user || !(await comparePassword(input.password, user.password!))) {
      throw new UnauthorizedError("Invalid credentials");
    }
    if (!user.is_active) throw new ForbiddenError("Account suspended");

    const profile = user.userProfiles?.[0];
    const refreshTokenRecord = await this.userAuthRepo.createRefreshToken({
      userId: user.id,
      token: signRefreshToken(user.id),
      expiredAt: new Date(Date.now() + REFRESH_TTL_MS),
    });

    return {
      accessToken: signAccessToken(user.id),
      refreshToken: refreshTokenRecord.token,
      user: {
        public_id: user.public_id,
        email: user.email,
        full_name: profile?.full_name ?? "",
        role: user.role.name,
      },
    };
  }

  async getProfile(userId: bigint): Promise<ProfileResult> {
    const user = await this.userAuthRepo.findById(userId);
    if (!user) throw new NotFoundError("User not found");

    const profile = user.userProfiles?.[0] ?? null;

    return {
      public_id: user.public_id,
      email: user.email,
      role: user.role.name,
      full_name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      gender: profile?.gender ?? null,
      birth_date: profile?.birth_date ?? null,
      avatar: profile?.avatar ?? null,
      address: profile?.address ?? null,
      province_id: profile?.province_id ?? null,
      city_id: profile?.city_id ?? null,
    };
  }

  async refresh(oldRefreshToken: string): Promise<RefreshResult> {
    let userId: bigint;
    try {
      userId = BigInt((jwt.verify(oldRefreshToken, env.JWT_SECRET) as { sub: string }).sub);
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }

    const token = await this.userAuthRepo.findRefreshToken(oldRefreshToken);
    if (!token || token.revoked_at || token.expired_at < new Date()) {
      throw new UnauthorizedError("Invalid or expired token");
    }

    const user = await this.userAuthRepo.findById(userId);
    if (!user?.is_active) throw new ForbiddenError("Account suspended");

    await this.userAuthRepo.revokeRefreshToken(token.id);
    const newToken = await this.userAuthRepo.createRefreshToken({
      userId,
      token: signRefreshToken(userId),
      expiredAt: new Date(Date.now() + REFRESH_TTL_MS),
    });

    return { accessToken: signAccessToken(userId), refreshToken: newToken.token };
  }

  async logout(userId: bigint) {
    return this.userAuthRepo.revokeAllUserRefreshTokens(userId);
  }

  async requestPasswordReset(email: string): Promise<ResetPasswordResult> {
    const user = await this.userAuthRepo.findByEmail(email);
    if (!user) throw new NotFoundError("User not found");

    const resetToken = crypto.randomBytes(32).toString("hex");
    await this.userAuthRepo.createPasswordResetToken({
      userId: user.id,
      token: resetToken,
      expiredAt: new Date(Date.now() + RESET_TTL_MS),
    });

    return { message: "Password reset token created" };
  }

  async resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResult> {
    const token = await this.userAuthRepo.findPasswordResetToken(input.token);
    if (!token || token.used_at || token.expired_at < new Date()) {
      throw new UnauthorizedError("Invalid or expired reset token");
    }

    await this.userAuthRepo.updatePassword(token.user_id, await hashPassword(input.newPassword));
    await this.userAuthRepo.markPasswordResetUsed(token.id);

    return { message: "Password reset successful" };
  }
}