import { OrganizerRepository } from "./organizer.repository.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../utils/app-error.js";

type EventInput = {
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
type TicketInput = {
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

const decimalToNumber = (value: unknown) => {
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return (value as { toNumber(): number }).toNumber();
  }
  return Number(value);
};

export class OrganizerService {
  constructor(private readonly organizerRepo: OrganizerRepository = new OrganizerRepository()) {}

  private async organizerFor(userId: bigint) {
    const organizer = await this.organizerRepo.findByOwnerId(userId);
    if (!organizer) throw new ForbiddenError("Akun ini belum terdaftar sebagai organizer");
    return organizer;
  }

  private validateEventDates(data: Partial<EventInput>) {
    if (data.start_at && data.end_at && data.end_at <= data.start_at) {
      throw new ValidationError("Waktu event tidak valid", [
        { field: "end_at", message: "Harus setelah start_at" },
      ]);
    }
    if (data.sales_start_at && data.sales_end_at && data.sales_end_at <= data.sales_start_at) {
      throw new ValidationError("Periode penjualan tidak valid", [
        { field: "sales_end_at", message: "Harus setelah sales_start_at" },
      ]);
    }
  }

  async listEvents(userId: bigint, page: number, limit: number) {
    const organizer = await this.organizerFor(userId);
    const result = await this.organizerRepo.findEvents(organizer.id, page, limit);
    return { ...result, page, limit, totalPages: Math.ceil(result.total / limit) };
  }

  async getEvent(userId: bigint, eventId: bigint) {
    const organizer = await this.organizerFor(userId);
    const event = await this.organizerRepo.findEventByIdAndOrganizer(eventId, organizer.id);
    if (!event) throw new NotFoundError("Festival tidak ditemukan");
    return event;
  }

  async createEvent(userId: bigint, data: EventInput) {
    const organizer = await this.organizerFor(userId);
    this.validateEventDates(data);
    return this.organizerRepo.createEvent({ ...data, organizer_id: organizer.id });
  }

  async updateEvent(userId: bigint, eventId: bigint, data: Partial<EventInput>) {
    const event = await this.getEvent(userId, eventId);
    this.validateEventDates({
      start_at: data.start_at ?? event.start_at,
      end_at: data.end_at ?? event.end_at,
      sales_start_at: data.sales_start_at ?? event.sales_start_at ?? undefined,
      sales_end_at: data.sales_end_at ?? event.sales_end_at ?? undefined,
    });
    return this.organizerRepo.updateEvent(eventId, data);
  }

  async deleteEvent(userId: bigint, eventId: bigint) {
    const event = await this.getEvent(userId, eventId);
    if (event.ticketTypes.some((ticket) => ticket.sold > 0)) {
      throw new ConflictError("Festival dengan tiket terjual tidak dapat dihapus");
    }
    await this.organizerRepo.deleteEvent(eventId);
  }

  async listTickets(userId: bigint, eventId: bigint) {
    await this.getEvent(userId, eventId);
    const organizer = await this.organizerFor(userId);
    return this.organizerRepo.findTicketsByEvent(eventId, organizer.id);
  }

  private validateTicketDates(data: Partial<TicketInput>) {
    if (data.sale_start_at && data.sale_end_at && data.sale_end_at <= data.sale_start_at) {
      throw new ValidationError("Periode penjualan tiket tidak valid", [
        { field: "sale_end_at", message: "Harus setelah sale_start_at" },
      ]);
    }
  }

  async createTicket(userId: bigint, data: TicketInput) {
    await this.getEvent(userId, data.event_id);
    this.validateTicketDates(data);
    const status = data.quota === 0 ? "sold_out" : (data.status ?? "active");
    return this.organizerRepo.createTicket({ ...data, status });
  }

  async getTicket(userId: bigint, ticketId: bigint) {
    const organizer = await this.organizerFor(userId);
    const ticket = await this.organizerRepo.findTicketByIdAndOrganizer(ticketId, organizer.id);
    if (!ticket) throw new NotFoundError("Tiket tidak ditemukan");
    return ticket;
  }

  async updateTicket(userId: bigint, ticketId: bigint, data: Partial<Omit<TicketInput, "event_id">>) {
    const ticket = await this.getTicket(userId, ticketId);
    this.validateTicketDates({
      sale_start_at: data.sale_start_at ?? ticket.sale_start_at ?? undefined,
      sale_end_at: data.sale_end_at ?? ticket.sale_end_at ?? undefined,
    });
    if (data.quota !== undefined && data.quota < ticket.sold) {
      throw new ConflictError("Kuota tidak boleh lebih kecil dari tiket yang sudah terjual");
    }
    const quota = data.quota ?? ticket.quota;
    const status = quota <= ticket.sold ? "sold_out" : data.status;
    return this.organizerRepo.updateTicket(ticketId, { ...data, ...(status ? { status } : {}) });
  }

  async deleteTicket(userId: bigint, ticketId: bigint) {
    const ticket = await this.getTicket(userId, ticketId);
    if (ticket.sold > 0) {
      throw new ConflictError("Tiket yang sudah terjual tidak dapat dihapus");
    }
    await this.organizerRepo.deleteTicket(ticketId);
  }

  async getSales(userId: bigint, eventId: bigint) {
    const organizer = await this.organizerFor(userId);
    const event = await this.organizerRepo.findSalesByEvent(eventId, organizer.id);
    if (!event) throw new NotFoundError("Festival tidak ditemukan");
    const ticketTypes = event.ticketTypes.map((ticket) => {
      const ticketsSold = ticket.orderItems.reduce((total, item) => total + item.quantity, 0);
      const revenue = ticket.orderItems.reduce((total, item) => total + decimalToNumber(item.subtotal), 0);
      return { id: ticket.id, public_id: ticket.public_id, name: ticket.name, price: decimalToNumber(ticket.price), quota: ticket.quota, sold: ticket.sold, available: Math.max(ticket.quota - ticket.sold, 0), paid_tickets: ticketsSold, revenue, paid_order_ids: ticket.orderItems.map((item) => item.order_id) };
    });
    const orderIds = new Set(ticketTypes.flatMap((ticket) => ticket.paid_order_ids.map(String)));
    return {
      event: { id: event.id, title: event.title },
      summary: { paid_orders: orderIds.size, paid_tickets: ticketTypes.reduce((total, ticket) => total + ticket.paid_tickets, 0), revenue: ticketTypes.reduce((total, ticket) => total + ticket.revenue, 0), quota: ticketTypes.reduce((total, ticket) => total + ticket.quota, 0), sold: ticketTypes.reduce((total, ticket) => total + ticket.sold, 0) },
      ticket_types: ticketTypes.map(({ paid_order_ids, ...ticket }) => ticket),
    };
  }
}
