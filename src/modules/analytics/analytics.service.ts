import { AnalyticsRepository } from "./analytics.repository.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../../utils/app-error.js";
import type { Chart, ChartInterval, ChartQuery, ChartScope, DateRange, KpiValue, OrganizerChartQuery, SalesTotals } from "./analytics.types.js";

export const TIMEZONE = "Asia/Jakarta";
const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;
const TOP_EVENT_LIMIT = 5;
const TICKET_TYPE_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

const ORDER_STATUSES = ["pending", "paid", "expired", "cancelled", "refunded"];
const EVENT_STATUSES = ["draft", "pending_review", "published", "rejected", "ongoing", "completed", "cancelled"];
const TICKET_STATUSES = ["issued", "checked_in", "cancelled", "expired"];

// Aritmetika tanggal kalender YYYY-MM-DD di UTC agar bebas pengaruh zona server.
const toDay = (date: string) => Date.parse(`${date}T00:00:00Z`);
const fromDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (date: string, days: number) => fromDay(toDay(date) + days * DAY_MS);
const daysBetween = (start: string, end: string) => Math.round((toDay(end) - toDay(start)) / DAY_MS) + 1;
const todayLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());

// Awal bucket sama dengan date_trunc PostgreSQL (minggu ISO dimulai Senin).
const truncate = (date: string, interval: ChartInterval) => {
  if (interval === "month") return `${date.slice(0, 7)}-01`;
  if (interval === "week") return addDays(date, -((new Date(toDay(date)).getUTCDay() + 6) % 7));
  return date;
};

