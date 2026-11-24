import { z } from "zod";

export const chartQuerySchema = z.object({
  start_date: z.iso.date().optional(),
  end_date: z.iso.date().optional(),
  interval: z.enum(["day", "week", "month"]).default("day"),
});

export const organizerChartQuerySchema = chartQuerySchema.extend({
  event_id: z.coerce.bigint().positive().optional(),
});
