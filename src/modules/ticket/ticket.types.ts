export type TicketStatusLabel = "UNUSED" | "USED" | "CANCELLED" | "EXPIRED";

export type MyTicket = {
  id: bigint;
  public_id: string;
  ticket_code: string;
  status: TicketStatusLabel;
  checked_in_at: Date | null;
  order: {
    id: bigint;
    order_number: string;
  };
  ticket_type: {
    id: bigint;
    name: string;
  };
  event: {
    id: bigint;
    title: string;
    slug: string;
    gate_open_at: Date | null;
    start_at: Date;
    end_at: Date;
    venue: {
      name: string;
      address: string | null;
    };
  };
  qr_code: string;
};

export type MyTicketListResult = {
  data: MyTicket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
