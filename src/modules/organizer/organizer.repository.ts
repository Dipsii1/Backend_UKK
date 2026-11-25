import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { StoredDocument } from "../../utils/document-storage.js";
import type { EventDocumentType } from "./organizer.types.js";

export class OrganizerRepository {
  async findByOwnerId(userId: bigint) {
    return prisma.organizers.findFirst({ where: { user_id: userId } });
  }

  async findProfileByOwnerId(userId: bigint) {
    return prisma.organizers.findFirst({
      where: { user_id: userId },
      select: {
        public_id: true, company_name: true, slug: true, logo: true, email: true, phone: true, website: true,
        description: true, address: true, status: true, verified_at: true, created_at: true,
        owner: { select: { email: true } },
        documents: { select: { type: true } },
      },
    });
  }

  async findEvents(organizerId: bigint, page: number, limit: number) {
    const where = { organizer_id: organizerId };
    const [data, total] = await prisma.$transaction([
      prisma.events.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: "desc" },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          venue: { select: { id: true, name: true } },
          ticketTypes: { select: { id: true, quota: true, sold: true } },
        },
      }),
      prisma.events.count({ where }),
    ]);
    return { data, total };
  }

  async findEventByIdAndOrganizer(id: bigint, organizerId: bigint) {
    return prisma.events.findFirst({
      where: { id, organizer_id: organizerId },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        venue: { select: { id: true, name: true, address: true, city_id: true } },
        ticketTypes: true,
      },
    });
  }

  async findCategories() {
    return prisma.event_categories.findMany({ select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } });
  }

  async findCities() {
    return prisma.cities.findMany({
      select: { id: true, name: true, province: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
  }

  async findCityById(id: bigint) {
    return prisma.cities.findUnique({ where: { id }, select: { id: true } });
  }

  async isSlugTaken(table: "events" | "venues", slug: string) {
    const count = table === "events"
      ? await prisma.events.count({ where: { slug } })
      : await prisma.venues.count({ where: { slug } });
    return count > 0;
  }

  // Venue baru dan event dibuat dalam satu transaksi agar tidak ada venue yatim.
  async createEvent(data: Omit<Prisma.eventsUncheckedCreateInput, "venue_id">, venue: Prisma.venuesUncheckedCreateInput) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const { id: venue_id } = await tx.venues.create({ data: venue, select: { id: true } });
      return tx.events.create({ data: { ...data, venue_id } });
    });
  }

  async updateEvent(id: bigint, data: Prisma.eventsUncheckedUpdateInput, venue?: Prisma.venuesUncheckedCreateInput) {
    if (!venue) return prisma.events.update({ where: { id }, data });
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const { id: venue_id } = await tx.venues.create({ data: venue, select: { id: true } });
      return tx.events.update({ where: { id }, data: { ...data, venue_id } });
    });
  }

  // Hapus tipe tiket (beserta item cart yang mereferensikannya) lalu event, secara atomik.
  async deleteEvent(id: bigint) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.cart_items.deleteMany({ where: { ticketType: { event_id: id } } });
      await tx.ticket_types.deleteMany({ where: { event_id: id } });
      await tx.events.delete({ where: { id } });
    });
  }

  async findEventDocuments(eventId: bigint) {
    return prisma.event_documents.findMany({
      where: { event_id: eventId },
      orderBy: { type: "asc" },
    });
  }

  async findEventDocument(eventId: bigint, type: EventDocumentType) {
    return prisma.event_documents.findUnique({
      where: { event_id_type: { event_id: eventId, type } },
    });
  }

  async upsertEventDocument(eventId: bigint, type: EventDocumentType, data: StoredDocument) {
    return prisma.event_documents.upsert({
      where: { event_id_type: { event_id: eventId, type } },
      create: { ...data, event_id: eventId, type },
      update: data,
    });
  }

  async countOrderItemsByEvent(eventId: bigint) {
    return prisma.order_items.count({ where: { ticketType: { event_id: eventId } } });
  }

  async countOrderItemsByTicket(ticketTypeId: bigint) {
    return prisma.order_items.count({ where: { ticket_type_id: ticketTypeId } });
  }

  async findTicketByIdAndOrganizer(id: bigint, organizerId: bigint) {
    return prisma.ticket_types.findFirst({
      where: { id, event: { organizer_id: organizerId } },
      include: {
        event: { select: { id: true, title: true, organizer_id: true, status: true } },
      },
    });
  }

  async findTicketsByEvent(eventId: bigint, organizerId: bigint) {
    return prisma.ticket_types.findMany({
      where: { event_id: eventId, event: { organizer_id: organizerId } },
      orderBy: [{ wave: "asc" }, { created_at: "asc" }],
    });
  }

  async createTicket(data: Prisma.ticket_typesUncheckedCreateInput) {
    return prisma.ticket_types.create({ data });
  }

  async updateTicket(id: bigint, data: Prisma.ticket_typesUncheckedUpdateInput) {
    return prisma.ticket_types.update({ where: { id }, data });
  }

  async deleteTicket(id: bigint) {
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.cart_items.deleteMany({ where: { ticket_type_id: id } });
      await tx.ticket_types.delete({ where: { id } });
    });
  }

  async findSalesByEvent(eventId: bigint, organizerId: bigint) {
    return prisma.events.findFirst({
      where: { id: eventId, organizer_id: organizerId },
      select: {
        id: true,
        title: true,
        ticketTypes: {
          select: {
            id: true,
            public_id: true,
            name: true,
            price: true,
            quota: true,
            sold: true,
            orderItems: {
              where: { order: { status: "paid" } },
              select: { quantity: true, subtotal: true, order_id: true },
            },
          },
        },
      },
    });
  }
}
