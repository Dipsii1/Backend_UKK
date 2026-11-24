import { describe, expect, it, vi } from "vitest";
import { AnalyticsService, buildBuckets, changePct, previousRange, resolveRange } from "../src/modules/analytics/analytics.service.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../src/utils/app-error.js";

describe("analytics date helpers", () => {
  it("builds zero-fill buckets aligned with PostgreSQL date_trunc", () => {
    expect(buildBuckets({ start: "2026-11-29", end: "2026-12-01" }, "day")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01"]);
    // 2026-11-25 = Rabu -> minggu dimulai Senin 2026-11-23.
    expect(buildBuckets({ start: "2026-11-25", end: "2026-12-07" }, "week")).toEqual(["2026-11-23", "2026-11-30", "2026-12-07"]);
    expect(buildBuckets({ start: "2026-11-15", end: "2027-01-02" }, "month")).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
  });

  it("resolves default and validates ranges", () => {
    expect(resolveRange({ interval: "day", end_date: "2026-11-30" })).toEqual({ start: "2026-11-01", end: "2026-11-30" });
    expect(() => resolveRange({ interval: "day", start_date: "2026-12-02", end_date: "2026-12-01" })).toThrow(ValidationError);
    expect(() => resolveRange({ interval: "day", start_date: "2025-01-01", end_date: "2026-12-01" })).toThrow(ValidationError);
    expect(resolveRange({ interval: "day" }).end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("computes previous period and change percentage", () => {
    expect(previousRange({ start: "2026-11-11", end: "2026-11-20" })).toEqual({ start: "2026-11-01", end: "2026-11-10" });
    expect(changePct(150, 100)).toBe(50);
    expect(changePct(1, 3)).toBe(-66.67);
    expect(changePct(10, 0)).toBeNull();
  });
});

describe("AnalyticsService", () => {
  const make = (overrides: Record<string, unknown> = {}) => {
    const repository = {
      findOrganizerByOwnerId: vi.fn().mockResolvedValue({ id: 9n }),
      findEventByIdAndOrganizer: vi.fn().mockResolvedValue({ id: 5n, title: "Festival" }),
      salesTrend: vi.fn().mockResolvedValue([{ bucket: "2026-11-02", gross_sales: 300000, tickets_sold: 3, paid_orders: 2 }]),
      salesTotals: vi.fn().mockResolvedValue({ gross_sales: 200000, tickets_sold: 2, paid_orders: 2 }),
      topEvents: vi.fn().mockResolvedValue([{ event_id: 5n, title: "Festival", gross_sales: 300000, tickets_sold: 3 }]),
      orderStatus: vi.fn().mockResolvedValue([{ status: "paid", total: 2 }]),
      userGrowth: vi.fn().mockResolvedValue([{ bucket: "2026-11-01", role: "buyer", total: 4 }]),
      eventStatus: vi.fn().mockResolvedValue([{ status: "published", _count: { _all: 1 } }]),
      ticketTypeSales: vi.fn().mockResolvedValue([{ name: "VIP", quota: 10, sold: 12, event: { title: "Festival" } }]),
      ticketCheckIn: vi.fn().mockResolvedValue([{ status: "checked_in", _count: { _all: 1 } }]),
      ...overrides,
    };
    return { repository, service: new AnalyticsService(repository as never) };
  };
  const query = { interval: "day" as const, start_date: "2026-11-01", end_date: "2026-11-03" };

  it("returns zero-filled admin charts with KPI comparison", async () => {
    const { service, repository } = make();
    const result = await service.getAdminCharts(query);

    expect(repository.salesTrend).toHaveBeenCalledWith({}, { start: "2026-11-01", end: "2026-11-03" }, "day");
    expect(repository.salesTotals).toHaveBeenCalledWith({}, { start: "2026-10-29", end: "2026-10-31" });
    expect(result.summary.gross_sales).toEqual({ value: 300000, previous: 200000, change_pct: 50 });
    expect(result.charts.sales_trend.labels).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(result.charts.sales_trend.series[0].data).toEqual([0, 300000, 0]);
    expect(result.charts.order_status.series[0].data).toEqual([0, 2, 0, 0, 0]);
    expect(result.charts.user_growth.series.map((series) => series.data)).toEqual([[4, 0, 0], [0, 0, 0]]);
    expect(result.charts.event_status.series[0].data[2]).toBe(1);
  });

  it("scopes organizer charts to owned events", async () => {
    const { service, repository } = make();
    const result = await service.getOrganizerCharts(3n, { ...query, event_id: 5n });

    expect(repository.findEventByIdAndOrganizer).toHaveBeenCalledWith(5n, 9n);
    expect(repository.salesTrend).toHaveBeenCalledWith({ organizerId: 9n, eventId: 5n }, expect.anything(), "day");
    expect(result.meta.event_id).toBe(5n);
    expect(result.charts.ticket_type_sales).toMatchObject({ labels: ["VIP"], series: [{ data: [12] }, { data: [0] }] });
    expect(result.charts.check_in.series[0].data).toEqual([0, 1, 0, 0]);

    const all = await make().service.getOrganizerCharts(3n, query);
    expect(all.charts.ticket_type_sales.labels).toEqual(["Festival - VIP"]);
    expect(all.meta.event_id).toBeNull();
  });

  it("rejects non-organizer and foreign events", async () => {
    await expect(make({ findOrganizerByOwnerId: vi.fn().mockResolvedValue(null) }).service.getOrganizerCharts(3n, query)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(make({ findEventByIdAndOrganizer: vi.fn().mockResolvedValue(null) }).service.getOrganizerCharts(3n, { ...query, event_id: 99n })).rejects.toBeInstanceOf(NotFoundError);
  });
});
