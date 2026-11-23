import type { Request, Response } from "express";
import { OrganizerRepository } from "./organizer.repository.js";
import { OrganizerService } from "./organizer.service.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { paginationSchema, parseSchema } from "../../utils/validation.js";

const organizerService = new OrganizerService(new OrganizerRepository());

export class OrganizerController {
  static listEvents = asyncHandler(async (req: Request, res: Response) => {
    const { page, limit } = parseSchema(paginationSchema, req.query);
    const events = await organizerService.listEvents(req.userId!, page, limit);
    sendSuccess(res, events, "Daftar festival berhasil diambil");
  });

  static getEvent = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const event = await organizerService.getEvent(req.userId!, id);
    sendSuccess(res, event, "Detail festival berhasil diambil");
  });

  static createEvent = asyncHandler(async (req: Request, res: Response) => {
    const event = await organizerService.createEvent(req.userId!, req.body);
    sendSuccess(res, event, "Festival berhasil dibuat", 201);
  });

  static updateEvent = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const event = await organizerService.updateEvent(req.userId!, id, req.body);
    sendSuccess(res, event, "Festival berhasil diperbarui");
  });

  static deleteEvent = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    await organizerService.deleteEvent(req.userId!, id);
    res.status(204).send();
  });

  static submitEvent = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const event = await organizerService.submitEvent(req.userId!, id);
    sendSuccess(res, event, "Festival berhasil diajukan untuk direview admin");
  });

  static listTickets = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const tickets = await organizerService.listTickets(req.userId!, id);
    sendSuccess(res, tickets, "Daftar tiket berhasil diambil");
  });

  static getTicket = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const ticket = await organizerService.getTicket(req.userId!, id);
    sendSuccess(res, ticket, "Detail tiket berhasil diambil");
  });

  static createTicket = asyncHandler(async (req: Request, res: Response) => {
    const ticket = await organizerService.createTicket(req.userId!, req.body);
    sendSuccess(res, ticket, "Tiket berhasil dibuat", 201);
  });

  static updateTicket = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const ticket = await organizerService.updateTicket(req.userId!, id, req.body);
    sendSuccess(res, ticket, "Tiket dan kuota berhasil diperbarui");
  });

  static deleteTicket = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    await organizerService.deleteTicket(req.userId!, id);
    res.status(204).send();
  });

  static getSales = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const sales = await organizerService.getSales(req.userId!, id);
    sendSuccess(res, sales, "Monitoring penjualan berhasil diambil");
  });
}
