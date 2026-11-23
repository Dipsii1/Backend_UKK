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

const myTicket = {
  type: "object",
  properties: {
    id: { type: "string", example: "21" },
    public_id: { type: "string" },
    ticket_code: { type: "string", example: "TCK-3f1c..." },
    status: { type: "string", enum: ["UNUSED", "USED", "CANCELLED", "EXPIRED"] },
    checked_in_at: { type: "string", format: "date-time", nullable: true },
    order: { type: "object", properties: { id: { type: "string" }, order_number: { type: "string" } } },
    ticket_type: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
    event: {
      type: "object",
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        slug: { type: "string" },
        gate_open_at: { type: "string", format: "date-time", nullable: true },
        start_at: { type: "string", format: "date-time" },
        end_at: { type: "string", format: "date-time" },
        venue: { type: "object", properties: { name: { type: "string" }, address: { type: "string", nullable: true } } },
      },
    },
    qr_code: { type: "string", description: "PNG data URL; QR hanya berisi token acak e-ticket", example: "data:image/png;base64,..." },
  },
};

export const ticketPaths = {
  "/me/tickets": {
    get: {
      tags: ["Tickets"],
      security: auth,
      summary: "Daftar e-ticket milik buyer dari order PAID",
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", default: 10, maximum: 100 } },
      ],
      responses: {
        "200": {
          description: "Daftar e-ticket (data, total, page, limit, totalPages)",
          content: { "application/json": { schema: { type: "object", properties: { data: { type: "object", properties: { data: { type: "array", items: myTicket } } } } } } },
        },
        "401": ok("Belum login"),
        "403": ok("Khusus role buyer"),
      },
    },
  },
  "/me/tickets/{ticketId}": {
    get: {
      tags: ["Tickets"],
      security: auth,
      summary: "Detail e-ticket milik buyer beserta QR",
      parameters: [{ name: "ticketId", in: "path", required: true, schema: { type: "string", example: "21" } }],
      responses: {
        "200": { description: "Detail e-ticket", content: { "application/json": { schema: { type: "object", properties: { data: myTicket } } } } },
        "401": ok("Belum login"),
        "403": ok("Khusus role buyer"),
        "404": ok("Tiket tidak ditemukan, milik buyer lain, atau order belum dibayar"),
      },
    },
  },
  "/check-in": {
    post: {
      tags: ["Check-in"],
      security: auth,
      summary: "Scan QR e-ticket (organizer pemilik event yang terverifikasi, atau admin)",
      description:
        "Validasi dalam satu transaksi dengan row lock: tiket untuk event ini, jendela check-in (gate_open_at, atau start_at bila kosong, sampai end_at), order PAID, tiket tidak dibatalkan/kadaluarsa, dan belum dipakai. Gagal validasi tidak mengubah status tiket. Setiap scan tercatat di ticket_scans (petugas, waktu, event, hasil); check-in sukses menyimpan checked_in_at dan checked_in_by serta dicatat di audit log. Scan tidak pernah membuat tiket baru.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["event_id", "qr_token"],
              properties: {
                event_id: { type: "string", example: "4" },
                qr_token: { type: "string", description: "Isi QR hasil scan (43 karakter base64url)" },
              },
            },
          },
        },
      },
      responses: {
        "200": ok("Check-in berhasil: ticket_code, ticket_type, status USED, checked_in_at, checked_in_by"),
        "400": ok("VALIDATION_ERROR — body tidak valid atau format QR tidak valid"),
        "401": ok("UNAUTHORIZED — belum login"),
        "403": ok("FORBIDDEN (bukan organizer/admin) atau CHECKIN_FORBIDDEN (bukan pemilik event / organizer belum verified)"),
        "404": ok("EVENT_NOT_FOUND atau TICKET_NOT_FOUND (token tidak dikenal)"),
        "409": ok("WRONG_EVENT, CHECKIN_NOT_OPEN, CHECKIN_CLOSED, TICKET_UNPAID, TICKET_CANCELLED, TICKET_EXPIRED, atau TICKET_USED"),
      },
    },
  },
} as const;
