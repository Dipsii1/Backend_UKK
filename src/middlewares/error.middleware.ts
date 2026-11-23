import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodSchema } from "zod";
import { env } from "../config/env.js";
import { Prisma } from "../generated/prisma/client.js";
import { AppError, ValidationError, ConflictError, NotFoundError } from "../utils/app-error.js";
import { sendError } from "../utils/api-response.js";
import { parseSchema } from "../utils/validation.js";

const prismaErrorMap: Record<string, AppError> = {
  P2002: new ConflictError("Data sudah digunakan"),
  P2003: new ConflictError("Data terkait tidak valid atau masih digunakan"),
  P2025: new NotFoundError("Data tidak ditemukan"),
  P2034: new ConflictError("Terjadi konflik transaksi, silakan coba lagi"),
};

type HttpError = Error & { status?: number; type?: string; expose?: boolean };

export const validate =
  (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = parseSchema(schema, req.body);
      next();
    } catch (error) {
      next(error);
    }
  };

export const notFoundHandler = (_req: Request, res: Response): void => {
  sendError(res, "NOT_FOUND", "Endpoint tidak ditemukan", 404);
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
    sendError(res, "VALIDATION_ERROR", "Validasi gagal", 400, errors);
    return;
  }

  if (error instanceof AppError) {
    if (env.NODE_ENV === "development") {
      console.error(`[${error.code}] ${req.method} ${req.path}:`, error.message);
    }
    sendError(res, error.code, error.message, error.statusCode, error.errors);
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && prismaErrorMap[error.code]) {
    const mapped = prismaErrorMap[error.code];
    sendError(res, mapped.code, mapped.message, mapped.statusCode);
    return;
  }

  if (error instanceof Error) {
    // Error dari body-parser (JSON rusak, body terlalu besar) membawa status 4xx.
    const httpError = error as HttpError;
    if (httpError.type === "entity.parse.failed") {
      sendError(res, "VALIDATION_ERROR", "Format JSON tidak valid", 400);
      return;
    }
    if (httpError.type === "entity.too.large") {
      sendError(res, "PAYLOAD_TOO_LARGE", "Ukuran body terlalu besar", 413);
      return;
    }
    if (httpError.expose && httpError.status && httpError.status >= 400 && httpError.status < 500) {
      sendError(res, "BAD_REQUEST", "Permintaan tidak valid", httpError.status);
      return;
    }

    // Selalu dicatat (termasuk production) agar error tak terduga bisa dilacak; stack hanya dikirim ke client saat development.
    console.error(`[INTERNAL_ERROR] ${req.method} ${req.path}:`, error);
    sendError(res, "INTERNAL_ERROR", "Kesalahan server internal", 500, env.NODE_ENV === "development" ? { name: error.name, message: error.message, stack: error.stack } : undefined);
    return;
  }

  console.error(`[INTERNAL_ERROR] ${req.method} ${req.path}:`, error);
  sendError(res, "INTERNAL_ERROR", "Kesalahan server internal", 500);
};
