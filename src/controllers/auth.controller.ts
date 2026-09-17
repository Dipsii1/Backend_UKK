import type { Request, Response } from "express";
import { UserAuthRepository } from "../repositories/auth.repository.js";
import { AuthService } from "../services/auth.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

const authService = new AuthService(new UserAuthRepository());

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export class AuthController {
  static register = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    sendSuccess(res, result, "Pendaftaran berhasil", 201);
  });

  static login = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    res.cookie("refresh_token", result.refreshToken, cookieOptions);
    sendSuccess(res, { accessToken: result.accessToken, user: result.user }, "Login berhasil");
  });

  static profile = asyncHandler(async (req: Request, res: Response) => {
    const profile = await authService.getProfile(req.userId!);
    sendSuccess(res, profile, "Profil berhasil diambil");
  });

  static refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const token = req.body.refreshToken ?? req.cookies?.refresh_token;
    const result = await authService.refresh(token);
    res.cookie("refresh_token", result.refreshToken, cookieOptions);
    sendSuccess(res, { accessToken: result.accessToken }, "Token berhasil diperbarui");
  });

  static logout = asyncHandler(async (req: Request, res: Response) => {
    await authService.logout(req.userId!);
    res.clearCookie("refresh_token", { httpOnly: true, sameSite: "lax" });
    sendSuccess(res, null, "Logout berhasil");
  });

  static requestPasswordReset = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.requestPasswordReset(req.body.email);
    sendSuccess(res, result, "Link reset kata sandi berhasil dikirim");
  });

  static resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.resetPassword(req.body);
    sendSuccess(res, result, "Kata sandi berhasil direset");
  });
}