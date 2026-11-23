import { createHash, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "./app-error.js";

export interface SnapTransactionInput {
  orderId: string;
  grossAmount: number;
  expiresAt: Date;
  now: Date;
}

export interface SnapTransaction {
  token: string;
  redirect_url: string;
}

const serverKey = (): string => {
  if (!env.MIDTRANS_SERVER_KEY) throw new AppError(503, "PAYMENT_UNAVAILABLE", "Pembayaran belum dikonfigurasi");
  return env.MIDTRANS_SERVER_KEY;
};

// Midtrans meminta waktu WIB dengan format "yyyy-MM-dd HH:mm:ss +0700".
const toWib = (date: Date) =>
  new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 19).replace("T", " ") + " +0700";

export const midtrans = {
  async createSnapTransaction(input: SnapTransactionInput): Promise<SnapTransaction> {
    const url = env.MIDTRANS_IS_PRODUCTION
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${serverKey()}:`).toString("base64")}`,
      },
      body: JSON.stringify({
        transaction_details: { order_id: input.orderId, gross_amount: input.grossAmount },
        // Snap kadaluarsa bersamaan dengan order, agar pembayaran tidak terjadi setelah stok dilepas.
        expiry: {
          start_time: toWib(input.now),
          unit: "minute",
          duration: Math.floor((input.expiresAt.getTime() - input.now.getTime()) / 60_000),
        },
      }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);

    const data = (await response?.json().catch(() => null)) as Partial<SnapTransaction> | null;
    if (!response?.ok || !data?.token || !data.redirect_url) {
      throw new AppError(502, "PAYMENT_GATEWAY_ERROR", "Gagal membuat transaksi pembayaran");
    }
    return { token: data.token, redirect_url: data.redirect_url };
  },

  // signature_key = SHA512(order_id + status_code + gross_amount + ServerKey)
  isValidSignature(orderId: string, statusCode: string, grossAmount: string, signature: string): boolean {
    const expected = createHash("sha512").update(orderId + statusCode + grossAmount + serverKey()).digest();
    const received = Buffer.from(signature, "hex");
    return received.length === expected.length && timingSafeEqual(received, expected);
  },
};
