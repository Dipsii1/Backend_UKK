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

export const authPaths = {
  "/auth/register": {
    post: {
      tags: ["Auth"],
      summary: "Register akun baru",
      description:
        "Mendaftarkan akun pengguna baru dengan role **buyer** secara default. " +
        "Setelah registrasi berhasil, email verifikasi dikirim ke alamat email yang diberikan. " +
        "Pengguna **tidak dapat login** sebelum email diverifikasi.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "password", "fullName"],
              properties: {
                email: {
                  type: "string",
                  format: "email",
                  maxLength: 255,
                  example: "budi@example.com",
                  description: "Alamat email yang belum terdaftar",
                },
                password: {
                  type: "string",
                  minLength: 8,
                  maxLength: 72,
                  example: "rahasia123",
                  description: "Kata sandi minimal 8 karakter",
                },
                fullName: {
                  type: "string",
                  minLength: 2,
                  maxLength: 100,
                  example: "Budi Santoso",
                  description: "Nama lengkap pengguna",
                },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Registrasi berhasil. Email verifikasi telah dikirim.",
          content: {
            "application/json": {
              schema: apiResponse({
                type: "object",
                properties: {
                  user: {
                    type: "object",
                    properties: {
                      public_id: { type: "string", example: "cuid_abc123" },
                      email: { type: "string", example: "budi@example.com" },
                      full_name: { type: "string", example: "Budi Santoso" },
                    },
                  },
                  message: { type: "string", example: "Registrasi berhasil. Silakan cek email untuk verifikasi akun sebelum login." },
                },
              }),
            },
          },
        },
        "409": errorResponse("CONFLICT", "Email sudah terdaftar", 409),
        "422": validationErrorResponse,
      },
    },
  },

  "/auth/login": {
    post: {
      tags: ["Auth"],
      summary: "Login",
      description:
        "Mengautentikasi pengguna dengan email dan password. " +
        "Mengembalikan **accessToken** (Bearer, berlaku 15 menit) dan **refreshToken** (disimpan di cookie `refresh_token` HttpOnly, berlaku 7 hari). " +
        "Login akan gagal jika akun tidak aktif atau email belum diverifikasi.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email", "password"],
              properties: {
                email: { type: "string", format: "email", example: "budi@example.com" },
                password: { type: "string", example: "rahasia123" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Login berhasil.",
          content: {
            "application/json": {
              schema: apiResponse({
                type: "object",
                properties: {
                  accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
                  user: {
                    type: "object",
                    properties: {
                      public_id: { type: "string", example: "cuid_abc123" },
                      email: { type: "string", example: "budi@example.com" },
                      full_name: { type: "string", example: "Budi Santoso" },
                      role: { type: "string", example: "buyer" },
                    },
                  },
                },
              }),
            },
          },
        },
        "401": errorResponse("UNAUTHORIZED", "Email Atau Password Salah", 401),
        "403": errorResponse("FORBIDDEN", "Akun tidak aktif / Email belum diverifikasi", 403),
        "422": validationErrorResponse,
      },
    },
  },

  "/auth/refresh-token": {
    post: {
      tags: ["Auth"],
      summary: "Refresh access token",
      description:
        "Menukar refresh token lama dengan pasangan token baru (access + refresh). " +
        "Refresh token lama langsung **direvoke** setelah digunakan (rotation). " +
        "Token bisa dikirim via body JSON **atau** cookie `refresh_token`.",
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                refreshToken: {
                  type: "string",
                  description: "Refresh token (opsional jika menggunakan cookie)",
                  example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Token berhasil diperbarui.",
          content: {
            "application/json": {
              schema: apiResponse({
                type: "object",
                properties: {
                  accessToken: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
                },
              }),
            },
          },
        },
        "401": errorResponse("UNAUTHORIZED", "Token tidak valid atau sudah kadaluarsa", 401),
        "422": validationErrorResponse,
      },
    },
  },

  "/auth/logout": {
    post: {
      tags: ["Auth"],
      summary: "Logout",
      description:
        "Merevoke semua refresh token aktif milik pengguna yang login dan menghapus cookie `refresh_token`. " +
        "Memerlukan **Bearer token** yang masih valid.",
      security: [{ bearerAuth: [] }],
      responses: {
        "200": {
          description: "Logout berhasil.",
          content: { "application/json": { schema: apiResponse({ type: "null", example: null }) } },
        },
        "401": errorResponse("UNAUTHORIZED", "Autentikasi diperlukan", 401),
      },
    },
  },

  "/auth/me": {
    get: {
      tags: ["Auth"],
      summary: "Profil pengguna yang sedang login",
      description:
        "Mengambil data lengkap profil pengguna berdasarkan access token. " +
        "Memerlukan **Bearer token** yang masih valid.",
      security: [{ bearerAuth: [] }],
      responses: {
        "200": {
          description: "Data profil berhasil diambil.",
          content: {
            "application/json": {
              schema: apiResponse({
                type: "object",
                properties: {
                  public_id: { type: "string", example: "cuid_abc123" },
                  email: { type: "string", example: "budi@example.com" },
                  role: { type: "string", example: "buyer" },
                  full_name: { type: "string", nullable: true, example: "Budi Santoso" },
                  phone: { type: "string", nullable: true, example: "08123456789" },
                  gender: { type: "string", nullable: true, enum: ["male", "female", "other"], example: "male" },
                  birth_date: { type: "string", format: "date-time", nullable: true, example: "2000-01-01T00:00:00.000Z" },
                  avatar: { type: "string", nullable: true, example: "https://cdn.example.com/avatar.jpg" },
                  address: { type: "string", nullable: true, example: "Jl. Sudirman No.1" },
                  province_id: { type: "string", nullable: true, example: "11" },
                  city_id: { type: "string", nullable: true, example: "1101" },
                },
              }),
            },
          },
        },
        "401": errorResponse("UNAUTHORIZED", "Autentikasi diperlukan", 401),
        "403": errorResponse("FORBIDDEN", "Akun tidak aktif / email belum diverifikasi", 403),
      },
    },
  },

  "/auth/reset-password/request": {
    post: {
      tags: ["Auth"],
      summary: "Request link reset kata sandi",
      description:
        "Mengirimkan email berisi link reset kata sandi ke alamat email yang diberikan. " +
        "Jika email **tidak terdaftar**, respons tetap sukses (anti user enumeration). " +
        "Link reset berlaku selama **1 jam**.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email"],
              properties: {
                email: { type: "string", format: "email", example: "budi@example.com" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Permintaan diproses. Email dikirim jika alamat terdaftar.",
          content: {
            "application/json": {
              schema: apiResponse({
                type: "object",
                properties: {
                  message: { type: "string", example: "Jika email terdaftar, link reset kata sandi telah dikirim" },
                },
              }),
            },
          },
        },
        "422": validationErrorResponse,
      },
    },
  },

  "/auth/reset-password/confirm": {
    post: {
      tags: ["Auth"],
      summary: "Konfirmasi reset kata sandi",
      description:
        "Mereset kata sandi menggunakan token yang diterima via email. " +
        "Token hanya dapat digunakan **satu kali** dan kadaluarsa setelah 1 jam.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["token", "newPassword"],
              properties: {
                token: { type: "string", description: "Token dari link email", example: "a3f9bc..." },
                newPassword: { type: "string", minLength: 8, maxLength: 72, example: "passwordBaru123" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Kata sandi berhasil direset.",
          content: {
            "application/json": {
              schema: apiResponse({
                type: "object",
                properties: {
                  message: { type: "string", example: "Kata sandi berhasil direset" },
                },
              }),
            },
          },
        },
        "401": errorResponse("UNAUTHORIZED", "Token reset tidak valid atau sudah kadaluarsa", 401),
        "422": validationErrorResponse,
      },
    },
  },

  "/auth/reset-password": {
    get: {
      tags: ["Auth"],
      summary: "Halaman HTML form reset kata sandi",
      description:
        "Endpoint untuk browser. Menampilkan form HTML reset kata sandi. " +
        "Link ini dikirim via email oleh sistem. Bukan untuk konsumsi API/JSON.",
      parameters: [
        {
          name: "token",
          in: "query",
          required: true,
          description: "Token reset kata sandi dari email",
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": { description: "Halaman HTML form reset kata sandi" },
      },
    },
  },

  "/auth/verify-email/request": {
    post: {
      tags: ["Auth"],
      summary: "Request ulang link verifikasi email",
      description:
        "Mengirimkan ulang email verifikasi ke alamat yang diberikan. " +
        "Berguna jika link sebelumnya sudah kadaluarsa. " +
        "Jika email **tidak terdaftar**, respons tetap sukses (anti user enumeration). " +
        "Link verifikasi berlaku selama **1 jam**.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["email"],
              properties: {
                email: { type: "string", format: "email", example: "budi@example.com" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Permintaan diproses. Email dikirim jika alamat terdaftar.",
          content: {
            "application/json": {
              schema: apiResponse({
                type: "object",
                properties: {
                  message: { type: "string", example: "Jika email terdaftar, link verifikasi telah dikirim" },
                },
              }),
            },
          },
        },
        "422": validationErrorResponse,
      },
    },
  },

  "/auth/verify-email/confirm": {
    post: {
      tags: ["Auth"],
      summary: "Konfirmasi verifikasi email via API",
      description:
        "Memverifikasi email menggunakan token. Untuk konsumsi API/JSON. " +
        "Setelah berhasil, pengguna dapat login.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["token"],
              properties: {
                token: { type: "string", description: "Token verifikasi dari link email", example: "a3f9bc..." },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Email berhasil diverifikasi.",
          content: {
            "application/json": {
              schema: apiResponse({
                type: "object",
                properties: {
                  message: { type: "string", example: "Email berhasil diverifikasi" },
                },
              }),
            },
          },
        },
        "401": errorResponse("UNAUTHORIZED", "Token verifikasi tidak valid atau sudah kadaluarsa", 401),
        "422": validationErrorResponse,
      },
    },
  },

  "/auth/verify-email": {
    get: {
      tags: ["Auth"],
      summary: "Halaman HTML konfirmasi verifikasi email",
      description:
        "Endpoint untuk browser. Memverifikasi email dan menampilkan halaman HTML hasil verifikasi. " +
        "Link ini diklik langsung dari email oleh pengguna. Bukan untuk konsumsi API/JSON.",
      parameters: [
        {
          name: "token",
          in: "query",
          required: true,
          description: "Token verifikasi dari email",
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": { description: "Halaman HTML: verifikasi berhasil" },
        "400": { description: "Halaman HTML: token tidak valid atau kadaluarsa" },
      },
    },
  },
} as const;
