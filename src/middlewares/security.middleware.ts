import type { NextFunction, Request, Response } from "express";
import { TooManyRequestsError, ValidationError } from "../utils/app-error.js";

type Bucket = { count: number; resetAt: number };

export const requireNumericParam = (parameter: string) =>
  (req: Request, _res: Response, next: NextFunction): void => {
  if (!/^[1-9]\d*$/.test(req.params[parameter] as string)) {
    next(new ValidationError("ID tidak valid", [{ field: parameter, message: "Harus berupa angka positif" }]));
    return;
  }
  next();
};

export const requireNumericId = requireNumericParam("id");

export const rateLimit = (windowMs: number, max: number) => {
  const buckets = new Map<string, Bucket>();
  return (req: Request, _res: Response, next: NextFunction): void => {
    const now = Date.now();
    if (buckets.size >= 10_000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }
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
