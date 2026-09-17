import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { sendError } from "../utils/api-response.js";

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
    sendError(res, "Authentication required", 401);
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    req.userId = BigInt(payload.sub);
    next();
  } catch {
    sendError(res, "Invalid or expired access token", 401);
  }
};
