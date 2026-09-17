import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().max(255).transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(2).max(100),
});

export const loginSchema = z.object({
  email: z.string().email().max(255).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(72),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});
