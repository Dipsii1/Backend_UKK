export type ChartInterval = "day" | "week" | "month";

export type ChartQuery = {
  start_date?: string;
  end_date?: string;
  interval: ChartInterval;
};

export type OrganizerChartQuery = ChartQuery & {
  event_id?: bigint;
};

// Rentang tanggal lokal (WIB) inklusif, format YYYY-MM-DD.
export type DateRange = {
  start: string;
  end: string;
};

// Batas data chart: null = seluruh sistem (admin).
export type ChartScope = {
  organizerId?: bigint;
  eventId?: bigint;
};

export type ChartSeries = {
  key: string;
  name: string;
  unit: "IDR" | "count";
  data: number[];
};

export type Chart = {
  type: "line" | "bar" | "donut";
  labels: string[];
  series: ChartSeries[];
};

export type KpiValue = {
  value: number;
  previous: number;
  change_pct: number | null;
};

export type SalesBucketRow = {
  bucket: string;
  gross_sales: number;
  tickets_sold: number;
  paid_orders: number;
};

export type SalesTotals = Omit<SalesBucketRow, "bucket">;
