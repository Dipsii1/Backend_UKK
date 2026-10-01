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

const userSchema = {
  type: "object",
  properties: {
    id: { type: "string", example: "1" },
    public_id: { type: "string", example: "cuid_abc123" },
    email: { type: "string", example: "budi@example.com" },
    is_active: { type: "boolean", example: true },
    created_at: { type: "string", format: "date-time", example: "2026-01-01T00:00:00.000Z" },
    updated_at: { type: "string", format: "date-time", example: "2026-01-01T00:00:00.000Z" },
    role: {
      type: "object",
      properties: { name: { type: "string", example: "buyer" } },
    },
    userProfiles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          full_name: { type: "string", nullable: true, example: "Budi Santoso" },
          phone: { type: "string", nullable: true, example: "08123456789" },
          gender: { type: "string", nullable: true, enum: ["male", "female", "other"] },
          birth_date: { type: "string", format: "date-time", nullable: true },
          avatar: { type: "string", nullable: true },
          address: { type: "string", nullable: true },
        },
      },
    },
  },
};

const idParam = {
  name: "id",
  in: "path",
  required: true,
  description: "ID pengguna (format numeric string, dikonversi ke bigint)",
  schema: { type: "string", example: "1" },
};

export const usersPaths = {
  "/users": {
    get: {
      tags: ["Users"],
      summary: "Ambil daftar semua pengguna",
      description:
        "Mengembalikan seluruh pengguna beserta role dan profilnya. " +
        "**Hanya role `admin`** yang dapat mengakses endpoint ini.",
      security: [{ bearerAuth: [] }],
      responses: {
        "200": {
          description: "Daftar pengguna berhasil diambil.",
          content: {
            "application/json": {
              schema: apiResponse({ type: "array", items: userSchema }),
            },
          },
        },
        "401": errorResponse("UNAUTHORIZED", "Autentikasi diperlukan", 401),
        "403": errorResponse("FORBIDDEN", "Anda tidak memiliki akses untuk tindakan ini", 403),
      },
    },
  },

  "/users/{id}": {
    get: {
      tags: ["Users"],
      summary: "Ambil detail satu pengguna",
      description:
        "Mengembalikan detail satu pengguna berdasarkan ID. " +
        "Dapat diakses oleh **pemilik akun itu sendiri** atau role `admin`.",
      security: [{ bearerAuth: [] }],
      parameters: [idParam],
      responses: {
        "200": {
          description: "Detail pengguna berhasil diambil.",
          content: { "application/json": { schema: apiResponse(userSchema) } },
        },
        "401": errorResponse("UNAUTHORIZED", "Autentikasi diperlukan", 401),
        "403": errorResponse("FORBIDDEN", "Anda tidak memiliki akses untuk tindakan ini", 403),
        "404": errorResponse("NOT_FOUND", "Pengguna tidak ditemukan", 404),
      },
    },
    put: {
      tags: ["Users"],
      summary: "Update data pengguna",
      description:
        "Memperbarui `email` dan/atau `role_id` pengguna. " +
        "Dapat diakses oleh **pemilik akun** atau role `admin`. " +
        "**Hanya `admin`** yang boleh mengubah `role_id`.",
      security: [{ bearerAuth: [] }],
      parameters: [idParam],
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                email: { type: "string", format: "email", example: "emailbaru@example.com" },
                role_id: { type: "string", description: "Hanya boleh diubah oleh admin", example: "2" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Pengguna berhasil diperbarui.",
          content: { "application/json": { schema: apiResponse(userSchema) } },
        },
        "401": errorResponse("UNAUTHORIZED", "Autentikasi diperlukan", 401),
        "403": errorResponse("FORBIDDEN", "Anda tidak memiliki akses untuk tindakan ini", 403),
        "404": errorResponse("NOT_FOUND", "Pengguna tidak ditemukan", 404),
      },
    },
    delete: {
      tags: ["Users"],
      summary: "Hapus pengguna",
      description:
        "Menghapus pengguna secara permanen. " +
        "**Hanya role `admin`** yang dapat mengakses endpoint ini.",
      security: [{ bearerAuth: [] }],
      parameters: [idParam],
      responses: {
        "200": {
          description: "Pengguna berhasil dihapus.",
          content: { "application/json": { schema: apiResponse({ type: "null", example: null }) } },
        },
        "401": errorResponse("UNAUTHORIZED", "Autentikasi diperlukan", 401),
        "403": errorResponse("FORBIDDEN", "Anda tidak memiliki akses untuk tindakan ini", 403),
        "404": errorResponse("NOT_FOUND", "Pengguna tidak ditemukan", 404),
      },
    },
  },

  "/users/{id}/profile": {
    patch: {
      tags: ["Users"],
      summary: "Update profil pengguna",
      description:
        "Memperbarui `full_name` pada profil pengguna. " +
        "Dapat diakses oleh **pemilik akun** atau role `admin`. " +
        "Field lain (phone, gender, dll.) tidak diproses oleh endpoint ini.",
      security: [{ bearerAuth: [] }],
      parameters: [idParam],
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                full_name: { type: "string", example: "Budi Santoso", description: "Nama lengkap yang baru" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Profil berhasil diperbarui.",
          content: { "application/json": { schema: apiResponse(userSchema) } },
        },
        "401": errorResponse("UNAUTHORIZED", "Autentikasi diperlukan", 401),
        "403": errorResponse("FORBIDDEN", "Anda tidak memiliki akses untuk tindakan ini", 403),
        "404": errorResponse("NOT_FOUND", "Pengguna tidak ditemukan", 404),
      },
    },
  },
} as const;
