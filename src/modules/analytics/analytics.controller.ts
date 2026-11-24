import type { Request, Response } from "express";
import { AnalyticsRepository } from "./analytics.repository.js";
import { AnalyticsService } from "./analytics.service.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { parseSchema } from "../../utils/validation.js";
import { chartQuerySchema, organizerChartQuerySchema } from "./analytics.validation.js";

const analyticsService = new AnalyticsService(new AnalyticsRepository());

// Data dashboard boleh di-cache singkat oleh browser pemilik token, tidak oleh proxy bersama.
const CACHE_CONTROL = "private, max-age=60";

export class AnalyticsController {
  static getAdminCharts = asyncHandler(async (req: Request, res: Response) => {
    const query = parseSchema(chartQuerySchema, req.query);
    const charts = await analyticsService.getAdminCharts(query);
    res.set("Cache-Control", CACHE_CONTROL);
    sendSuccess(res, charts, "Chart dashboard admin berhasil diambil");
  });

  static getOrganizerCharts = asyncHandler(async (req: Request, res: Response) => {
    const query = parseSchema(organizerChartQuerySchema, req.query);
    const charts = await analyticsService.getOrganizerCharts(req.userId!, query);
    res.set("Cache-Control", CACHE_CONTROL);
    sendSuccess(res, charts, "Chart dashboard organizer berhasil diambil");
  });
}
