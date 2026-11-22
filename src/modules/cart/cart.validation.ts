import { z } from "zod";

export const cartItemSchema = z.object({
  ticket_type_id: z.coerce.bigint().positive(),
  quantity: z.coerce.number().int().min(1).max(100),
});

export const checkoutSchema = z.object({
  voucher_code: z.string().trim().min(1).max(100).optional(),
});
