import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UserAuthRepository } from "../modules/auth/auth.repository.js";
import { ForbiddenError, UnauthorizedError } from "../utils/app-error.js";

declare global {
  namespace Express {
    interface Request {
      userId?: bigint;
      userRole?: string;
    }
  }
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) {
    next(new UnauthorizedError("Autentikasi diperlukan"));
    return;
  }

  let userId: bigint;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    // type wajib "access": refresh token (secret sama) tidak boleh dipakai sebagai access token.
    if (typeof payload !== "object" || payload === null || payload.type !== "access" || typeof payload.sub !== "string" || !/^[1-9]\d*$/.test(payload.sub)) {
      throw new Error("Invalid JWT subject");
    }
    userId = BigInt(payload.sub);
  } catch {
    next(new UnauthorizedError("Token tidak valid atau sudah kadaluarsa"));
    return;
  }

  try {
    const user = await new UserAuthRepository().findAuthUserById(userId);
    if (!user) {
      next(new UnauthorizedError("Sesi tidak valid"));
      return;
    }

    if (!user.is_active) {
      next(new ForbiddenError("Akun tidak aktif"));
      return;
    }

    if (!user.email_verified) {
      next(new ForbiddenError("Email belum diverifikasi"));
      return;
    }

    req.userId = userId;
    req.userRole = user.role.name;
    next();
  } catch (error) {
    next(error);
  }
};

export const authorize = (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.userId) {
      next(new UnauthorizedError("Autentikasi diperlukan"));
      return;
    }

    if (!roles.includes(req.userRole ?? "")) {
      next(new ForbiddenError("Anda tidak memiliki akses untuk tindakan ini"));
      return;
    }

    next();
  };

export const authorizeSelfOrRole = (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const targetUserId = BigInt(req.params.id as string);
    if (req.userId === targetUserId) {
      next();
      return;
    }

    if (!roles.includes(req.userRole ?? "")) {
      next(new ForbiddenError("Anda tidak memiliki akses untuk tindakan ini"));
      return;
    }

    next();
  };
