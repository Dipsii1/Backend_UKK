import type { Request, Response } from "express";
import { EventService } from "./event.service.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ValidationError } from "../../utils/app-error.js";
import { eventQuerySchema } from "./event.validation.js";

const eventService = new EventService();

export class EventController {
  static getAll = asyncHandler(async (req: Request, res: Response) => {
    const result = eventQuerySchema.safeParse(req.query);
    if (!result.success) {
      const errors = result.error.issues.map(({ path, message }) => ({
        field: path.join("."),
        message,
      }));
      throw new ValidationError("Validasi gagal", errors);
    }

    const data = await eventService.getEvents(result.data);
    sendSuccess(res, data, "Daftar event berhasil diambil");
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const event = await eventService.getEventById(id);
    sendSuccess(res, event, "Detail event berhasil diambil");
  });
}
