import { Router } from "express";
import { PaymentController } from "./payment.controller.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import { validate } from "../../middlewares/error.middleware.js";
import { requireNumericParam } from "../../middlewares/security.middleware.js";
import { midtransNotificationSchema } from "./payment.validation.js";

const router = Router();

// Public webhook - dipanggil server Midtrans, keaslian dijamin oleh verifikasi signature_key
router.post("/midtrans/webhook", validate(midtransNotificationSchema), PaymentController.midtransWebhook);

// Buyer only
router.use(authenticate, authorize("buyer"));
router.post("/:orderId", requireNumericParam("orderId"), PaymentController.create);

export default router;
