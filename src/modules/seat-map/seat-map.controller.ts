import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendSuccess } from "../../utils/api-response.js";
import { parseSchema } from "../../utils/validation.js";
import { SeatMapRepository } from "./seat-map.repository.js";
import { SeatMapService } from "./seat-map.service.js";
import { viewportSchema } from "./seat-map.validation.js";

const seatMapService = new SeatMapService(new SeatMapRepository());

export class SeatMapController {
  static getPublic = asyncHandler(async (req: Request, res: Response) => {
    const eventId = BigInt(req.params.id as string);
    const viewport = parseSchema(viewportSchema, req.query);
    const map = await seatMapService.getPublicMap(eventId, viewport);
    sendSuccess(res, map, "Denah kursi berhasil diambil");
  });

  static getOrganizer = asyncHandler(async (req: Request, res: Response) => {
    const eventId = BigInt(req.params.id as string);
    const map = await seatMapService.getOrganizerMap(req.userId!, eventId);
    sendSuccess(res, map, "Denah editor berhasil diambil");
  });

  static save = asyncHandler(async (req: Request, res: Response) => {
    const eventId = BigInt(req.params.id as string);
    const map = await seatMapService.save(req.userId!, eventId, req.body);
    sendSuccess(res, map, "Denah kursi berhasil disimpan");
  });

  static reserve = asyncHandler(async (req: Request, res: Response) => {
    const seatMapId = BigInt(req.params.id as string);
    const result = await seatMapService.reserve(req.userId!, seatMapId, req.body);
    sendSuccess(res, result, "Kursi berhasil ditahan selama 5 menit", 201);
  });
}
