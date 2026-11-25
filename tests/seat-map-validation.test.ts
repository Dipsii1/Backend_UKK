import { describe, expect, it } from "vitest";
import { seatMapSchema } from "../src/modules/seat-map/seat-map.validation.js";
import { ticketCreateSchema, ticketUpdateSchema } from "../src/modules/organizer/organizer.validation.js";

const base = { width: 800, height: 600, sections: [], seats: [{ label: "A1", x: 10, y: 10 }] };

describe("Seat map shapes and ticket colors", () => {
  it("accepts maps without shapes and defaults them to an empty list", () => {
    expect(seatMapSchema.parse(base).shapes).toEqual([]);
  });

  it("validates shape types, rotation, and colors", () => {
    const parsed = seatMapSchema.parse({ ...base, shapes: [{ type: "stage", label: "Panggung", x: 0, y: 0, width: 400, height: 80, color: "#FF4D00" }] });
    expect(parsed.shapes[0]).toMatchObject({ type: "stage", rotation: 0, color: "#FF4D00" });
    expect(seatMapSchema.safeParse({ ...base, shapes: [{ type: "kolam", x: 0, y: 0, width: 1, height: 1 }] }).success).toBe(false);
    expect(seatMapSchema.safeParse({ ...base, shapes: [{ type: "bar", x: 0, y: 0, width: 1, height: 1, rotation: 400 }] }).success).toBe(false);
    expect(seatMapSchema.safeParse({ ...base, shapes: [{ type: "bar", x: 0, y: 0, width: 1, height: 1, color: "merah" }] }).success).toBe(false);
  });

  it("accepts an optional #RRGGBB ticket color on create and update", () => {
    const ticket = { event_id: "5", name: "CAT 1", price: 100000, quota: 10 };
    expect(ticketCreateSchema.parse({ ...ticket, color: "#8DE2BD" }).color).toBe("#8DE2BD");
    expect(ticketCreateSchema.safeParse({ ...ticket, color: "#FFF" }).success).toBe(false);
    expect(ticketUpdateSchema.parse({ color: "#000000" })).toEqual({ color: "#000000" });
  });
});
