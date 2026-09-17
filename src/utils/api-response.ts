import type { Response } from "express";

export interface ApiResponse<T = unknown> {
  success: boolean;
  code: string;
  status: number;
  message: string;
  data?: T;
  errors?: unknown;
}

const json = (res: Response, statusCode: number, body: ApiResponse): void => {
  res.status(statusCode).type("json").send(JSON.stringify(body, (_, value) =>
    typeof value === "bigint" ? value.toString() : value,
  ));
};

export function sendSuccess<T>(res: Response, data: T, message = "Success", statusCode = 200) {
  const body: ApiResponse<T> = {
    success: true,
    code: "OK",
    status: statusCode,
    message,
    data,
  };
  json(res, statusCode, body);
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
  json(res, statusCode, body);
}
