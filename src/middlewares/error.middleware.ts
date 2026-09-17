import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { AppError, ValidationError } from "../utils/app-error.js";
import { sendError } from "../utils/api-response.js";

export const validate =
  (schema: import("zod").ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
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

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (error instanceof ValidationError) {
    sendError(res, error.message, error.statusCode, error.errors);
    return;
  }

  if (error instanceof ZodError) {
    const errors = error.issues.map(({ path, message }) => ({
      field: path.join("."),
      message,
    }));
    sendError(res, "Validation failed", 422, errors);
    return;
  }

  if (error instanceof AppError) {
    sendError(res, error.message, error.statusCode);
    return;
  }

  if (error instanceof Error) {
    sendError(res, "Internal server error", 500);
    return;
  }

  sendError(res, "Internal server error", 500);
};