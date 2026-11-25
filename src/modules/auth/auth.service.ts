import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { UserAuthRepository } from "./auth.repository.js";
import { resetPasswordTemplate, verifyEmailTemplate } from "../../utils/email-templates.js";
import { sendMail } from "../../utils/mailer.js";
import { documentStorage } from "../../utils/document-storage.js";
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
  RegisterOrganizerInput,
  RegisterOrganizerResult,
  OrganizerDocumentFiles,
  UpdateProfileInput,
  ResetPasswordInput,
  ResetPasswordResult,
} from "./auth.types.js";

const REFRESH_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 1 * 60 * 60 * 1000;

const hashPassword = (password: string) => bcrypt.hash(password, env.BCRYPT_ROUNDS);
const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);
const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

const signAccessToken = (userId: bigint): string =>
  jwt.sign({ sub: userId.toString(), type: "access" }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });

const signRefreshToken = (userId: bigint): string =>
  jwt.sign({ sub: userId.toString(), type: "refresh", jti: crypto.randomUUID() }, env.JWT_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d` as jwt.SignOptions["expiresIn"],
  });

export class AuthService {
  constructor(private readonly userAuthRepo: UserAuthRepository = new UserAuthRepository()) {}

  // Gagal kirim email tidak menggagalkan alur pemanggil; error sudah tercatat di mailer.
  private async mailVerification(email: string, token: string) {
    try {
      await sendMail({
        to: email,
        subject: "Verifikasi Email Tixo",
        html: verifyEmailTemplate(`${env.CLIENT_URL}/auth/verify-email?token=${token}`),
      });
    } catch {
      // diabaikan, lihat komentar di atas
    }
  }

  private async issueVerification(userId: bigint, email: string) {
    const verifyToken = crypto.randomBytes(32).toString("hex");
    await this.userAuthRepo.createEmailVerificationToken({
      userId,
      token: hashToken(verifyToken),
      expiredAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    });
    await this.mailVerification(email, verifyToken);
  }

  async register(input: RegisterInput): Promise<RegisterResult> {
    const existingEmail = await this.userAuthRepo.findByEmail(input.email);
    if (existingEmail) throw new ConflictError("Email sudah terdaftar");

    const user = await this.userAuthRepo.createBuyerUser({
      email: input.email,
      password: await hashPassword(input.password),
      fullName: input.fullName,
    });

    await this.issueVerification(user.id, user.email);

    return {
      user: { public_id: user.public_id, email: user.email, full_name: input.fullName },
      message: "Registrasi berhasil. Silakan cek email untuk verifikasi akun sebelum login.",
    };
  }

  async registerOrganizer(input: RegisterOrganizerInput, files: OrganizerDocumentFiles): Promise<RegisterOrganizerResult> {
    const [existingEmail, existingSlug] = await Promise.all([
      this.userAuthRepo.findByEmail(input.email),
      this.userAuthRepo.findOrganizerBySlug(input.slug),
    ]);
    if (existingEmail) throw new ConflictError("Email sudah terdaftar");
    if (existingSlug) throw new ConflictError("Slug organizer sudah digunakan");

    // Berkas diunggah setelah cek duplikat agar request yang pasti gagal tidak meninggalkan file di storage.
    const documents = await documentStorage.uploadAll(files, "organizer-documents");
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const { user, organizer } = await this.userAuthRepo.createOrganizerUser({
      ...input,
      password: await hashPassword(input.password),
      verificationToken: hashToken(verifyToken),
      verificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      documents,
    }).catch(async (error: unknown) => {
      await documentStorage.removeAll(documents.map((document) => document.storage_key));
      throw error;
    });

    await this.mailVerification(user.email, verifyToken);

    return {
      user: { public_id: user.public_id, email: user.email, full_name: input.fullName },
      organizer: {
        public_id: organizer.public_id,
        company_name: organizer.company_name,
        slug: organizer.slug,
        status: "pending",
      },
      message: "Pendaftaran organizer berhasil. Verifikasi email lalu tunggu persetujuan admin.",
    };
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const user = await this.userAuthRepo.findByEmail(input.email);
    if (!user?.password || !(await comparePassword(input.password, user.password))) {
      throw new UnauthorizedError("Email Atau Password Salah");
    }
    // Ditolak sebelum token/sesi dibuat bila role tidak sesuai.
    if (input.role && user.role.name !== input.role) {
      throw new ForbiddenError(`Akun ini tidak memiliki akses ${input.role}`);
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

  async updateProfile(userId: bigint, input: UpdateProfileInput): Promise<ProfileResult> {
    const user = await this.userAuthRepo.findById(userId);
    if (!user) throw new NotFoundError("Pengguna tidak ditemukan");

    const fallbackName = user.userProfiles?.[0]?.full_name ?? user.email.split("@")[0];
    await this.userAuthRepo.upsertProfile(userId, input, fallbackName);
    return this.getProfile(userId);
  }

  async refresh(oldRefreshToken: string): Promise<RefreshResult> {
    let userId: bigint;
    try {
      const payload = jwt.verify(oldRefreshToken, env.JWT_SECRET, { algorithms: ["HS256"] });
      if (typeof payload !== "object" || payload.type !== "refresh" || typeof payload.sub !== "string") {
        throw new Error("Invalid refresh token");
      }
      userId = BigInt(payload.sub);
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
        expiredAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
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
    if (user) await this.issueVerification(user.id, user.email);

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
    return { message: "Email berhasil diverifikasi" };
  }
}
