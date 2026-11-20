import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().max(255).transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(72),
  fullName: z.string().trim().min(2).max(100),
});

export const loginSchema = z.object({
  email: z.string().email().max(255).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(72),
  // Opsional: batasi login ke role tertentu (mis. halaman login admin).
  role: z.enum(["admin", "organizer", "buyer"]).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const resetPasswordRequestSchema = z.object({
  email: z.string().email().max(255).transform((email) => email.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

export const verifyEmailRequestSchema = z.object({
  email: z.string().email().max(255).transform((email) => email.toLowerCase()),
});

export const verifyEmailConfirmSchema = z.object({
  token: z.string().min(1),
});

// Kosongkan field dengan "" atau null; field yang tidak dikirim tidak diubah.
const optionalText = (max: number) =>
  z
    .union([z.string().trim().max(max), z.null()])
    .optional()
    .transform((value) => (value === "" ? null : value));

export const updateProfileSchema = z
  .object({
    full_name: z.string().trim().min(2).max(100).optional(),
    phone: z
      .union([z.string().trim().regex(/^(\+62|62|0)8[0-9]{7,12}$/, "Nomor telepon tidak valid"), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value === "" ? null : value)),
    gender: z.enum(["male", "female", "other"]).nullable().optional(),
    birth_date: z
      .union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value ? new Date(`${value}T00:00:00.000Z`) : value === undefined ? undefined : null))
      .refine((date) => !date || (!Number.isNaN(date.getTime()) && date <= new Date()), "Tanggal lahir tidak valid"),
    address: optionalText(500),
  })
  .strict();
