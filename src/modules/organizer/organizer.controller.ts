import type { Request } from "express";
import { OrganizerService } from "./organizer.service.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { paginationSchema, parseSchema } from "../../utils/validation.js";
import {
  eventCreateSchema,
  eventUpdateSchema,
  ticketCreateSchema,
  ticketUpdateSchema,
} from "./organizer.validation.js";

const organizerService = new OrganizerService();

const getUserId = (req: Request) => req.userId!;
const getIdParam = (req: Request) => BigInt(req.params.id as string);

export class OrganizerController {
  static listEvents = asyncHandler(async (req, res) => {
    const { page, limit } = parseSchema(paginationSchema, req.query);
    const data = await organizerService.listEvents(getUserId(req), page, limit);
    sendSuccess(res, data, "Daftar festival berhasil diambil");
  });

  static getEvent = asyncHandler(async (req, res) => {
    const data = await organizerService.getEvent(getUserId(req), getIdParam(req));
    sendSuccess(res, data, "Detail festival berhasil diambil");
  });

  static createEvent = asyncHandler(async (req, res) => {
    const input = parseSchema(eventCreateSchema, req.body);
    const data = await organizerService.createEvent(getUserId(req), input);
    sendSuccess(res, data, "Festival berhasil dibuat", 201);
  });

  static updateEvent = asyncHandler(async (req, res) => {
    const input = parseSchema(eventUpdateSchema, req.body);
    const data = await organizerService.updateEvent(getUserId(req), getIdParam(req), input);
    sendSuccess(res, data, "Festival berhasil diperbarui");
  });

  static deleteEvent = asyncHandler(async (req, res) => {
    await organizerService.deleteEvent(getUserId(req), getIdParam(req));
    res.status(204).send();
  });

  static submitEvent = asyncHandler(async (req, res) => {
    const data = await organizerService.submitEvent(getUserId(req), getIdParam(req));
    sendSuccess(res, data, "Festival berhasil diajukan untuk direview admin");
  });

  static listTickets = asyncHandler(async (req, res) => {
    const data = await organizerService.listTickets(getUserId(req), getIdParam(req));
    sendSuccess(res, data, "Daftar tiket berhasil diambil");
  });

  static getTicket = asyncHandler(async (req, res) => {
    const data = await organizerService.getTicket(getUserId(req), getIdParam(req));
    sendSuccess(res, data, "Detail tiket berhasil diambil");
  });

  static createTicket = asyncHandler(async (req, res) => {
    const input = parseSchema(ticketCreateSchema, req.body);
    const data = await organizerService.createTicket(getUserId(req), input);
    sendSuccess(res, data, "Tiket berhasil dibuat", 201);
  });

  static updateTicket = asyncHandler(async (req, res) => {
    const input = parseSchema(ticketUpdateSchema, req.body);
    const data = await organizerService.updateTicket(getUserId(req), getIdParam(req), input);
    sendSuccess(res, data, "Tiket dan kuota berhasil diperbarui");
  });

  static deleteTicket = asyncHandler(async (req, res) => {
    await organizerService.deleteTicket(getUserId(req), getIdParam(req));
    res.status(204).send();
  });

  static getSales = asyncHandler(async (req, res) => {
    const data = await organizerService.getSales(getUserId(req), getIdParam(req));
    sendSuccess(res, data, "Monitoring penjualan berhasil diambil");
  });
}
