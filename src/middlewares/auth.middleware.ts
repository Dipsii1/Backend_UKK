import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UnauthorizedError } from "../utils/app-error.js";

declare global {
  namespace Express {
    interface Request {
      userId?: bigint;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
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