import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodType } from "zod";
import { sendError } from "../utils/api-response.js";

export const validate = (schema: ZodType) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(({ path, message }) => ({ field: path.join("."), message }));
      sendError(res, "Validation failed", 422, errors);
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
  if (error instanceof ZodError) {
    sendError(res, "Validation failed", 422, error.issues);
    return;
  }

  if (error instanceof Error) {
    const statusCode = error.message === "EMAIL_EXISTS" ? 409
      : error.message === "INVALID_CREDENTIALS" || error.message === "INVALID_TOKEN" ? 401
      : error.message === "ACCOUNT_SUSPENDED" ? 403
      : error.message === "NOT_FOUND" ? 404
      : 500;
    sendError(res, statusCode === 500 ? "Internal server error" : error.message, statusCode);
    return;
  }

  sendError(res, "Internal server error");
};
