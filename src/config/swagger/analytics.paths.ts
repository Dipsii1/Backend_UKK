const auth = [{ bearerAuth: [] }];

const chart = {
  type: "object",
  properties: {
    type: { type: "string", enum: ["line", "bar", "donut"] },
    labels: { type: "array", items: { type: "string" }, example: ["2026-11-01", "2026-11-02"] },
    series: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string", example: "gross_sales" },
          name: { type: "string", example: "Penjualan kotor" },
          unit: { type: "string", enum: ["IDR", "count"] },
          data: { type: "array", items: { type: "number" }, example: [350000, 0] },
        },
      },
    },
  },
};

const kpi = {
  type: "object",
  properties: {
    value: { type: "number", example: 2200000 },
    previous: { type: "number", example: 1100000 },
    change_pct: { type: "number", nullable: true, example: 100, description: "Persentase perubahan vs periode sebelumnya; null jika periode sebelumnya 0" },
  },
};

const chartResponse = (description: string, charts: string[], extraMeta: object = {}) => ({
  description,
  headers: { "Cache-Control": { schema: { type: "string", example: "private, max-age=60" } } },
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          code: { type: "string", example: "OK" },
          status: { type: "integer", example: 200 },
          message: { type: "string" },
          data: {
            type: "object",
            properties: {
              meta: {
                type: "object",
                properties: {
                  start_date: { type: "string", format: "date" },
                  end_date: { type: "string", format: "date" },
                  interval: { type: "string", enum: ["day", "week", "month"] },
                  timezone: { type: "string", example: "Asia/Jakarta" },
                  currency: { type: "string", example: "IDR" },
                  previous_period: { type: "object", properties: { start: { type: "string", format: "date" }, end: { type: "string", format: "date" } } },
                  generated_at: { type: "string", format: "date-time" },
                  ...extraMeta,
                },
              },
              summary: { type: "object", properties: { gross_sales: kpi, tickets_sold: kpi, paid_orders: kpi } },
              charts: { type: "object", properties: Object.fromEntries(charts.map((name) => [name, chart])) },
            },
          },
        },
      },
    },
  },
});

const error = (description: string) => ({ description });

const rangeParams = [
  { name: "start_date", in: "query", schema: { type: "string", format: "date", example: "2026-11-01" }, description: "Tanggal awal (WIB, inklusif). Default: 29 hari sebelum end_date" },
  { name: "end_date", in: "query", schema: { type: "string", format: "date", example: "2026-11-30" }, description: "Tanggal akhir (WIB, inklusif). Default: hari ini. Rentang maksimal 366 hari" },
  { name: "interval", in: "query", schema: { type: "string", enum: ["day", "week", "month"], default: "day" }, description: "Granularitas bucket (minggu dimulai Senin)" },
];

const description =
  "Semua chart memakai format seragam `{ type, labels, series[{ key, name, unit, data }] }` yang langsung kompatibel dengan Chart.js/ApexCharts/Recharts. " +
  "Bucket time series selalu lengkap (bernilai 0 bila kosong). Penjualan dihitung dari item order `paid` berdasarkan waktu settlement pembayaran (sebelum diskon/biaya).";

export const analyticsPaths = {
  "/admin/dashboard/charts": {
    get: {
      tags: ["Admin"],
      security: auth,
      summary: "Data chart dashboard admin (seluruh sistem)",
      description,
      parameters: rangeParams,
      responses: {
        "200": chartResponse("Data chart admin", ["sales_trend", "order_status", "top_events", "user_growth", "event_status"]),
        "400": error("Parameter tanggal/interval tidak valid"),
        "401": error("Belum login"),
        "403": error("Khusus admin"),
      },
    },
  },
  "/organizer/dashboard/charts": {
    get: {
      tags: ["Organizer"],
      security: auth,
      summary: "Data chart dashboard organizer (event milik sendiri)",
      description: `${description} \`ticket_type_sales\`, \`check_in\`, dan \`event_status\` adalah snapshot terkini (tidak dibatasi rentang tanggal).`,
      parameters: [...rangeParams, { name: "event_id", in: "query", schema: { type: "string", example: "1" }, description: "Batasi chart ke satu event milik organizer" }],
      responses: {
        "200": chartResponse("Data chart organizer", ["sales_trend", "order_status", "top_events", "ticket_type_sales", "check_in", "event_status"], { event_id: { type: "string", nullable: true } }),
        "400": error("Parameter tanggal/interval tidak valid"),
        "401": error("Belum login"),
        "403": error("Bukan organizer"),
        "404": error("Event tidak ditemukan atau bukan milik organizer"),
      },
    },
  },
} as const;
