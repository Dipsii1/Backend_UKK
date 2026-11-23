import { Router } from "express";
import { PaymentController } from "./payment.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { requireNumericParam } from "../../middlewares/security.middleware.js";

const router = Router();

// Dipanggil server Midtrans: tanpa JWT, keaslian dijamin oleh verifikasi signature_key.
router.post("/midtrans/webhook", PaymentController.midtransWebhook);
router.post("/:orderId", requireNumericParam("orderId"), authenticate, authorize("buyer"), PaymentController.create);

export default router;
