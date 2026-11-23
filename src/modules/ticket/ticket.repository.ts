import { prisma } from "../../lib/prisma.js";

export class TicketRepository {
  // Tiket hanya terlihat oleh pemiliknya dan hanya dari order yang sudah dibayar.
  private ownedPaid(userId: bigint) {
    return { owner_id: userId, order: { status: "paid" as const } };
  }

  private ticketSelect = {
    id: true,
    public_id: true,
    ticket_code: true,
    qr_token: true,
    status: true,
    checked_in_at: true,
    order: { select: { id: true, order_number: true } },
    ticketType: {
      select: {
        id: true,
        name: true,
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            gate_open_at: true,
            start_at: true,
            end_at: true,
            venue: { select: { name: true, address: true } },
          },
        },
      },
    },
  } as const;

  async findByOwner(userId: bigint, page: number, limit: number) {
    const where = this.ownedPaid(userId);
    const [data, total] = await prisma.$transaction([
      prisma.tickets.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: "desc" },
        select: this.ticketSelect,
      }),
      prisma.tickets.count({ where }),
    ]);
    return { data, total };
  }

  async findByIdAndOwner(id: bigint, userId: bigint) {
    return prisma.tickets.findFirst({
      where: { id, ...this.ownedPaid(userId) },
      select: this.ticketSelect,
    });
  }
}
