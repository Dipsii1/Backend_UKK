import type { Request } from "express";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { parseSchema } from "../../utils/validation.js";
import { AdminService } from "./admin.service.js";
import {
  organizerQuerySchema,
  organizerStatusSchema,
  transactionLogQuerySchema,
  userQuerySchema,
  userStatusSchema,
} from "./admin.validation.js";

const adminService = new AdminService();

const getUserId = (req: Request) => req.userId!;
const getIdParam = (req: Request) => BigInt(req.params.id as string);

export class AdminController {
  static approveEvent = asyncHandler(async (req, res) => {
    const data = await adminService.approveEvent(getIdParam(req), getUserId(req));
    sendSuccess(res, data, "Event berhasil disetujui dan dipublikasikan");
  });

  static listUsers = asyncHandler(async (req, res) => {
    const filters = parseSchema(userQuerySchema, req.query);
    const data = await adminService.listUsers(filters);
    sendSuccess(res, data, "Daftar pengguna berhasil diambil");
  });

  static updateUserStatus = asyncHandler(async (req, res) => {
    const input = parseSchema(userStatusSchema, req.body);
    const data = await adminService.updateUserStatus(getIdParam(req), input.is_active, getUserId(req));
    sendSuccess(res, data, "Status pengguna berhasil diperbarui");
  });

  static listOrganizers = asyncHandler(async (req, res) => {
    const filters = parseSchema(organizerQuerySchema, req.query);
    const data = await adminService.listOrganizers(filters);
    sendSuccess(res, data, "Daftar organizer berhasil diambil");
  });

  static updateOrganizerStatus = asyncHandler(async (req, res) => {
    const input = parseSchema(organizerStatusSchema, req.body);
    const data = await adminService.updateOrganizerStatus(getIdParam(req), input.status, getUserId(req));
    sendSuccess(res, data, "Status organizer berhasil diperbarui");
  });

  static getDashboard = asyncHandler(async (_req, res) => {
    const data = await adminService.getDashboard();
    sendSuccess(res, data, "Dashboard sistem berhasil diambil");
  });

  static listTransactionLogs = asyncHandler(async (req, res) => {
    const filters = parseSchema(transactionLogQuerySchema, req.query);
    const data = await adminService.listTransactionLogs(filters);
    sendSuccess(res, data, "Log transaksi berhasil diambil");
  });
}
