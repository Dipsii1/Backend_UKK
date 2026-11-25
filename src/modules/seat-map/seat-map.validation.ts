import { z } from "zod";

const coordinate = z.coerce.number().int().min(0).max(100_000);
export const SEAT_SHAPE_TYPES = ["stage", "standing", "entrance", "exit", "booth", "toilet", "bar", "text", "rect", "circle"] as const;
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
  // Elemen non-kursi (panggung, pintu, fasilitas); opsional agar klien lama tetap valid.
  shapes: z
    .array(
      z.object({
        type: z.enum(SEAT_SHAPE_TYPES),
        label: z.string().trim().max(100).optional(),
        x: coordinate,
        y: coordinate,
        width: size,
        height: size,
        rotation: z.coerce.number().int().min(-360).max(360).default(0),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Warna harus berformat #RRGGBB").optional(),
      }),
    )
    .max(500)
    .default([]),
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
