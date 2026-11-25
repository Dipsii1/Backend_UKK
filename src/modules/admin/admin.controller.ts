import type { Request, Response } from "express";
import { AdminRepository } from "./admin.repository.js";
import { AdminService } from "./admin.service.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { parseSchema } from "../../utils/validation.js";
import { organizerQuerySchema, transactionLogQuerySchema, userQuerySchema } from "./admin.validation.js";

const adminService = new AdminService(new AdminRepository());

export class AdminController {
  static approveEvent = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const event = await adminService.approveEvent(id, req.userId!);
    sendSuccess(res, event, "Event berhasil disetujui dan dipublikasikan");
  });

  static listUsers = asyncHandler(async (req: Request, res: Response) => {
    const filters = parseSchema(userQuerySchema, req.query);
    const users = await adminService.listUsers(filters);
    sendSuccess(res, users, "Daftar pengguna berhasil diambil");
  });

  static updateUserStatus = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const user = await adminService.updateUserStatus(id, req.body.is_active, req.userId!);
    sendSuccess(res, user, "Status pengguna berhasil diperbarui");
  });

  static listOrganizers = asyncHandler(async (req: Request, res: Response) => {
    const filters = parseSchema(organizerQuerySchema, req.query);
    const organizers = await adminService.listOrganizers(filters);
    sendSuccess(res, organizers, "Daftar organizer berhasil diambil");
  });

  static updateOrganizerStatus = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const organizer = await adminService.updateOrganizerStatus(id, req.body.status, req.userId!);
    sendSuccess(res, organizer, "Status organizer berhasil diperbarui");
  });

  static getOrganizerDocuments = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const documents = await adminService.getOrganizerDocuments(id);
    sendSuccess(res, documents, "Berkas organizer berhasil diambil");
  });

  static getEventDocuments = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const documents = await adminService.getEventDocuments(id);
    sendSuccess(res, documents, "Berkas event berhasil diambil");
  });

  static getDashboard = asyncHandler(async (_req: Request, res: Response) => {
    const dashboard = await adminService.getDashboard();
    sendSuccess(res, dashboard, "Dashboard sistem berhasil diambil");
  });

  static listTransactionLogs = asyncHandler(async (req: Request, res: Response) => {
    const filters = parseSchema(transactionLogQuerySchema, req.query);
    const logs = await adminService.listTransactionLogs(filters);
    sendSuccess(res, logs, "Log transaksi berhasil diambil");
  });
}
