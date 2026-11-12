import type { NextFunction, Request, Response } from "express";
import { TooManyRequestsError, ValidationError } from "../utils/app-error.js";

type Bucket = { count: number; resetAt: number };

export const requireNumericId = (req: Request, _res: Response, next: NextFunction): void => {
  if (!/^[1-9]\d*$/.test(req.params.id as string)) {
    next(new ValidationError("ID tidak valid", [{ field: "id", message: "Harus berupa angka positif" }]));
    return;
  }
  next();
};

export const rateLimit = (windowMs: number, max: number) => {
  const buckets = new Map<string, Bucket>();
  return (req: Request, _res: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (bucket.count >= max) {
      next(new TooManyRequestsError("Terlalu banyak permintaan, coba lagi nanti"));
      return;
    }
    bucket.count += 1;
    next();
  };
};
