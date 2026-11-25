import { OrganizerRepository } from "./organizer.repository.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../utils/app-error.js";
import type { EventDocumentType, EventInput, TicketInput } from "./organizer.types.js";
import { toNumber } from "../../utils/currency.js";
import { documentStorage, EVENT_DOCUMENT_TYPES, type DocumentFile } from "../../utils/document-storage.js";

// Event hanya bisa diubah strukturnya sebelum diajukan / setelah ditolak.
const EDITABLE_EVENT_STATUSES = ["draft", "rejected"];

export class OrganizerService {
  constructor(private readonly organizerRepo: OrganizerRepository = new OrganizerRepository()) {}

  private async organizerFor(userId: bigint, requireVerified = false) {
    const organizer = await this.organizerRepo.findByOwnerId(userId);
    if (!organizer) throw new ForbiddenError("Akun ini belum terdaftar sebagai organizer");
    if (requireVerified && organizer.status !== "verified") {
      throw new ForbiddenError("Organizer belum diverifikasi admin");
    }
    return organizer;
  }

  private async editableEvent(userId: bigint, eventId: bigint) {
    const organizer = await this.organizerFor(userId, true);
    const event = await this.organizerRepo.findEventByIdAndOrganizer(eventId, organizer.id);
    if (!event) throw new NotFoundError("Festival tidak ditemukan");
    return event;
  }

  private assertEditable(status: string) {
    if (!EDITABLE_EVENT_STATUSES.includes(status)) {
      throw new ConflictError("Festival yang sudah diajukan atau dipublikasikan tidak dapat diubah");
    }
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
    const organizer = await this.organizerFor(userId, true);
    this.validateEventDates(data);
    return this.organizerRepo.createEvent({ ...data, organizer_id: organizer.id });
  }

  async updateEvent(userId: bigint, eventId: bigint, data: Partial<EventInput>) {
    const event = await this.editableEvent(userId, eventId);
    this.assertEditable(event.status);
    this.validateEventDates({
      start_at: data.start_at ?? event.start_at,
      end_at: data.end_at ?? event.end_at,
      sales_start_at: data.sales_start_at ?? event.sales_start_at ?? undefined,
      sales_end_at: data.sales_end_at ?? event.sales_end_at ?? undefined,
    });
    return this.organizerRepo.updateEvent(eventId, data);
  }

  async deleteEvent(userId: bigint, eventId: bigint) {
    const event = await this.editableEvent(userId, eventId);
    if (event.ticketTypes.some((ticket) => ticket.sold > 0)) {
      throw new ConflictError("Festival dengan tiket terjual tidak dapat dihapus");
    }
    if ((await this.organizerRepo.countOrderItemsByEvent(eventId)) > 0) {
      throw new ConflictError("Festival yang sudah memiliki order tidak dapat dihapus");
    }
    await this.organizerRepo.deleteEvent(eventId);
  }

  async submitEvent(userId: bigint, eventId: bigint) {
    const event = await this.editableEvent(userId, eventId);
    this.assertEditable(event.status);
    if (event.ticketTypes.length === 0) {
      throw new ConflictError("Festival harus memiliki minimal satu tipe tiket sebelum diajukan");
    }
    const uploaded = new Set((await this.organizerRepo.findEventDocuments(eventId)).map((document) => document.type));
    const missing = EVENT_DOCUMENT_TYPES.filter((type) => !uploaded.has(type));
    if (missing.length > 0) {
      throw new ConflictError(`Berkas verifikasi festival belum lengkap: ${missing.join(", ")}`);
    }
    return this.organizerRepo.updateEvent(eventId, { status: "pending_review", rejected_reason: null });
  }

  async listEventDocuments(userId: bigint, eventId: bigint) {
    await this.getEvent(userId, eventId);
    const documents = await this.organizerRepo.findEventDocuments(eventId);
    return documents.map(documentStorage.toOutput);
  }

