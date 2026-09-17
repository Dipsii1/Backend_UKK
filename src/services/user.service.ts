import { UserRepository } from "../repositories/user.repository.js";
import { NotFoundError } from "../utils/app-error.js";

export class UserService {
  constructor(private readonly userRepo: UserRepository = new UserRepository()) {}

  async getAll() {
    return this.userRepo.findAll();
  }

  async getById(id: bigint) {
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundError("User not found");
    return user;
  }

  async update(id: bigint, data: { username?: string; email?: string; role_id?: bigint }) {
    await this.getById(id);
    return this.userRepo.update(id, data);
  }

  async delete(id: bigint) {
    await this.getById(id);
    return this.userRepo.delete(id);
  }
}