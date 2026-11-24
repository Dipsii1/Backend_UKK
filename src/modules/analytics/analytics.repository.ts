import { prisma } from "../../lib/prisma.js";
import { Prisma } from "../../generated/prisma/client.js";
import type { ChartInterval, ChartScope, DateRange, SalesBucketRow, SalesTotals } from "./analytics.types.js";

const TIMEZONE = "Asia/Jakarta";

// Kolom timestamp disimpan UTC tanpa zona; konversi ke waktu lokal WIB untuk bucketing.
const toLocal = (column: Prisma.Sql) => Prisma.sql`((${column}) AT TIME ZONE 'UTC' AT TIME ZONE ${TIMEZONE})`;

// Filter rentang tanggal lokal inklusif, tetap memakai indeks kolom (batas dikonversi ke UTC).
const inRange = (column: Prisma.Sql, range: DateRange) => Prisma.sql`
  ${column} >= (${range.start}::date::timestamp AT TIME ZONE ${TIMEZONE} AT TIME ZONE 'UTC')
  AND ${column} < ((${range.end}::date + 1)::timestamp AT TIME ZONE ${TIMEZONE} AT TIME ZONE 'UTC')`;

const bucketOf = (column: Prisma.Sql, interval: ChartInterval) =>
  Prisma.sql`to_char(date_trunc(${interval}, ${toLocal(column)}), 'YYYY-MM-DD')`;

const scopeFilter = (scope: ChartScope) => Prisma.sql`
  ${scope.organizerId ? Prisma.sql`AND e.organizer_id = ${scope.organizerId}` : Prisma.empty}
  ${scope.eventId ? Prisma.sql`AND e.id = ${scope.eventId}` : Prisma.empty}`;

// Item order paid beserta waktu pembayaran (settlement), dibatasi scope event.
const paidItems = (scope: ChartScope, range: DateRange) => Prisma.sql`
  FROM orders o
  CROSS JOIN LATERAL (
    SELECT COALESCE(MAX(pay.paid_at), o.updated_at, o.created_at) AS paid_at
    FROM payments pay
    WHERE pay.order_id = o.id AND pay.status = 'settlement'
  ) p
  JOIN order_items oi ON oi.order_id = o.id
  JOIN ticket_types tt ON tt.id = oi.ticket_type_id
  JOIN events e ON e.id = tt.event_id
  WHERE o.status = 'paid'
    AND ${inRange(Prisma.sql`p.paid_at`, range)}
    ${scopeFilter(scope)}`;

const eventWhere = (scope: ChartScope): Prisma.eventsWhereInput => ({
  ...(scope.organizerId ? { organizer_id: scope.organizerId } : {}),
  ...(scope.eventId ? { id: scope.eventId } : {}),
});

export class AnalyticsRepository {
  async findOrganizerByOwnerId(userId: bigint) {
    return prisma.organizers.findFirst({
      where: { user_id: userId },
      select: { id: true },
    });
  }

  async findEventByIdAndOrganizer(eventId: bigint, organizerId: bigint) {
    return prisma.events.findFirst({
      where: { id: eventId, organizer_id: organizerId },
      select: { id: true, title: true },
    });
  }

  async salesTrend(scope: ChartScope, range: DateRange, interval: ChartInterval) {
    return prisma.$queryRaw<SalesBucketRow[]>`
      SELECT
        ${bucketOf(Prisma.sql`p.paid_at`, interval)} AS bucket,
        COALESCE(SUM(oi.subtotal), 0)::float8 AS gross_sales,
        COALESCE(SUM(oi.quantity), 0)::int AS tickets_sold,
        COUNT(DISTINCT o.id)::int AS paid_orders
      ${paidItems(scope, range)}
      GROUP BY 1
      ORDER BY 1
    `;
  }

  async salesTotals(scope: ChartScope, range: DateRange) {
    const [row] = await prisma.$queryRaw<SalesTotals[]>`
      SELECT
        COALESCE(SUM(oi.subtotal), 0)::float8 AS gross_sales,
        COALESCE(SUM(oi.quantity), 0)::int AS tickets_sold,
        COUNT(DISTINCT o.id)::int AS paid_orders
      ${paidItems(scope, range)}
    `;
    return row;
  }

  async topEvents(scope: ChartScope, range: DateRange, limit: number) {
    return prisma.$queryRaw<{ event_id: bigint; title: string; gross_sales: number; tickets_sold: number }[]>`
      SELECT
        e.id AS event_id,
        e.title,
        COALESCE(SUM(oi.subtotal), 0)::float8 AS gross_sales,
        COALESCE(SUM(oi.quantity), 0)::int AS tickets_sold
      ${paidItems(scope, range)}
      GROUP BY e.id, e.title
      ORDER BY gross_sales DESC, e.id
      LIMIT ${limit}
    `;
  }

  // Order dibuat dalam rentang, dikelompokkan per status (order dihitung sekali walau berisi banyak item).
  async orderStatus(scope: ChartScope, range: DateRange) {
    return prisma.$queryRaw<{ status: string; total: number }[]>`
      SELECT o.status::text AS status, COUNT(*)::int AS total
      FROM orders o
      WHERE ${inRange(Prisma.sql`o.created_at`, range)}
        AND EXISTS (
          SELECT 1
          FROM order_items oi
          JOIN ticket_types tt ON tt.id = oi.ticket_type_id
          JOIN events e ON e.id = tt.event_id
          WHERE oi.order_id = o.id
            ${scopeFilter(scope)}
        )
      GROUP BY o.status
    `;
  }

  async userGrowth(range: DateRange, interval: ChartInterval) {
    return prisma.$queryRaw<{ bucket: string; role: string; total: number }[]>`
      SELECT
        ${bucketOf(Prisma.sql`u.created_at`, interval)} AS bucket,
        r.name AS role,
        COUNT(*)::int AS total
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE ${inRange(Prisma.sql`u.created_at`, range)}
      GROUP BY 1, 2
      ORDER BY 1
    `;
  }

  async eventStatus(scope: ChartScope) {
    return prisma.events.groupBy({
      by: ["status"],
      where: eventWhere(scope),
      _count: { _all: true },
    });
  }

  async ticketTypeSales(scope: ChartScope, limit: number) {
    return prisma.ticket_types.findMany({
      where: { event: eventWhere(scope) },
      orderBy: [{ sold: "desc" }, { id: "asc" }],
      take: limit,
      select: {
        name: true,
        quota: true,
        sold: true,
        event: { select: { title: true } },
      },
    });
  }

  async ticketCheckIn(scope: ChartScope) {
    return prisma.tickets.groupBy({
      by: ["status"],
      where: { ticketType: { event: eventWhere(scope) } },
      _count: { _all: true },
    });
  }
}
