import type { Request, Response } from "express";
import { EventRepository } from "./event.repository.js";
import { EventService } from "./event.service.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { parseSchema } from "../../utils/validation.js";
import { eventQuerySchema } from "./event.validation.js";

const eventService = new EventService(new EventRepository());

export class EventController {
  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const data = await eventService.getEvents(parseSchema(eventQuerySchema, req.query));
    sendSuccess(res, data, "Daftar event berhasil diambil");
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const event = await eventService.getEventById(id);
    sendSuccess(res, event, "Detail event berhasil diambil");
  });
}
