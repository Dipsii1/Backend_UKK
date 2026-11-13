const apiResponse = (dataSchema: object, statusCode = 200) => ({
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    code: { type: "string", example: "OK" },
    status: { type: "integer", example: statusCode },
    message: { type: "string" },
    data: dataSchema,
  },
});

const errorResponse = (code: string, message: string, statusCode: number) => ({
  description: message,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          code: { type: "string", example: code },
          status: { type: "integer", example: statusCode },
          message: { type: "string", example: message },
        },
      },
    },
  },
});

const successResponse = (description: string, dataSchema: object, statusCode = 200) => ({
  description,
  content: {
    "application/json": {
      schema: apiResponse(dataSchema, statusCode),
    },
  },
});

const idParam = {
  name: "id",
  in: "path",
  required: true,
  description: "ID numerik festival atau tiket",
  schema: { type: "string", example: "1" },
};

const auth = [{ bearerAuth: [] }];

const eventBody = {
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["category_id", "venue_id", "title", "slug", "start_at", "end_at"],
        properties: {
          category_id: { type: "string", example: "1" },
          venue_id: { type: "string", example: "1" },
          title: { type: "string", example: "UKK Music Fest 2026" },
          slug: { type: "string", example: "ukk-music-fest-2026" },
          start_at: { type: "string", format: "date-time" },
          end_at: { type: "string", format: "date-time" },
        },
      },
    },
  },
};

const ticketBody = {
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["event_id", "name", "price", "quota"],
        properties: {
          event_id: { type: "string", example: "1" },
          name: { type: "string", example: "VIP" },
          price: { type: "number", example: 500000 },
          quota: { type: "integer", example: 100 },
          max_purchase: { type: "integer", example: 5 },
          status: { type: "string", enum: ["active", "sold_out", "inactive"] },
        },
      },
    },
  },
};

const response = (description: string, statusCode = 200) =>
  successResponse(description, {}, statusCode);
const id = idParam;

export const organizerPaths = {
  "/organizer/event": { get: { tags: ["Organizer"], security: auth, summary: "Daftar festival milik organizer", parameters: [{ name: "page", in: "query", schema: { type: "integer", minimum: 1 } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } }], responses: { "200": response("Daftar festival"), "401": response("Autentikasi diperlukan", 401), "403": response("Khusus organizer", 403) } }, post: { tags: ["Organizer"], security: auth, summary: "Buat festival", requestBody: eventBody, responses: { "201": response("Festival dibuat", 201), "422": response("Validasi gagal", 422) } } },
  "/organizer/event/{id}": { get: { tags: ["Organizer"], security: auth, summary: "Detail festival milik organizer", parameters: [id], responses: { "200": response("Detail festival"), "404": response("Festival tidak ditemukan", 404) } }, patch: { tags: ["Organizer"], security: auth, summary: "Perbarui festival", parameters: [id], requestBody: eventBody, responses: { "200": response("Festival diperbarui"), "422": response("Validasi gagal", 422) } }, delete: { tags: ["Organizer"], security: auth, summary: "Hapus festival tanpa tiket terjual", parameters: [id], responses: { "204": { description: "Festival dihapus" }, "409": response("Festival memiliki tiket terjual", 409) } } },
  "/organizer/event/{id}/tickets": { get: { tags: ["Organizer"], security: auth, summary: "Daftar tiket festival", parameters: [id], responses: { "200": response("Daftar tiket") } } },
  "/organizer/event/{id}/sales": { get: { tags: ["Organizer"], security: auth, summary: "Monitoring penjualan per festival", parameters: [id], responses: { "200": response("Ringkasan penjualan"), "404": response("Festival tidak ditemukan", 404) } } },
  "/organizer/tickets": { post: { tags: ["Organizer"], security: auth, summary: "Buat tiket dan kuota", requestBody: ticketBody, responses: { "201": response("Tiket dibuat", 201), "422": response("Validasi gagal", 422) } } },
  "/organizer/tickets/{id}": { get: { tags: ["Organizer"], security: auth, summary: "Detail tiket", parameters: [id], responses: { "200": response("Detail tiket") } }, patch: { tags: ["Organizer"], security: auth, summary: "Perbarui tiket atau kuota", parameters: [id], requestBody: ticketBody, responses: { "200": response("Tiket diperbarui"), "409": response("Kuota di bawah tiket terjual", 409) } }, delete: { tags: ["Organizer"], security: auth, summary: "Hapus tiket tanpa penjualan", parameters: [id], responses: { "204": { description: "Tiket dihapus" }, "409": response("Tiket sudah terjual", 409) } } },
} as const;
