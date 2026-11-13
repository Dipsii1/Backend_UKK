import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { UserAuthRepository } from "./auth.repository.js";
import { resetPasswordTemplate, verifyEmailTemplate } from "../../utils/email-templates.js";
import { sendMail } from "../../utils/mailer.js";
import {
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  ForbiddenError,
} from "../../utils/app-error.js";
import type {
  LoginInput,
  LoginResult,
  ProfileResult,
  RefreshResult,
  RegisterInput,
  RegisterResult,
  ResetPasswordInput,
  ResetPasswordResult,
} from "./auth.types.js";

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 1 * 60 * 60 * 1000;

const hashPassword = (password: string) => bcrypt.hash(password, env.BCRYPT_ROUNDS);
const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);
const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

const signAccessToken = (userId: bigint): string =>
  jwt.sign({ sub: userId.toString() }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

const signRefreshToken = (userId: bigint): string =>
  jwt.sign({ sub: userId.toString(), jti: crypto.randomUUID() }, env.JWT_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` as jwt.SignOptions["expiresIn"],
  });

export class AuthService {
  constructor(private readonly userAuthRepo: UserAuthRepository = new UserAuthRepository()) {}

  async register(input: RegisterInput): Promise<RegisterResult> {
    const existingEmail = await this.userAuthRepo.findByEmail(input.email);
    if (existingEmail) throw new ConflictError("Email sudah terdaftar");

    const user = await this.userAuthRepo.createBuyerUser({
      email: input.email,
      password: await hashPassword(input.password),
      fullName: input.fullName,
    });

    const verifyToken = crypto.randomBytes(32).toString("hex");
    await this.userAuthRepo.createEmailVerificationToken({
      userId: user.id,
      token: hashToken(verifyToken),
      expiredAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    try {
      await sendMail({
        to: user.email,
        subject: "Verifikasi Email",
        html: verifyEmailTemplate(`${env.CLIENT_URL}/auth/verify-email?token=${verifyToken}`),
      });
    } catch {
      // Error sudah tercatat di mailer; pendaftaran tetap berhasil.
    }

    return {
      user: { public_id: user.public_id, email: user.email, full_name: input.fullName },
      message: "Registrasi berhasil. Silakan cek email untuk verifikasi akun sebelum login.",
    };
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.userAuthRepo.findByEmail(input.email);
    if (!user?.password || !(await comparePassword(input.password, user.password))) {
      throw new UnauthorizedError("Email Atau Password Salah");
    }
    if (!user.is_active) throw new ForbiddenError("Akun sudah tidak aktif");
    if (!user.email_verified) throw new ForbiddenError("Email belum diverifikasi");

    const profile = user.userProfiles?.[0];
    const refreshToken = signRefreshToken(user.id);
    await this.userAuthRepo.createRefreshToken({
      userId: user.id,
      token: hashToken(refreshToken),
      expiredAt: new Date(Date.now() + REFRESH_TTL_MS),
    });

    return {
      accessToken: signAccessToken(user.id),
      refreshToken,
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
    if (!user) throw new NotFoundError("Pengguna tidak ditemukan");

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
      throw new UnauthorizedError("Token tidak valid atau sudah kadaluarsa");
    }

    const token = await this.userAuthRepo.findRefreshToken(hashToken(oldRefreshToken));
    if (!token || token.revoked_at || token.expired_at < new Date()) {
      throw new UnauthorizedError("Token tidak valid atau sudah kadaluarsa");
    }

    const user = await this.userAuthRepo.findById(userId);
    if (!user?.is_active) throw new ForbiddenError("Akun tidak aktif");

    const revoked = await this.userAuthRepo.revokeRefreshTokenIfActive(token.id);
    if (revoked.count === 0) {
      throw new UnauthorizedError("Token tidak valid atau sudah kadaluarsa");
    }
    const newRefreshToken = signRefreshToken(userId);
    await this.userAuthRepo.createRefreshToken({
      userId,
      token: hashToken(newRefreshToken),
      expiredAt: new Date(Date.now() + REFRESH_TTL_MS),
    });

    return { accessToken: signAccessToken(userId), refreshToken: newRefreshToken };
  }

  async logout(userId: bigint) {
    return this.userAuthRepo.revokeAllUserRefreshTokens(userId);
  }

  async requestPasswordReset(email: string): Promise<ResetPasswordResult> {
    const user = await this.userAuthRepo.findByEmail(email);
    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      await this.userAuthRepo.createPasswordResetToken({
        userId: user.id,
        token: hashToken(resetToken),
        expiredAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      try {
        await sendMail({
          to: user.email,
          subject: "Reset Kata Sandi",
          html: resetPasswordTemplate(`${env.CLIENT_URL}/auth/reset-password?token=${resetToken}`),
        });
      } catch {
        // Error sudah tercatat di mailer, anti user enumeration.
      }
    }

    return { message: "Jika email terdaftar, link reset kata sandi telah dikirim" };
  }

  async resetPassword(input: ResetPasswordInput): Promise<ResetPasswordResult> {
    const token = await this.userAuthRepo.findPasswordResetToken(hashToken(input.token));
    if (!token || token.used_at || token.expired_at < new Date()) {
      throw new UnauthorizedError("Token reset kata sandi tidak valid atau sudah kadaluarsa");
    }

    const completed = await this.userAuthRepo.completePasswordReset(
      token.id,
      token.user_id,
      await hashPassword(input.newPassword),
    );
    if (!completed) {
      throw new UnauthorizedError("Token reset kata sandi tidak valid atau sudah kadaluarsa");
    }

    return { message: "Kata sandi berhasil direset" };
  }

  async requestEmailVerification(email: string) {
    const user = await this.userAuthRepo.findByEmail(email);
    if (user) {
      const verifyToken = crypto.randomBytes(32).toString("hex");
      await this.userAuthRepo.createEmailVerificationToken({
        userId: user.id,
        token: hashToken(verifyToken),
        expiredAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      try {
        await sendMail({
          to: user.email,
          subject: "Verifikasi Email",
          html: verifyEmailTemplate(`${env.CLIENT_URL}/auth/verify-email?token=${verifyToken}`),
        });
      } catch {
        // Error sudah tercatat di mailer.
      }
    }

    return { message: "Jika email terdaftar, link verifikasi telah dikirim" };
  }

  async confirmEmailVerification(token: string) {
    const verification = await this.userAuthRepo.findEmailVerificationToken(hashToken(token));
    if (!verification || verification.expired_at < new Date() || verification.verified_at) {
      throw new UnauthorizedError("Token verifikasi tidak valid atau sudah kadaluarsa");
    }

    const consumed = await this.userAuthRepo.consumeEmailVerificationToken(verification.id);
    if (consumed.count === 0) {
      throw new UnauthorizedError("Token verifikasi tidak valid atau sudah kadaluarsa");
    }
    await this.userAuthRepo.setEmailVerified(verification.user.id);
    return { message: "Email berhasil diverifikasi" };
  }
}
