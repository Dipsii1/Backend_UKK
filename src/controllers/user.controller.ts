import type { Request, Response } from "express";
import { UserRepository } from "../repositories/user.repository.js";
import { UserService } from "../services/user.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

const userService = new UserService(new UserRepository());

export class UserController {
  static getAll = asyncHandler(async (_req: Request, res: Response) => {
    const users = await userService.getAll();
    sendSuccess(res, users, "Pengguna berhasil diambil");
  });

  static getById = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const user = await userService.getById(id);
    sendSuccess(res, user, "Pengguna berhasil diambil");
  });

  static update = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const user = await userService.update(id, req.body, req.userRole);
    sendSuccess(res, user, "Pengguna berhasil diperbarui");
  });

  static updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    const user = await userService.updateProfile(id, req.body);
    sendSuccess(res, user, "Profil berhasil diperbarui");
  });

  static delete = asyncHandler(async (req: Request, res: Response) => {
    const id = BigInt(req.params.id as string);
    await userService.delete(id);
    sendSuccess(res, null, "Pengguna berhasil dihapus");
  });
}