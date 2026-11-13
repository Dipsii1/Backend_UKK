import { z } from "zod";

const optionalString = z.string().trim().min(1).optional();
const optionalDate = z.coerce.date().optional();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const eventCreateSchema = z.object({
  category_id: z.coerce.bigint().positive(),
  venue_id: z.coerce.bigint().positive(),
  title: z.string().trim().min(1).max(255),
  slug: z.string().trim().min(1).max(255),
  summary: optionalString,
  description: optionalString,
  banner: z.string().url().optional(),
  thumbnail: z.string().url().optional(),
  poster: z.string().url().optional(),
  minimum_age: z.coerce.number().int().nonnegative().optional(),
  dress_code: optionalString,
  gate_open_at: optionalDate,
  start_at: z.coerce.date(),
  end_at: z.coerce.date(),
  sales_start_at: optionalDate,
  sales_end_at: optionalDate,
});

export const eventUpdateSchema = eventCreateSchema.partial();

export const ticketCreateSchema = z.object({
  event_id: z.coerce.bigint().positive(),
  name: z.string().trim().min(1).max(255),
  description: optionalString,
  price: z.coerce.number().nonnegative(),
  quota: z.coerce.number().int().nonnegative(),
  max_purchase: z.coerce.number().int().positive().max(100).optional(),
  sale_start_at: optionalDate,
  sale_end_at: optionalDate,
  status: z.enum(["active", "sold_out", "inactive"]).optional(),
});

export const ticketUpdateSchema = ticketCreateSchema.omit({ event_id: true }).partial();
