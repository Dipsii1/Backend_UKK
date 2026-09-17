import { UserRepository } from "../repositories/user.repository.js";
import { NotFoundError, ForbiddenError } from "../utils/app-error.js";

export class UserService {
  constructor(private readonly userRepo: UserRepository = new UserRepository()) {}

  async getAll() {
    return this.userRepo.findAll();
  }

  async getById(id: bigint) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError("Pengguna tidak ditemukan");
    return user;
  }

  async update(id: bigint, data: { email?: string; role_id?: bigint }, requesterRole?: string) {
    await this.getById(id);

    // Only admin can change role
    const cleanData = { ...data } as { email?: string; role_id?: bigint };
    if (requesterRole !== "admin" && cleanData.role_id !== undefined) {
      delete cleanData.role_id;
    }

    if (cleanData.role_id !== undefined && requesterRole !== "admin") {
      throw new ForbiddenError("Hanya admin yang dapat mengubah role pengguna");
    }

    return this.userRepo.update(id, cleanData);
  }

  async updateProfile(id: bigint, data: { full_name?: string }) {
    await this.getById(id);
    if (data.full_name) await this.userRepo.updateFullName(id, data.full_name);
    return this.getById(id);
  }

  async delete(id: bigint) {
    await this.getById(id);
    return this.userRepo.delete(id);
  }
}