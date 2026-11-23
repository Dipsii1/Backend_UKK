import type { Request, Response } from "express";
import { PaymentRepository } from "./payment.repository.js";
import { PaymentService, paymentRules } from "./payment.service.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";

const paymentService = new PaymentService(new PaymentRepository(paymentRules));

export class PaymentController {
  static create = asyncHandler(async (req: Request, res: Response) => {
    const orderId = BigInt(req.params.orderId as string);
    const result = await paymentService.createTransaction(req.userId!, orderId);
    if (result.created) {
      sendSuccess(res, result.data, "Transaksi pembayaran berhasil dibuat", 201);
      return;
    }
    sendSuccess(res, result.data, "Transaksi pembayaran sudah ada");
  });

  static midtransWebhook = asyncHandler(async (req: Request, res: Response) => {
    const result = await paymentService.handleNotification(req.body);
    sendSuccess(res, result, "Notifikasi pembayaran diproses");
  });
}
