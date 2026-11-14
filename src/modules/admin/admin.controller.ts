import type { Request } from "express";
import { sendSuccess } from "../../utils/api-response.js";
import { ValidationError } from "../../utils/app-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { AdminService } from "./admin.service.js";
import {
  organizerQuerySchema,
  organizerStatusSchema,
  transactionLogQuerySchema,
  userQuerySchema,
  userStatusSchema,
} from "./admin.validation.js";

const adminService = new AdminService();

const parse = <T>(
  schema: {
    safeParse(input: unknown):
      | { success: true; data: T }
      | { success: false; error: { issues: { path: PropertyKey[]; message: string }[] } };
  },
  input: unknown,
): T => {
  const result = schema.safeParse(input);
  if (!result.success) {
    const errors = result.error.issues.map(({ path, message }) => ({
      field: path.join("."),
      message,
    }));
    throw new ValidationError("Validasi gagal", errors);
  }
  return result.data;
};

const getUserId = (req: Request) => req.userId!;
const getIdParam = (req: Request) => BigInt(req.params.id as string);

export class AdminController {
  static approveEvent = asyncHandler(async (req, res) => {
    const data = await adminService.approveEvent(getIdParam(req), getUserId(req));
    sendSuccess(res, data, "Event berhasil disetujui dan dipublikasikan");
  });

  static listUsers = asyncHandler(async (req, res) => {
    const filters = parse(userQuerySchema, req.query);
    const data = await adminService.listUsers(filters);
    sendSuccess(res, data, "Daftar pengguna berhasil diambil");
  });

  static updateUserStatus = asyncHandler(async (req, res) => {
    const input = parse(userStatusSchema, req.body);
    const data = await adminService.updateUserStatus(getIdParam(req), input.is_active, getUserId(req));
    sendSuccess(res, data, "Status pengguna berhasil diperbarui");
  });

  static listOrganizers = asyncHandler(async (req, res) => {
    const filters = parse(organizerQuerySchema, req.query);
    const data = await adminService.listOrganizers(filters);
    sendSuccess(res, data, "Daftar organizer berhasil diambil");
  });

  static updateOrganizerStatus = asyncHandler(async (req, res) => {
    const input = parse(organizerStatusSchema, req.body);
    const data = await adminService.updateOrganizerStatus(getIdParam(req), input.status, getUserId(req));
    sendSuccess(res, data, "Status organizer berhasil diperbarui");
  });

  static getDashboard = asyncHandler(async (_req, res) => {
    const data = await adminService.getDashboard();
    sendSuccess(res, data, "Dashboard sistem berhasil diambil");
  });

  static listTransactionLogs = asyncHandler(async (req, res) => {
    const filters = parse(transactionLogQuerySchema, req.query);
    const data = await adminService.listTransactionLogs(filters);
    sendSuccess(res, data, "Log transaksi berhasil diambil");
  });
}
