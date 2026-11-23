import { z } from "zod";

export const updateUserSchema = z
  .object({
    email: z.string().email().max(255).transform((email) => email.toLowerCase()).optional(),
    role_id: z.coerce.bigint().positive().optional(),
  })
  .strict();

export const updateUserProfileSchema = z
  .object({
    full_name: z.string().trim().min(2).max(100),
  })
  .strict();
