import { z } from "zod";

export const checkInSchema = z.object({
  event_id: z.coerce.bigint().positive(),
  // qr_token diterbitkan sebagai 32 byte acak base64url (43 karakter).
  qr_token: z.string().trim().regex(/^[A-Za-z0-9_-]{43}$/, "Format QR tidak valid"),
});
