import type { NextFunction, Request, Response } from "express";

const color = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

const statusColor = (status: number): string => {
  if (status >= 500) return color.red;
  if (status >= 400) return color.yellow;
  if (status >= 300) return color.cyan;
  return color.green;
};

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startedAt = process.hrtime.bigint();
  const timestamp = new Date().toISOString();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const status = res.statusCode;
    const line =
      `${color.gray}${timestamp}${color.reset} ` +
      `${color.cyan}${req.method}${color.reset} ` +
      `${req.originalUrl} ` +
      `${statusColor(status)}${status}${color.reset} ` +
      `${color.gray}${durationMs.toFixed(1)}ms${color.reset}`;

    console.log(line);
  });

  next();
};
