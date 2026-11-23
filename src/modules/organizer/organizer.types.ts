export type EventInput = {
  category_id: bigint;
  venue_id: bigint;
  title: string;
  slug: string;
  summary?: string;
  description?: string;
  banner?: string;
  thumbnail?: string;
  poster?: string;
  minimum_age?: number;
  dress_code?: string;
  gate_open_at?: Date;
  start_at: Date;
  end_at: Date;
  sales_start_at?: Date;
  sales_end_at?: Date;
};

export type TicketInput = {
  event_id: bigint;
  name: string;
  description?: string;
  price: number;
  quota: number;
  max_purchase?: number;
  sale_start_at?: Date;
  sale_end_at?: Date;
  status?: "active" | "sold_out" | "inactive";
};
