import { env } from "../config/env.js";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const BATCH_SIZE = 100; // batas Expo per request

export const EXPO_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]]+\]$/;

export type PushMessage = {
  title: string;
  body?: string;
  data?: Record<string, string>;
};

type ExpoTicket = { status: "ok" | "error"; details?: { error?: string } };

// Mengirim push ke semua token; mengembalikan jumlah terkirim dan token yang sudah tidak terdaftar (untuk dihapus).
export const sendExpoPush = async (tokens: string[], message: PushMessage) => {
  let sent = 0;
  const invalidTokens: string[] = [];

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(env.EXPO_ACCESS_TOKEN && { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` }),
        },
        body: JSON.stringify(batch.map((to) => ({ to, sound: "default", ...message }))),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const { data } = (await response.json()) as { data: ExpoTicket[] };
      data.forEach((ticket, index) => {
        if (ticket.status === "ok") sent += 1;
        else if (ticket.details?.error === "DeviceNotRegistered") invalidTokens.push(batch[index]);
      });
    } catch (error) {
      // Gagal push tidak membatalkan notifikasi yang sudah tersimpan; jangan log token.
      console.error("Gagal kirim Expo push:", error instanceof Error ? error.message : String(error));
    }
  }

  return { sent, invalidTokens };
};
