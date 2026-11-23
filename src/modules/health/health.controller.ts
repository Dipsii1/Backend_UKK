import type { Request, Response } from "express";
import { HealthService } from "./health.service.js";
import { sendError, sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";

const healthService = new HealthService();

export class HealthController {
  static check = asyncHandler(async (_req: Request, res: Response) => {
    const health = await healthService.check();
    if (health.status === "ok") {
      sendSuccess(res, health, "Layanan berjalan normal");
      return;
    }
    sendError(res, "SERVICE_UNAVAILABLE", "Database tidak dapat dijangkau", 503, health);
  });
}
