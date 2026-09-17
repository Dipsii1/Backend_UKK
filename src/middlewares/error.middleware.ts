import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodSchema } from "zod";
import { env } from "../config/env.js";
import { AppError, ValidationError, ConflictError, UnauthorizedError, ForbiddenError, NotFoundError } from "../utils/app-error.js";
import { sendError } from "../utils/api-response.js";

const errorMap: Record<string, AppError> = {
  EMAIL_EXISTS: new ConflictError("Email sudah terdaftar"),
  INVALID_CREDENTIALS: new UnauthorizedError("Email Atau Password Salah"),
  INVALID_TOKEN: new UnauthorizedError("Token tidak valid atau sudah kadaluarsa"),
  ACCOUNT_SUSPENDED: new ForbiddenError("Akun sudah tidak aktif"),
  NOT_FOUND: new NotFoundError("Tidak ditemukan"),
};

export const validate =
  (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(({ path, message }) => ({
        field: path.join("."),
        message,
      }));
      next(new ValidationError("Validasi gagal", errors));
      return;
    }
    req.body = result.data;
    next();
  };

export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof ValidationError) {
    sendError(res, error.code, error.message, error.statusCode, error.errors);
    return;
  }

  if (error instanceof ZodError) {
    const errors = error.issues.map(({ path, message }) => ({
      field: path.join("."),
      message,
    }));
    sendError(res, "VALIDATION_ERROR", "Validasi gagal", 422, errors);
    return;
  }

  if (error instanceof AppError) {
    if (env.NODE_ENV === "development") {
      console.error(`[${error.code}] ${req.method} ${req.path}:`, error.message);
    }
    sendError(res, error.code, error.message, error.statusCode, error.errors);
    return;
  }

  if (error instanceof Error) {
    const mapped = errorMap[error.message];
    if (mapped) {
      if (env.NODE_ENV === "development") {
        console.error(`[${mapped.code}] ${req.method} ${req.path}:`, error.message);
      }
      sendError(res, mapped.code, error.message, mapped.statusCode, mapped.errors);
      return;
    }

    if (env.NODE_ENV === "development") {
      console.error(`[INTERNAL_ERROR] ${req.method} ${req.path}:`, error);
    }
    sendError(res, "INTERNAL_ERROR", "Kesalahan server internal", 500, env.NODE_ENV === "development" ? { name: error.name, message: error.message, stack: error.stack } : undefined);
    return;
  }

  sendError(res, "INTERNAL_ERROR", "Kesalahan server internal", 500);
};