const nextBucket = (date: string, interval: ChartInterval) => {
  if (interval === "day") return addDays(date, 1);
  if (interval === "week") return addDays(date, 7);
  const d = new Date(toDay(date));
  return fromDay(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
};

export const buildBuckets = (range: DateRange, interval: ChartInterval) => {
  const buckets: string[] = [];
  for (let bucket = truncate(range.start, interval); bucket <= range.end; bucket = nextBucket(bucket, interval)) {
    buckets.push(bucket);
  }
  return buckets;
};

export const resolveRange = (query: ChartQuery): DateRange => {
  const end = query.end_date ?? todayLocal();
  const start = query.start_date ?? addDays(end, -(DEFAULT_RANGE_DAYS - 1));
  if (start > end) {
    throw new ValidationError("Rentang tanggal tidak valid", [{ field: "end_date", message: "Harus sama atau setelah start_date" }]);
  }
  if (daysBetween(start, end) > MAX_RANGE_DAYS) {
    throw new ValidationError("Rentang tanggal terlalu panjang", [{ field: "start_date", message: `Maksimal ${MAX_RANGE_DAYS} hari` }]);
  }
  return { start, end };
};

// Periode pembanding dengan panjang sama tepat sebelum rentang aktif.
export const previousRange = (range: DateRange): DateRange => {
  const length = daysBetween(range.start, range.end);
  const end = addDays(range.start, -1);
  return { start: addDays(end, -(length - 1)), end };
};

export const changePct = (value: number, previous: number) =>
  previous === 0 ? null : Math.round(((value - previous) / previous) * 10000) / 100;

const kpi = (current: SalesTotals, previous: SalesTotals) => {
  const make = (key: keyof SalesTotals): KpiValue => ({ value: current[key], previous: previous[key], change_pct: changePct(current[key], previous[key]) });
  return { gross_sales: make("gross_sales"), tickets_sold: make("tickets_sold"), paid_orders: make("paid_orders") };
};

const donut = (statuses: string[], rows: { status: string; total: number }[], name: string): Chart => {
  const totals = new Map(rows.map((row) => [row.status, row.total]));
  return { type: "donut", labels: statuses, series: [{ key: "total", name, unit: "count", data: statuses.map((status) => totals.get(status) ?? 0) }] };
};

export class AnalyticsService {
  constructor(private readonly analyticsRepo: AnalyticsRepository = new AnalyticsRepository()) {}

  private async salesCharts(scope: ChartScope, query: ChartQuery) {
    const range = resolveRange(query);
    const buckets = buildBuckets(range, query.interval);
    const [trend, previous, topEvents, orderStatus] = await Promise.all([
      this.analyticsRepo.salesTrend(scope, range, query.interval),
      this.analyticsRepo.salesTotals(scope, previousRange(range)),
      this.analyticsRepo.topEvents(scope, range, TOP_EVENT_LIMIT),
      this.analyticsRepo.orderStatus(scope, range),
    ]);

    const byBucket = new Map(trend.map((row) => [row.bucket, row]));
    const current = trend.reduce<SalesTotals>(
      (total, row) => ({ gross_sales: total.gross_sales + row.gross_sales, tickets_sold: total.tickets_sold + row.tickets_sold, paid_orders: total.paid_orders + row.paid_orders }),
      { gross_sales: 0, tickets_sold: 0, paid_orders: 0 },
    );

    return {
      range,
      buckets,
      meta: {
        start_date: range.start,
        end_date: range.end,
        interval: query.interval,
        timezone: TIMEZONE,
        currency: "IDR",
        previous_period: previousRange(range),
        generated_at: new Date().toISOString(),
      },
      summary: kpi(current, previous),
      charts: {
        sales_trend: {
          type: "line",
          labels: buckets,
          series: [
            { key: "gross_sales", name: "Penjualan kotor", unit: "IDR", data: buckets.map((bucket) => byBucket.get(bucket)?.gross_sales ?? 0) },
            { key: "tickets_sold", name: "Tiket terjual", unit: "count", data: buckets.map((bucket) => byBucket.get(bucket)?.tickets_sold ?? 0) },
            { key: "paid_orders", name: "Order dibayar", unit: "count", data: buckets.map((bucket) => byBucket.get(bucket)?.paid_orders ?? 0) },
          ],
        } satisfies Chart,
        order_status: donut(ORDER_STATUSES, orderStatus, "Order"),
        top_events: {
          type: "bar",
          labels: topEvents.map((event) => event.title),
          series: [
            { key: "gross_sales", name: "Penjualan kotor", unit: "IDR", data: topEvents.map((event) => event.gross_sales) },
            { key: "tickets_sold", name: "Tiket terjual", unit: "count", data: topEvents.map((event) => event.tickets_sold) },
          ],
        } satisfies Chart,
      },
    };
  }

  async getAdminCharts(query: ChartQuery) {
    const { range, buckets, meta, summary, charts } = await this.salesCharts({}, query);
    const [growth, eventStatus] = await Promise.all([
      this.analyticsRepo.userGrowth(range, query.interval),
      this.analyticsRepo.eventStatus({}),
    ]);
    const growthOf = (role: string) => buckets.map((bucket) => growth.find((row) => row.bucket === bucket && row.role === role)?.total ?? 0);

    return {
      meta,
      summary,
      charts: {
        ...charts,
        user_growth: {
          type: "bar",
          labels: buckets,
          series: [
            { key: "buyer", name: "Buyer baru", unit: "count", data: growthOf("buyer") },
            { key: "organizer", name: "Organizer baru", unit: "count", data: growthOf("organizer") },
          ],
        } satisfies Chart,
        event_status: donut(EVENT_STATUSES, eventStatus.map((row) => ({ status: row.status, total: row._count._all })), "Event"),
      },
    };
  }

  async getOrganizerCharts(userId: bigint, query: OrganizerChartQuery) {
    const organizer = await this.analyticsRepo.findOrganizerByOwnerId(userId);
    if (!organizer) throw new ForbiddenError("Akun ini belum terdaftar sebagai organizer");
    if (query.event_id && !(await this.analyticsRepo.findEventByIdAndOrganizer(query.event_id, organizer.id))) {
      throw new NotFoundError("Festival tidak ditemukan");
    }

    const scope: ChartScope = { organizerId: organizer.id, eventId: query.event_id };
    const [{ meta, summary, charts }, ticketTypes, checkIn, eventStatus] = await Promise.all([
      this.salesCharts(scope, query),
      this.analyticsRepo.ticketTypeSales(scope, TICKET_TYPE_LIMIT),
      this.analyticsRepo.ticketCheckIn(scope),
      this.analyticsRepo.eventStatus(scope),
    ]);

    return {
      meta: { ...meta, event_id: query.event_id ?? null },
      summary,
      charts: {
        ...charts,
        // Snapshot terkini (tidak dibatasi rentang tanggal).
        ticket_type_sales: {
          type: "bar",
          labels: ticketTypes.map((ticket) => (query.event_id ? ticket.name : `${ticket.event.title} - ${ticket.name}`)),
          series: [
            { key: "sold", name: "Terjual", unit: "count", data: ticketTypes.map((ticket) => ticket.sold) },
            { key: "available", name: "Tersisa", unit: "count", data: ticketTypes.map((ticket) => Math.max(ticket.quota - ticket.sold, 0)) },
          ],
        } satisfies Chart,
        check_in: donut(TICKET_STATUSES, checkIn.map((row) => ({ status: row.status, total: row._count._all })), "E-ticket"),
        event_status: donut(EVENT_STATUSES, eventStatus.map((row) => ({ status: row.status, total: row._count._all })), "Event"),
      },
    };
  }
}
