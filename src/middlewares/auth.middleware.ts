import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";
import { ForbiddenError, UnauthorizedError } from "../utils/app-error.js";

declare global {
  namespace Express {
    interface Request {
      userId?: bigint;
      userRole?: string;
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) {
    next(new UnauthorizedError("Autentikasi diperlukan"));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    const userId = BigInt(payload.sub);

    const user = await prisma.users.findUnique({
      where: { id: userId },
      include: { role: true },
    });

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
  } catch {
    next(new UnauthorizedError("Token tidak valid atau sudah kadaluarsa"));
  }
};

export const requireRole = (...roles: string[]) =>
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

export const requireSelfOrRole = (...roles: string[]) =>
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