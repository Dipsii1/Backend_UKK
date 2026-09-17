import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UserRepository } from "../repositories/auth.repository.js";
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
} from "../types/auth.js";

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const signAccessToken = (userId: bigint) =>
  jwt.sign({ sub: userId.toString() }, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

const signRefreshToken = (userId: bigint) =>
  jwt.sign({ sub: userId.toString() }, env.JWT_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async getAll() {
    return this.userRepository.findAll();
  }

  async getById(id: bigint) {
    const user = await this.userRepository.findById(id);
    if (!user) throw new NotFoundError("User not found");
    return user;
  }

  async register(input: RegisterInput): Promise<RegisterResult> {
    const existingEmail = await this.userRepository.findByEmail(input.email);
    if (existingEmail) throw new ConflictError("Email already exists");

    const user = await this.userRepository.createBuyerUser({
      email: input.email,
      password: await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS),
      fullName: input.fullName,
    });

    return {
      accessToken: signAccessToken(user.id),
      user: { id: user.id, email: user.email, full_name: input.fullName },
    };
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.userRepository.findByEmail(input.email);
    if (!user || !(await bcrypt.compare(input.password, user.password))) {
      throw new UnauthorizedError("Invalid credentials");
    }
    if (!user.is_active) throw new ForbiddenError("Account suspended");

    const profile = await this.userRepository.findProfileByUserId(user.id);
    const refreshToken = await this.userRepository.createRefreshToken({
      userId: user.id,
      token: signRefreshToken(user.id),
      expiredAt: new Date(Date.now() + REFRESH_TTL_MS),
    });

    return {
      accessToken: signAccessToken(user.id),
      refreshToken: refreshToken.token,
      user: {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name ?? "",
        role: user.role.name,
      },
    };
  }

  async getProfile(userId: bigint): Promise<ProfileResult> {
    const user = await this.getById(userId);
    const profile = await this.userRepository.findProfileByUserId(userId);

    return {
      id: user.id,
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

    const token = await this.userRepository.findRefreshToken(oldRefreshToken);
    if (!token || token.revoked_at || token.expired_at < new Date()) {
      throw new UnauthorizedError("Invalid or expired token");
    }

    const user = await this.getById(userId);
    if (!user.is_active) throw new ForbiddenError("Account suspended");

    await this.userRepository.revokeRefreshToken(token.id);
    const newToken = await this.userRepository.createRefreshToken({
      userId,
      token: signRefreshToken(userId),
      expiredAt: new Date(Date.now() + REFRESH_TTL_MS),
    });

    return { accessToken: signAccessToken(userId), refreshToken: newToken.token };
  }

  async logout(userId: bigint) {
    return this.userRepository.revokeAllUserRefreshTokens(userId);
  }
}