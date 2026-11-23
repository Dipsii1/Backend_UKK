import QRCode from "qrcode";
import { TicketRepository } from "./ticket.repository.js";
import { NotFoundError } from "../../utils/app-error.js";
import type { MyTicket, MyTicketListResult, TicketStatusLabel } from "./ticket.types.js";

type TicketRecord = NonNullable<Awaited<ReturnType<TicketRepository["findByIdAndOwner"]>>>;

const STATUS_LABEL: Record<TicketRecord["status"], TicketStatusLabel> = {
  issued: "UNUSED",
  checked_in: "USED",
  cancelled: "CANCELLED",
  expired: "EXPIRED",
};

// QR hanya berisi qr_token acak; tidak ada data pribadi maupun pembayaran.
const toMyTicket = async (ticket: TicketRecord): Promise<MyTicket> => ({
  id: ticket.id,
  public_id: ticket.public_id,
  ticket_code: ticket.ticket_code,
  status: STATUS_LABEL[ticket.status],
  checked_in_at: ticket.checked_in_at,
  order: ticket.order,
  ticket_type: { id: ticket.ticketType.id, name: ticket.ticketType.name },
  event: ticket.ticketType.event,
  qr_code: await QRCode.toDataURL(ticket.qr_token, { errorCorrectionLevel: "M", margin: 2, width: 320 }),
});

export class TicketService {
  constructor(private readonly ticketRepo: TicketRepository = new TicketRepository()) {}

  async getMyTickets(userId: bigint, page: number, limit: number): Promise<MyTicketListResult> {
    const result = await this.ticketRepo.findByOwner(userId, page, limit);
    return {
      data: await Promise.all(result.data.map(toMyTicket)),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };
  }

  async getMyTicket(userId: bigint, ticketId: bigint): Promise<MyTicket> {
    const ticket = await this.ticketRepo.findByIdAndOwner(ticketId, userId);
    if (!ticket) throw new NotFoundError("Tiket tidak ditemukan");
    return toMyTicket(ticket);
  }
}
