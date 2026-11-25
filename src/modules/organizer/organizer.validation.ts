import { z } from "zod";
import { EVENT_DOCUMENT_TYPES } from "../../utils/document-storage.js";

const optionalString = z.string().trim().min(1).optional();
const optionalDate = z.coerce.date().optional();

// Venue ditulis organizer saat membuat event; kota dipilih dari master data.
const venueSchema = z.object({
  name: z.string().trim().min(1).max(255),
  address: optionalString,
  city_id: z.coerce.bigint().positive(),
});

export const eventCreateSchema = z.object({
  category_id: z.coerce.bigint().positive(),
  venue: venueSchema,
  title: z.string().trim().min(1).max(255),
  // Opsional: bila kosong, slug dibuat dari judul.
  slug: z.string().trim().min(1).max(255).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug hanya boleh huruf kecil, angka, dan tanda hubung").optional(),
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
  wave: z.coerce.number().int().positive().max(100).optional(),
  sale_start_at: optionalDate,
  sale_end_at: optionalDate,
  status: z.enum(["active", "sold_out", "inactive"]).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Warna harus berformat #RRGGBB").optional(),
});

export const ticketUpdateSchema = ticketCreateSchema.omit({ event_id: true }).partial();

export const eventDocumentParamsSchema = z.object({
  type: z.enum(EVENT_DOCUMENT_TYPES),
});
