import { z } from "zod";

export const checkInSchema = z.object({
  event_id: z.coerce.bigint().positive(),
  qr_token: z.string().trim().min(1).max(200),
});
