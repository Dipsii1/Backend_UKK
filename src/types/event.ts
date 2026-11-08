export type EventQuery = {
  page: number;
  limit: number;
  search?: string;
  location?: string;
  date?: string;
  category?: string;
  min_price?: number;
  max_price?: number;
};

export type TicketTypeOutput = {
  id: bigint;
  public_id: string;
  name: string;
  description: string | null;
  price: number;
  quota: number;
  sold: number;
  max_purchase: number;
  sale_start_at: Date | null;
  sale_end_at: Date | null;
  status: string;
};

export type EventItem = {
  id: bigint;
  public_id: string;
  title: string;
  slug: string;
  summary: string | null;
  banner: string | null;
  thumbnail: string | null;
  start_at: Date;
  end_at: Date;
  is_featured: boolean;
  created_at: Date;
  category: {
    id: bigint;
    public_id: string;
    name: string;
    slug: string;
  };
  venue: {
    id: bigint;
    public_id: string;
    name: string;
    slug: string;
    address: string | null;
    city: { id: bigint; name: string };
  };
  ticketTypes: TicketTypeOutput[];
};

export type EventListResult = {
  data: EventItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type EventDetail = EventItem & {
  description: string | null;
  poster: string | null;
  minimum_age: number | null;
  dress_code: string | null;
  gate_open_at: Date | null;
  sales_start_at: Date | null;
  sales_end_at: Date | null;
  status: string;
  is_published: boolean;
  updated_at: Date | null;
  venue: EventItem["venue"] & {
    image: string | null;
    latitude: number | null;
    longitude: number | null;
    google_maps_url: string | null;
    capacity: number | null;
    is_active: boolean;
    city: EventItem["venue"]["city"] & {
      code: string | null;
      province: { id: bigint; code: string | null; name: string };
    };
  };
};
