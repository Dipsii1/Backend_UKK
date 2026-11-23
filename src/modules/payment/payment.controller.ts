import type { Request } from "express";
import { PaymentService } from "./payment.service.js";
import { midtransNotificationSchema } from "./payment.validation.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { parseSchema } from "../../utils/validation.js";

const paymentService = new PaymentService();

export class PaymentController {
  static create = asyncHandler(async (req: Request, res) => {
    const { created, data } = await paymentService.createTransaction(req.userId!, BigInt(req.params.orderId as string));
    sendSuccess(res, data, created ? "Transaksi pembayaran berhasil dibuat" : "Transaksi pembayaran sudah ada", created ? 201 : 200);
  });

  static midtransWebhook = asyncHandler(async (req, res) => {
    const notification = parseSchema(midtransNotificationSchema, req.body);
    const data = await paymentService.handleNotification(notification);
    sendSuccess(res, data, "Notifikasi pembayaran diproses");
  });
}
