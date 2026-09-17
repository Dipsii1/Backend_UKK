import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodSchema } from "zod";
import { env } from "../config/env.js";
import { AppError, ValidationError, InternalServerError } from "../utils/app-error.js";
import { sendError } from "../utils/api-response.js";

export const validate =
  (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(({ path, message }) => ({
        field: path.join("."),
        message,
      }));
      next(new ValidationError("Validation failed", errors));
      return;
    }
    req.body = result.data;
    next();
  };

const knownErrorMap: Record<string, { code: string; status: number }> = {
  EMAIL_EXISTS: { code: "EMAIL_EXISTS", status: 409 },
  INVALID_CREDENTIALS: { code: "INVALID_CREDENTIALS", status: 401 },
  INVALID_TOKEN: { code: "INVALID_TOKEN", status: 401 },
  ACCOUNT_SUSPENDED: { code: "ACCOUNT_SUSPENDED", status: 403 },
  NOT_FOUND: { code: "NOT_FOUND", status: 404 },
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
    sendError(res, "VALIDATION_ERROR", "Validation failed", 422, errors);
    return;
  }

  if (error instanceof AppError) {
    if (env.NODE_ENV === "development") {
      console.error(`[${error.code}] ${req.method} ${req.path}:`, error.message);
    }
    sendError(res, error.code, error.message, error.statusCode, error.errors);
    return;
  }

  // Legacy string errors (from services throwing "EMAIL_EXISTS" etc)
  if (error instanceof Error && error.message in knownErrorMap) {
    const mapped = knownErrorMap[error.message];
    if (env.NODE_ENV === "development") {
      console.error(`[${mapped.code}] ${req.method} ${req.path}:`, error.message);
    }
    sendError(res, mapped.code, error.message, mapped.status);
    return;
  }

  if (error instanceof Error) {
    if (env.NODE_ENV === "development") {
      console.error(`[INTERNAL_ERROR] ${req.method} ${req.path}:`, error);
    }
    sendError(res, "INTERNAL_ERROR", "Internal server error", 500, env.NODE_ENV === "development" ? { name: error.name, message: error.message, stack: error.stack } : undefined);
    return;
  }

  sendError(res, "INTERNAL_ERROR", "Internal server error", 500);
}