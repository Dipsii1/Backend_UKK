import type { Response } from "express";

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
}

export function sendSuccess<T>(res: Response, data: T, message = "Success", statusCode = 200) {
  const body: ApiResponse<T> = { success: true, message, data };
  res.status(statusCode).json(body);
}

export function sendError(res: Response, message: string, statusCode = 500, errors?: unknown) {
  const body: ApiResponse = { success: false, message, errors };
  res.status(statusCode).json(body);
}
