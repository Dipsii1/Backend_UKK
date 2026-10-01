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
    sendSuccess(res, result, "Link reset kata sandi dikirim");
  });

  static resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.resetPassword(req.body);
    sendSuccess(res, result, "Kata sandi berhasil direset");
  });

  static resetPasswordPage = (req: Request, res: Response) => {
    const token = req.query.token as string;
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Reset Kata Sandi</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h2>Reset Kata Sandi</h2>
        <form id="resetForm" style="max-width: 400px; margin: 0 auto;">
          <input type="hidden" name="token" value="${token}" />
          <div style="margin-bottom: 10px;">
            <input type="password" name="newPassword" placeholder="Kata sandi baru" required minlength="8" 
                   style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;" />
          </div>
          <button type="submit" style="background: #dc3545; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
            Reset Kata Sandi
          </button>
        </form>
        <script>
          document.getElementById('resetForm').onsubmit = async function(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            const res = await fetch('/api/auth/reset-password/confirm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: formData.token, newPassword: formData.newPassword.value })
            });
            const data = await res.json();
            alert(data.message);
            if (res.ok) window.location.href = '${process.env.CLIENT_URL || 'http://localhost:3000'}';
          };
        </script>
        <p style="margin-top: 20px;"><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}">Batal</a></p>
      </body>
      </html>
    `);
  };

  static requestEmailVerification = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.requestEmailVerification(req.body.email);
    sendSuccess(res, result, "Link verifikasi telah dikirim");
  });

  static confirmEmailVerification = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.confirmEmailVerification(req.body.token);
    sendSuccess(res, result, "Email berhasil diverifikasi");
  });

  static verifyEmailPage = asyncHandler(async (req: Request, res: Response) => {
    const token = req.query.token as string;
    if (!token) {
      res.status(400).send("<h1>Token tidak ditemukan</h1>");
      return;
    }

    try {
      await authService.confirmEmailVerification(token);
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Verifikasi Berhasil</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>Email Berhasil Diverifikasi!</h2>
          <p>Selamat, akun Anda kini telah terverifikasi.</p>
          <p><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}">Kembali ke aplikasi</a></p>
        </body>
        </html>
      `);
    } catch (error) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Verifikasi Gagal</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h2>Verifikasi Gagal</h2>
          <p>Token tidak valid atau sudah kadaluarsa.</p>
          <p><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}">Coba lagi</a></p>
        </body>
        </html>
      `);
    }
  });
}