  async uploadEventDocument(userId: bigint, eventId: bigint, type: EventDocumentType, file: DocumentFile) {
    const event = await this.editableEvent(userId, eventId);
    this.assertEditable(event.status);
    const previous = await this.organizerRepo.findEventDocument(eventId, type);
    const stored = await documentStorage.upload(file, "event-documents");
    const document = await this.organizerRepo.upsertEventDocument(eventId, type, stored).catch(async (error: unknown) => {
      await documentStorage.remove(stored.storage_key).catch(() => undefined);
      throw error;
    });
    // shortcut: file lama dihapus best-effort; bila gagal tertinggal di Cloudinary. Tambah job cleanup bila volume besar.
    if (previous) await documentStorage.remove(previous.storage_key).catch(() => undefined);
    return documentStorage.toOutput(document);
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
    const event = await this.editableEvent(userId, data.event_id);
    // Event published boleh ditambah tiket gelombang baru selama event belum berakhir.
    if (event.status === "published") {
      if (event.end_at <= new Date()) throw new ConflictError("Festival sudah berakhir");
    } else {
      this.assertEditable(event.status);
    }
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

  private async ownedTicket(userId: bigint, ticketId: bigint) {
    const organizer = await this.organizerFor(userId, true);
    const ticket = await this.organizerRepo.findTicketByIdAndOrganizer(ticketId, organizer.id);
    if (!ticket) throw new NotFoundError("Tiket tidak ditemukan");
    return ticket;
  }

  async updateTicket(userId: bigint, ticketId: bigint, data: Partial<Omit<TicketInput, "event_id">>) {
    const ticket = await this.ownedTicket(userId, ticketId);
    // Kuota/status boleh diubah kapan saja; harga dikunci setelah event diajukan.
    if (data.price !== undefined) this.assertEditable(ticket.event.status);
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
    const ticket = await this.ownedTicket(userId, ticketId);
    this.assertEditable(ticket.event.status);
    if (ticket.sold > 0) {
      throw new ConflictError("Tiket yang sudah terjual tidak dapat dihapus");
    }
    if ((await this.organizerRepo.countOrderItemsByTicket(ticketId)) > 0) {
      throw new ConflictError("Tiket yang sudah memiliki order tidak dapat dihapus");
    }
    await this.organizerRepo.deleteTicket(ticketId);
  }

  async getSales(userId: bigint, eventId: bigint) {
    const organizer = await this.organizerFor(userId);
    const event = await this.organizerRepo.findSalesByEvent(eventId, organizer.id);
    if (!event) throw new NotFoundError("Festival tidak ditemukan");
    const ticketTypes = event.ticketTypes.map((ticket) => {
      const ticketsSold = ticket.orderItems.reduce((total, item) => total + item.quantity, 0);
      const revenue = ticket.orderItems.reduce((total, item) => total + toNumber(item.subtotal), 0);
      return { id: ticket.id, public_id: ticket.public_id, name: ticket.name, price: toNumber(ticket.price), quota: ticket.quota, sold: ticket.sold, available: Math.max(ticket.quota - ticket.sold, 0), paid_tickets: ticketsSold, revenue, paid_order_ids: ticket.orderItems.map((item) => item.order_id) };
    });
    const orderIds = new Set(ticketTypes.flatMap((ticket) => ticket.paid_order_ids.map(String)));
    return {
      event: { id: event.id, title: event.title },
      summary: { paid_orders: orderIds.size, paid_tickets: ticketTypes.reduce((total, ticket) => total + ticket.paid_tickets, 0), revenue: ticketTypes.reduce((total, ticket) => total + ticket.revenue, 0), quota: ticketTypes.reduce((total, ticket) => total + ticket.quota, 0), sold: ticketTypes.reduce((total, ticket) => total + ticket.sold, 0) },
      ticket_types: ticketTypes.map(({ paid_order_ids, ...ticket }) => ticket),
    };
  }
}
