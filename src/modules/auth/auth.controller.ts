import type { Request, Response } from "express";
import { UserAuthRepository } from "./auth.repository.js";
import { AuthService } from "./auth.service.js";
import { sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ValidationError } from "../../utils/app-error.js";
import { env } from "../../config/env.js";
import { ORGANIZER_DOCUMENT_TYPES } from "../../utils/document-storage.js";
import type { OrganizerDocumentFiles, OrganizerDocumentType } from "./auth.types.js";

const authService = new AuthService(new UserAuthRepository());

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

export class AuthController {
  static register = asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    sendSuccess(res, result, "Pendaftaran berhasil", 201);
  });

  static registerOrganizer = asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Record<OrganizerDocumentType, Express.Multer.File[]>;
    const documents: OrganizerDocumentFiles = ORGANIZER_DOCUMENT_TYPES.map((type) => [type, files[type][0]]);
    const result = await authService.registerOrganizer(req.body, documents);
    sendSuccess(res, result, "Pendaftaran organizer berhasil", 201);
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

  static updateProfile = asyncHandler(async (req: Request, res: Response) => {
    const profile = await authService.updateProfile(req.userId!, req.body);
    sendSuccess(res, profile, "Profil berhasil diperbarui");
  });

  static refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const token = req.body.refreshToken ?? req.cookies?.refresh_token;
    if (!token) {
      throw new ValidationError("Validasi gagal", [{ field: "refreshToken", message: "Refresh token wajib diisi" }]);
    }
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
    const token = req.query.token;
    // ?token=a&token=b menghasilkan array; tolak agar escapeHtml tidak crash.
    if (typeof token !== "string" || !token) {
      res.status(400).send("<h1>Token tidak ditemukan</h1>");
      return;
    }
    const safeToken = escapeHtml(token);
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Reset Kata Sandi</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h2>Reset Kata Sandi</h2>
        <form id="resetForm" style="max-width: 400px; margin: 0 auto;">
          <input type="hidden" name="token" value="${safeToken}" />
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
            const res = await fetch('/api/v1/auth/reset-password/confirm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: formData.get('token'), newPassword: formData.get('newPassword') })
            });
            const data = await res.json();
            alert(data.message);
            if (res.ok) window.location.href = '${env.CLIENT_URL}';
          };
        </script>
        <p style="margin-top: 20px;"><a href="${env.CLIENT_URL}">Batal</a></p>
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
          <p><a href="${env.CLIENT_URL}">Kembali ke aplikasi</a></p>
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
          <p><a href="${env.CLIENT_URL}">Coba lagi</a></p>
        </body>
        </html>
      `);
    }
  });
}
