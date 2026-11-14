import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const userQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(255).optional(),
  role: z.string().trim().min(1).max(100).optional(),
  is_active: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
});

export const organizerQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(255).optional(),
  status: z.enum(["pending", "verified", "rejected", "suspended"]).optional(),
});

export const transactionLogQuerySchema = paginationSchema.extend({
  status: z.enum(["pending", "paid", "expired", "cancelled", "refunded"]).optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
});

export const userStatusSchema = z.object({ is_active: z.boolean() });
export const organizerStatusSchema = z.object({
  status: z.enum(["pending", "verified", "rejected", "suspended"]),
});
