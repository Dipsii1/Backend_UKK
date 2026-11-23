const auth = [{ bearerAuth: [] }];

const ok = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          code: { type: "string" },
          status: { type: "integer" },
          message: { type: "string" },
          data: {},
        },
      },
    },
  },
});

const pushTokenBody = {
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["token"],
        properties: { token: { type: "string", example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" } },
      },
    },
  },
};

export const notificationPaths = {
  "/notifications": {
    get: {
      tags: ["Notification"],
      security: auth,
      summary: "Daftar notifikasi milik user login (dengan jumlah belum dibaca)",
      description:
        "Realtime: hubungkan Socket.IO ke base URL server dengan `io(url, { auth: { token: accessToken } })`. Event: `notification:new`, `order:updated` (hanya pemilik order), `event:published` (semua client).",
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 10, maximum: 100 } },
      ],
      responses: { "200": ok("Daftar notifikasi"), "401": ok("Belum login") },
    },
  },
  "/notifications/{id}/read": {
    patch: {
      tags: ["Notification"],
      security: auth,
      summary: "Tandai notifikasi sendiri sudah dibaca",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      responses: { "200": ok("Notifikasi dibaca"), "404": ok("Notifikasi tidak ditemukan") },
    },
  },
  "/notifications/push-tokens": {
    post: {
      tags: ["Notification"],
      security: auth,
      summary: "Daftarkan Expo push token perangkat (panggil setelah login)",
      requestBody: pushTokenBody,
      responses: { "201": ok("Token terdaftar"), "400": ok("Format token tidak valid") },
    },
    delete: {
      tags: ["Notification"],
      security: auth,
      summary: "Hapus Expo push token perangkat (panggil saat logout)",
      requestBody: pushTokenBody,
      responses: { "204": { description: "Token dihapus" }, "404": ok("Token tidak ditemukan") },
    },
  },
  "/notifications/broadcast": {
    post: {
      tags: ["Notification"],
      security: auth,
      summary: "Admin: kirim notifikasi ke semua user per role (disimpan, websocket, dan Expo push)",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["title", "role"],
              properties: {
                title: { type: "string", maxLength: 100, example: "Promo akhir tahun" },
                message: { type: "string", maxLength: 500, example: "Diskon 50% untuk semua festival" },
                type: { type: "string", enum: ["order", "payment", "event", "system"], default: "system" },
                role: { type: "string", enum: ["buyer", "organizer", "all"] },
              },
            },
          },
        },
      },
      responses: { "201": ok("Notifikasi terkirim: { recipients, push_sent }"), "403": ok("Bukan admin") },
    },
  },
} as const;
