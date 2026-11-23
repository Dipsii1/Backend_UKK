import { z } from "zod";

const coordinate = z.coerce.number().int().min(0).max(100_000);
const size = z.coerce.number().int().positive().max(100_000);

export const seatMapSchema = z.object({
  width: size,
  height: size,
  sections: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(100),
        ticket_type_id: z.coerce.bigint().positive().optional(),
        x: coordinate,
        y: coordinate,
        width: size,
        height: size,
        sort_order: z.coerce.number().int().min(0).max(10_000).optional(),
      }),
    )
    .max(500),
  seats: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(100),
        section_label: z.string().trim().min(1).max(100).optional(),
        ticket_type_id: z.coerce.bigint().positive().optional(),
        row_label: z.string().trim().min(1).max(30).optional(),
        seat_number: z.coerce.number().int().positive().max(100_000).optional(),
        x: coordinate,
        y: coordinate,
        width: size.optional(),
        height: size.optional(),
        status: z.enum(["available", "blocked"]).optional(),
      }),
    )
    .min(1)
    .max(10_000),
});

export const reserveSeatsSchema = z.object({
  seat_ids: z
    .array(z.coerce.bigint().positive())
    .min(1)
    .max(20)
    .refine((ids) => new Set(ids.map(String)).size === ids.length, "Kursi duplikat"),
});

export const viewportSchema = z.object({
  x: coordinate.optional(),
  y: coordinate.optional(),
  width: size.optional(),
  height: size.optional(),
}).refine(
  (value) =>
    (value.width === undefined && value.height === undefined) ||
    (value.width !== undefined &&
      value.height !== undefined &&
      value.x !== undefined &&
      value.y !== undefined),
  "viewport harus berisi x, y, width, dan height",
);
