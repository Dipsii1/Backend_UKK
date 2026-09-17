import type { Request, Response } from "express";
import { UserRepository } from "../repositories/auth.repository.js";
import { UserService } from "../services/auth.service.js";
import { sendSuccess } from "../utils/api-response.js";
import { asyncHandler } from "../utils/async-handler.js";

const userService = new UserService(new UserRepository());

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export class AuthController {
  static register = asyncHandler(async (req: Request, res: Response) => {
    const result = await userService.register(req.body);
    sendSuccess(res, result, "Registration successful", 201);
  });

  static login = asyncHandler(async (req: Request, res: Response) => {
    const result = await userService.login(req.body);
    res.cookie("refresh_token", result.refreshToken, cookieOptions);
    sendSuccess(res, { accessToken: result.accessToken, user: result.user }, "Login successful");
  });

  static profile = asyncHandler(async (req: Request, res: Response) => {
    const profile = await userService.getProfile(req.userId!);
    sendSuccess(res, profile, "Profile retrieved");
  });

  static refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const token = req.body.refreshToken ?? req.cookies?.refresh_token;
    const result = await userService.refresh(token);
    res.cookie("refresh_token", result.refreshToken, cookieOptions);
    sendSuccess(res, { accessToken: result.accessToken }, "Token refreshed");
  });

  static logout = asyncHandler(async (req: Request, res: Response) => {
    await userService.logout(req.userId!);
    res.clearCookie("refresh_token", { httpOnly: true, sameSite: "lax" });
    sendSuccess(res, null, "Logout successful");
  });
}
