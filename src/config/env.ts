import "dotenv/config";
import { z } from "zod";

const boolFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET minimal 32 karakter"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  CLIENT_URL: z.url().default("http://localhost:3000"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  TRUST_PROXY: boolFromString,
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: boolFromString,
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  // Server Key Midtrans: untuk Basic Auth Snap API dan verifikasi signature_key webhook. Jangan pernah dikirim ke frontend.
  MIDTRANS_SERVER_KEY: z.string().min(1).optional(),
  MIDTRANS_IS_PRODUCTION: boolFromString,
  // Opsional: aktifkan bila "Enhanced Push Security" Expo dinyalakan.
  EXPO_ACCESS_TOKEN: z.string().min(1).optional(),
  // Cloudinary: penyimpanan private berkas verifikasi organizer & event. Tanpa ini endpoint upload merespons 503.
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Konfigurasi environment tidak valid:");
  console.error(z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";