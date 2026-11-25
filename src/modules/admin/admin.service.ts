import type { OrganizerStatus } from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError, ValidationError } from "../../utils/app-error.js";
import { AdminRepository } from "./admin.repository.js";
import { emitToAll } from "../../lib/socket.js";
import { documentStorage, ORGANIZER_DOCUMENT_TYPES } from "../../utils/document-storage.js";
import type { OrganizerQuery, TransactionLogQuery, UserQuery } from "./admin.types.js";

export class AdminService {
  constructor(private readonly adminRepo: AdminRepository = new AdminRepository()) {}

  async approveEvent(eventId: bigint, adminId: bigint) {
    const result = await this.adminRepo.approveEvent(eventId, adminId);
    if (!result) throw new NotFoundError("Event tidak ditemukan");
    if (!result.event && result.currentStatus !== "pending_review") {
      throw new ConflictError("Hanya event dengan status pending_review yang dapat disetujui");
    }
    if (!result.event && result.missingDocuments) {
      throw new ConflictError("Berkas verifikasi event belum lengkap");
    }
    if (!result.event) {
      throw new ConflictError("Organizer event belum terverifikasi");
    }
    // Client yang terhubung me-refresh daftar event tanpa restart aplikasi.
    emitToAll("event:published", { id: result.event.id, public_id: result.event.public_id, title: result.event.title });
    return result.event;
  }

  async listUsers(filters: UserQuery) {
    const result = await this.adminRepo.findUsers(filters);
    return {
      ...result,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(result.total / filters.limit),
    };
  }

  async updateUserStatus(id: bigint, isActive: boolean, adminId: bigint) {
    if (id === adminId && !isActive) {
      throw new ConflictError("Admin tidak dapat menonaktifkan akunnya sendiri");
    }
    const user = await this.adminRepo.setUserActive(id, isActive, adminId);
    if (!user) throw new NotFoundError("Pengguna tidak ditemukan");
    return user;
  }

  async listOrganizers(filters: OrganizerQuery) {
    const result = await this.adminRepo.findOrganizers(filters);
    return {
      ...result,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(result.total / filters.limit),
    };
  }

  async updateOrganizerStatus(id: bigint, status: OrganizerStatus, adminId: bigint) {
    if (status === "verified") {
      const organizer = await this.adminRepo.findOrganizerDocuments(id);
      if (!organizer) throw new NotFoundError("Organizer tidak ditemukan");
      if (organizer.documents.length < ORGANIZER_DOCUMENT_TYPES.length) {
        throw new ConflictError("Berkas legalitas organizer belum lengkap");
      }
    }
    const organizer = await this.adminRepo.setOrganizerStatus(id, status, adminId);
    if (!organizer) throw new NotFoundError("Organizer tidak ditemukan");
    return organizer;
  }

  async getOrganizerDocuments(id: bigint) {
    const organizer = await this.adminRepo.findOrganizerDocuments(id);
    if (!organizer) throw new NotFoundError("Organizer tidak ditemukan");
    return organizer.documents.map(documentStorage.toOutput);
  }

  async getEventDocuments(id: bigint) {
    const event = await this.adminRepo.findEventDocuments(id);
    if (!event) throw new NotFoundError("Event tidak ditemukan");
    return event.documents.map(documentStorage.toOutput);
  }

  async getDashboard() {
    return this.adminRepo.getDashboard();
  }

  async listTransactionLogs(filters: TransactionLogQuery) {
    if (filters.start_date && filters.end_date && filters.end_date < filters.start_date) {
      throw new ValidationError("Rentang tanggal tidak valid", [
        { field: "end_date", message: "Harus setelah start_date" },
      ]);
    }
    const result = await this.adminRepo.findTransactionLogs(filters);
    return {
      ...result,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(result.total / filters.limit),
    };
  }
}
