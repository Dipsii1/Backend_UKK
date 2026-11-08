const apiResponse = (dataSchema: object) => ({
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    code: { type: "string", example: "OK" },
    status: { type: "integer", example: 200 },
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

const validationErrorResponse = {
  description: "Validasi input gagal",
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          code: { type: "string", example: "VALIDATION_ERROR" },
          status: { type: "integer", example: 422 },
          message: { type: "string", example: "Validasi gagal" },
          errors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                field: { type: "string", example: "email" },
                message: { type: "string", example: "Invalid email" },
              },
            },
          },
        },
      },
    },
  },
};

const ticketTypeSchema = {
  type: "object",
  properties: {
    id: { type: "string", example: "1" },
    public_id: { type: "string", example: "tt_abc" },
    name: { type: "string", example: "VIP" },
    description: { type: "string", nullable: true, example: "Tiket akses penuh" },
    price: { type: "number", example: 500000 },
    quota: { type: "integer", example: 100 },
    sold: { type: "integer", example: 10 },
    max_purchase: { type: "integer", example: 5 },
    sale_start_at: { type: "string", format: "date-time", nullable: true },
    sale_end_at: { type: "string", format: "date-time", nullable: true },
    status: { type: "string", example: "active" },
  },
};

const eventItemSchema = {
  type: "object",
  properties: {
    id: { type: "string", example: "1" },
    public_id: { type: "string", example: "evt_abc123" },
    title: { type: "string", example: "UKK Music Fest 2026" },
    slug: { type: "string", example: "ukk-music-fest-2026" },
    summary: { type: "string", nullable: true, example: "Festival musik tahunan terbesar" },
    banner: { type: "string", nullable: true },
    thumbnail: { type: "string", nullable: true },
    start_at: { type: "string", format: "date-time", example: "2026-12-01T19:00:00.000Z" },
    end_at: { type: "string", format: "date-time", example: "2026-12-01T23:00:00.000Z" },
    is_featured: { type: "boolean", example: true },
    created_at: { type: "string", format: "date-time", example: "2026-01-01T00:00:00.000Z" },
    category: {
      type: "object",
      properties: {
        id: { type: "string", example: "1" },
        public_id: { type: "string", example: "cat_xyz" },
        name: { type: "string", example: "Musik" },
        slug: { type: "string", example: "musik" },
      },
    },
    venue: {
      type: "object",
      properties: {
        id: { type: "string", example: "1" },
        public_id: { type: "string", example: "ven_lmn" },
        name: { type: "string", example: "Gelora Bung Karno" },
        slug: { type: "string", example: "gelora-bung-karno" },
        address: { type: "string", nullable: true },
        city: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
      },
    },
    ticketTypes: {
      type: "array",
      items: ticketTypeSchema,
    },
  },
};

const eventDetailSchema = {
  ...eventItemSchema,
  properties: {
    ...eventItemSchema.properties,
    description: { type: "string", nullable: true },
    poster: { type: "string", nullable: true },
    minimum_age: { type: "integer", nullable: true },
    dress_code: { type: "string", nullable: true },
    gate_open_at: { type: "string", format: "date-time", nullable: true },
    sales_start_at: { type: "string", format: "date-time", nullable: true },
    sales_end_at: { type: "string", format: "date-time", nullable: true },
    status: { type: "string", example: "published" },
    is_published: { type: "boolean", example: true },
    updated_at: { type: "string", format: "date-time", nullable: true },
    venue: {
      type: "object",
      properties: {
        ...eventItemSchema.properties.venue,
        image: { type: "string", nullable: true },
        latitude: { type: "number", nullable: true },
        longitude: { type: "number", nullable: true },
        google_maps_url: { type: "string", nullable: true },
        capacity: { type: "integer", nullable: true },
        is_active: { type: "boolean", example: true },
        city: {
          type: "object",
          properties: {
            id: { type: "string" },
            code: { type: "string", nullable: true },
            name: { type: "string" },
            province: {
              type: "object",
              properties: {
                id: { type: "string" },
                code: { type: "string", nullable: true },
                name: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};

const idParam = {
  name: "id",
  in: "path",
  required: true,
  description: "ID event (format numeric string, dikonversi ke bigint)",
  schema: { type: "string", example: "1" },
};

export const eventPaths = {
  "/events": {
    get: {
      tags: ["Events"],
      summary: "Ambil daftar event dengan pagination, pencarian & filter",
      description:
        "Mengembalikan daftar event (event yang sudah published) dengan pagination. " +
        "Mendukung filter berdasarkan lokasi, tanggal, kategori, dan harga tiket.",
      parameters: [
        {
          name: "page",
          in: "query",
          description: "Halaman (default 1)",
          schema: { type: "integer", example: 1, minimum: 1 },
        },
        {
          name: "limit",
          in: "query",
          description: "Batas item per halaman, maksimal 100 (default 10)",
          schema: { type: "integer", example: 10, minimum: 1, maximum: 100 },
        },
        {
          name: "search",
          in: "query",
          description: "Pencarian judul, ringkasan, atau deskripsi (case insensitive)",
          schema: { type: "string", example: "musik" },
        },
        {
          name: "location",
          in: "query",
          description: "Filter berdasarkan nama kota atau provinsi lokasi (case insensitive)",
          schema: { type: "string", example: "Jakarta" },
        },
        {
          name: "date",
          in: "query",
          description: "Filter tanggal acara (YYYY-MM-DD)",
          schema: { type: "string", example: "2026-12-01" },
        },
        {
          name: "category",
          in: "query",
          description: "Filter berdasarkan slug atau nama kategori (case insensitive)",
          schema: { type: "string", example: "musik" },
        },
        {
          name: "minPrice",
          in: "query",
          description: "Harga tiket minimum",
          schema: { type: "number", example: 100000 },
        },
        {
          name: "maxPrice",
          in: "query",
          description: "Harga tiket maksimum",
          schema: { type: "number", example: 1000000 },
        },
      ],
      responses: {
        "200": {
          description: "Daftar event berhasil diambil.",
          content: {
            "application/json": {
              schema: apiResponse({
                type: "object",
                properties: {
                  data: { type: "array", items: eventItemSchema },
                  total: { type: "integer", example: 25 },
                  page: { type: "integer", example: 1 },
                  limit: { type: "integer", example: 10 },
                  totalPages: { type: "integer", example: 3 },
                },
              }),
            },
          },
        },
        "422": validationErrorResponse,
        "500": errorResponse("INTERNAL_ERROR", "Kesalahan server internal", 500),
      },
    },
  },

  "/events/{id}": {
    get: {
      tags: ["Events"],
      summary: "Ambil detail satu event beserta jenis tiket",
      description:
        "Mengembalikan detail lengkap satu event berdasarkan ID, termasuk daftar jenis tiket yang aktif.",
      parameters: [idParam],
      responses: {
        "200": {
          description: "Detail event berhasil diambil.",
          content: { "application/json": { schema: apiResponse(eventDetailSchema) } },
        },
        "404": errorResponse("NOT_FOUND", "Event tidak ditemukan", 404),
        "500": errorResponse("INTERNAL_ERROR", "Kesalahan server internal", 500),
      },
    },
  },
} as const;
