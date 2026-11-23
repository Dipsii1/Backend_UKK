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
        "Validasi dalam satu transaksi dengan row lock: token ditemukan, tiket untuk event ini, order PAID, tiket tidak dibatalkan, dan belum dipakai. Setiap scan dicatat di ticket_scans; check-in sukses dicatat di audit log. Scan tidak pernah membuat tiket baru.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["event_id", "qr_token"],
              properties: {
                event_id: { type: "string", example: "4" },
                qr_token: { type: "string", description: "Isi QR hasil scan" },
              },
            },
          },
        },
      },
      responses: {
        "200": ok("Check-in berhasil: ticket_code, ticket_type, status USED, checked_in_at"),
        "400": ok("Body tidak valid"),
        "403": ok("Bukan organizer pemilik event / organizer belum terverifikasi"),
        "404": ok("Event atau token tiket tidak ditemukan"),
        "409": ok("Tiket sudah digunakan, bukan untuk event ini, dibatalkan, atau order belum dibayar"),
      },
    },
  },
} as const;
