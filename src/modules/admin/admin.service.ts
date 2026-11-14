import type { OrganizerStatus } from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError, ValidationError } from "../../utils/app-error.js";
import { AdminRepository } from "./admin.repository.js";
import type { OrganizerQuery, TransactionLogQuery, UserQuery } from "./admin.types.js";

export class AdminService {
  constructor(private readonly adminRepo: AdminRepository = new AdminRepository()) {}

  async approveEvent(eventId: bigint, adminId: bigint) {
    const result = await this.adminRepo.approveEvent(eventId, adminId);
    if (!result) throw new NotFoundError("Event tidak ditemukan");
    if (!result.event) {
      throw new ConflictError("Hanya event dengan status pending_review yang dapat disetujui");
    }
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
    const organizer = await this.adminRepo.setOrganizerStatus(id, status, adminId);
    if (!organizer) throw new NotFoundError("Organizer tidak ditemukan");
    return organizer;
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
