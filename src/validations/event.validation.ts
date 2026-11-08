import { z } from "zod";

export const eventQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().optional(),
    location: z.string().optional(),
    date: z.string().optional(),
    category: z.string().optional(),
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
