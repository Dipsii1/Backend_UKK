import type { Request, Response } from "express";
import { NotificationRepository } from "./notification.repository.js";
import { NotificationService } from "./notification.service.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { paginationSchema, parseSchema } from "../../utils/validation.js";

const notificationService = new NotificationService(new NotificationRepository());

export class NotificationController {
  static getMine = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = parseSchema(paginationSchema, req.query);
    const notifications = await notificationService.getMine(req.userId!, page, limit);
    sendSuccess(res, notifications, "Daftar notifikasi berhasil diambil");
  });

  static markRead = asyncHandler(async (req: Request, res: Response) => {
    const notification = await notificationService.markRead(req.userId!, BigInt(req.params.id as string));
    sendSuccess(res, notification, "Notifikasi ditandai sudah dibaca");
  });

  static registerPushToken = asyncHandler(async (req: Request, res: Response) => {
    await notificationService.registerPushToken(req.userId!, req.body.token);
    sendSuccess(res, null, "Push token berhasil didaftarkan", 201);
  });

  static removePushToken = asyncHandler(async (req: Request, res: Response) => {
    await notificationService.removePushToken(req.userId!, req.body.token);
    res.status(204).send();
  });

  static broadcast = asyncHandler(async (req: Request, res: Response) => {
    const result = await notificationService.broadcast(req.userId!, req.body);
    sendSuccess(res, result, "Notifikasi berhasil dikirim", 201);
  });
}
