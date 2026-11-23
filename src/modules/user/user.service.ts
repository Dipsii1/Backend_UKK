import { UserRepository } from "./user.repository.js";
import { NotFoundError, ConflictError } from "../../utils/app-error.js";

export class UserService {
  constructor(private readonly userRepo: UserRepository = new UserRepository()) {}

  async getAll(page: number, limit: number) {
    const result = await this.userRepo.findAll(page, limit);
    return { ...result, page, limit, totalPages: Math.ceil(result.total / limit) };
  }

  async getById(id: bigint) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError("Pengguna tidak ditemukan");
    return user;
  }

  async update(id: bigint, data: { email?: string; role_id?: bigint }, requesterRole?: string, requesterId?: bigint) {
    const user = await this.getById(id);

    // Hanya admin yang dapat mengubah role; dari non-admin field ini diabaikan.
    const changeRole = requesterRole === "admin" && data.role_id !== undefined && requesterId !== undefined;
    const changeEmail = Boolean(data.email) && data.email !== user.email;
    if (!changeRole && !changeEmail) return user;

    if (changeRole) await this.userRepo.changeRole(id, data.role_id!, requesterId!);
    // Email duplikat ditangani constraint unik (P2002 -> 409).
    if (changeEmail) await this.userRepo.update(id, { email: data.email });

    return this.getById(id);
  }

  async updateProfile(id: bigint, data: { full_name: string }) {
    await this.getById(id);
    await this.userRepo.updateFullName(id, data.full_name);
    return this.getById(id);
  }

  async delete(id: bigint, actorId: bigint) {
    if (id === actorId) throw new ConflictError("Admin tidak dapat menghapus akunnya sendiri");
    await this.getById(id);
    await this.userRepo.deactivate(id, actorId);
  }
}
