import type { Request, Response } from "express";
import { AuthService } from "../services/auth.service.js";

const authService = new AuthService();

export class EmailVerificationController {
  static verify = async (req: Request, res: Response) => {
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
  };
}