import { z } from "zod";

// Field yang dipakai untuk verifikasi; field lain dari Midtrans tetap disimpan apa adanya di payment_logs.
export const midtransNotificationSchema = z.looseObject({
  order_id: z.string().min(1).max(100),
  status_code: z.string().regex(/^\d{3}$/),
  gross_amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  signature_key: z.string().regex(/^[a-fA-F0-9]{128}$/),
  transaction_status: z.string().min(1).max(50),
  fraud_status: z.string().max(50).optional(),
  transaction_id: z.string().max(100).optional(),
  payment_type: z.string().max(50).optional(),
});
