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

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) {
    next(new UnauthorizedError("Autentikasi diperlukan"));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    req.userId = BigInt(payload.sub);
    next();
  } catch {
    next(new UnauthorizedError("Token tidak valid atau sudah kadaluarsa"));
  }
};

export const requireRole = (...roles: string[]) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await prisma.users.findUnique({
        where: { id: req.userId! },
        include: { role: true },
      });

      if (!user || !user.is_active) {
        next(new UnauthorizedError("Sesi tidak valid"));
        return;
      }

      req.userRole = user.role.name;
      if (!roles.includes(user.role.name)) {
        next(new ForbiddenError("Anda tidak memiliki akses untuk tindakan ini"));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };

export const requireSelfOrRole = (...roles: string[]) =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const targetUserId = BigInt(req.params.id as string);
      if (req.userId === targetUserId) {
        next();
        return;
      }

      const user = await prisma.users.findUnique({
        where: { id: req.userId! },
        include: { role: true },
      });

      if (!user || !user.is_active) {
        next(new UnauthorizedError("Sesi tidak valid"));
        return;
      }

      if (!roles.includes(user.role.name)) {
        next(new ForbiddenError("Anda tidak memiliki akses untuk tindakan ini"));
        return;
      }

      req.userRole = user.role.name;
      next();
    } catch (error) {
      next(error);
    }
  };
