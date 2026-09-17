import type { Response } from "express";

export interface ApiResponse<T = unknown> {
  success: boolean;
  code: string;
  status: number;
  message: string;
  data?: T;
  errors?: unknown;
}

export function sendSuccess<T>(res: Response, data: T, message = "Success", statusCode = 200) {
  const body: ApiResponse<T> = {
    success: true,
    code: "OK",
    status: statusCode,
    message,
    data,
  };
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode = 500,
  errors?: unknown,
) {
  const body: ApiResponse = {
    success: false,
    code,
    status: statusCode,
    message,
    errors,
  };
  res.status(statusCode).json(body);
}
