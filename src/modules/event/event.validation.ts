import { z } from "zod";

export const eventQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(255).optional(),
    location: z.string().trim().max(255).optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD")
      .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()), "Tanggal tidak valid")
      .optional(),
    category: z.string().trim().max(255).optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    min_price: z.coerce.number().nonnegative().optional(),
    max_price: z.coerce.number().nonnegative().optional(),
  })
  .transform((data) => ({
    page: data.page,
    limit: data.limit,
    search: data.search,
    location: data.location,
    date: data.date,
    category: data.category,
    min_price: data.minPrice ?? data.min_price ?? undefined,
    max_price: data.maxPrice ?? data.max_price ?? undefined,
  }));

export type EventQueryInput = z.infer<typeof eventQuerySchema>;
