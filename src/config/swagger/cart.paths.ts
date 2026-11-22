const auth = [{ bearerAuth: [] }];

const ok = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          code: { type: "string", example: "OK" },
          status: { type: "integer", example: 200 },
          message: { type: "string" },
          data: {},
        },
      },
    },
  },
});

const ticketTypeId = {
  name: "ticketTypeId",
  in: "path",
  required: true,
  schema: { type: "string", example: "1" },
};

export const cartPaths = {
  "/cart": {
    get: {
      tags: ["Cart"],
      security: auth,
      summary: "Ambil keranjang dan masa reservasi tiket",
      responses: { "200": ok("Keranjang"), "401": ok("Belum login") },
    },
  },
  "/cart/items": {
    put: {
      tags: ["Cart"],
      security: auth,
      summary: "Tambah atau ubah item keranjang dan lock tiket selama 15 menit",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["ticket_type_id", "quantity"],
              properties: {
                ticket_type_id: { type: "string", example: "1" },
                quantity: { type: "integer", example: 2 },
              },
            },
          },
        },
      },
      responses: {
        "200": ok("Keranjang diperbarui"),
        "409": ok("Kuota tidak mencukupi"),
      },
    },
  },
  "/cart/items/{ticketTypeId}": {
    delete: {
      tags: ["Cart"],
      security: auth,
      summary: "Hapus item dan lepaskan reservasi tiket",
      parameters: [ticketTypeId],
      responses: { "204": ok("Item keranjang dihapus") },
    },
  },
  "/cart/checkout": {
    post: {
      tags: ["Cart"],
      security: auth,
      summary: "Buat order dari reservasi keranjang",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                voucher_code: { type: "string", example: "HEMAT10" },
              },
            },
          },
        },
      },
      responses: {
        "201": ok("Order pending dibuat beserta rincian biaya"),
        "409": ok("Reservasi, stok, atau voucher tidak valid"),
      },
    },
  },
} as const;
