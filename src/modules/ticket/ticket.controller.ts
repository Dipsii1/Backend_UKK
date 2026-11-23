import type { Request, Response } from "express";
import { TicketRepository } from "./ticket.repository.js";
import { TicketService } from "./ticket.service.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { paginationSchema, parseSchema } from "../../utils/validation.js";

const ticketService = new TicketService(new TicketRepository());

export class TicketController {
  static getMine = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = parseSchema(paginationSchema, req.query);
    const tickets = await ticketService.getMyTickets(req.userId!, page, limit);
    sendSuccess(res, tickets, "Daftar e-ticket berhasil diambil");
  });

  static getMineById = asyncHandler(async (req: Request, res: Response) => {
    const ticketId = BigInt(req.params.ticketId as string);
    const ticket = await ticketService.getMyTicket(req.userId!, ticketId);
    sendSuccess(res, ticket, "Detail e-ticket berhasil diambil");
  });
}
