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
        required: ["category_id", "venue", "title", "start_at", "end_at"],
        properties: {
          category_id: { type: "string", example: "1" },
          venue: {
            type: "object",
            description: "Venue baru yang dibuat bersama event. Kota dipilih dari GET /organizer/cities.",
            required: ["name", "city_id"],
            properties: { name: { type: "string", example: "Lapangan Banteng" }, address: { type: "string", example: "Jl. Lapangan Banteng, Jakarta Pusat" }, city_id: { type: "string", example: "1" } },
          },
          title: { type: "string", example: "UKK Music Fest 2026" },
          slug: { type: "string", example: "ukk-music-fest-2026", description: "Opsional. Bila kosong dibuat dari judul (unik)." },
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
          wave: { type: "integer", example: 2, description: "Gelombang penjualan (default 1)" },
          sale_start_at: { type: "string", format: "date-time", description: "Mulai jual gelombang ini" },
          sale_end_at: { type: "string", format: "date-time", description: "Akhir jual gelombang ini" },
          status: { type: "string", enum: ["active", "sold_out", "inactive"] },
          color: { type: "string", example: "#FF4D00", description: "Warna kelas tiket di denah (#RRGGBB)" },
        },
      },
    },
  },
};

const response = (description: string, statusCode = 200) =>
  successResponse(description, {}, statusCode);
const id = idParam;

export const organizerPaths = {
  "/organizer/profile": { get: { tags: ["Organizer"], security: auth, summary: "Profil organizer (perusahaan, status verifikasi, kelengkapan berkas)", responses: { "200": response("Profil organizer"), "401": response("Autentikasi diperlukan", 401), "403": response("Bukan organizer", 403) } } },
  "/organizer/categories": { get: { tags: ["Organizer"], security: auth, summary: "Daftar kategori event untuk form", responses: { "200": response("Daftar kategori"), "401": response("Autentikasi diperlukan", 401), "403": response("Khusus organizer", 403) } } },
  "/organizer/cities": { get: { tags: ["Organizer"], security: auth, summary: "Daftar kota (dengan provinsi) untuk venue", responses: { "200": response("Daftar kota"), "401": response("Autentikasi diperlukan", 401), "403": response("Khusus organizer", 403) } } },
  "/organizer/event": { get: { tags: ["Organizer"], security: auth, summary: "Daftar festival milik organizer", parameters: [{ name: "page", in: "query", schema: { type: "integer", minimum: 1 } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100 } }], responses: { "200": response("Daftar festival"), "401": response("Autentikasi diperlukan", 401), "403": response("Khusus organizer", 403) } }, post: { tags: ["Organizer"], security: auth, summary: "Buat festival", requestBody: eventBody, responses: { "201": response("Festival dibuat", 201), "400": response("Validasi gagal", 400) } } },
  "/organizer/event/{id}": { get: { tags: ["Organizer"], security: auth, summary: "Detail festival milik organizer", parameters: [id], responses: { "200": response("Detail festival"), "404": response("Festival tidak ditemukan", 404) } }, patch: { tags: ["Organizer"], security: auth, summary: "Perbarui festival (hanya status draft/rejected)", parameters: [id], requestBody: eventBody, responses: { "200": response("Festival diperbarui"), "400": response("Validasi gagal", 400), "409": response("Festival sudah diajukan/dipublikasikan", 409) } }, delete: { tags: ["Organizer"], security: auth, summary: "Hapus festival tanpa tiket terjual", parameters: [id], responses: { "204": { description: "Festival dihapus" }, "409": response("Festival memiliki tiket terjual/order atau sudah diajukan", 409) } } },
  "/organizer/event/{id}/submit": { post: { tags: ["Organizer"], security: auth, summary: "Ajukan festival draft/rejected untuk direview admin (status menjadi pending_review)", parameters: [id], responses: { "200": response("Festival diajukan"), "403": response("Organizer belum diverifikasi", 403), "404": response("Festival tidak ditemukan", 404), "409": response("Status festival tidak dapat diajukan, belum memiliki tiket, atau berkas verifikasi belum lengkap", 409) } } },
  "/organizer/event/{id}/documents": { get: { tags: ["Organizer"], security: auth, summary: "Daftar berkas verifikasi festival (signed URL berlaku 10 menit)", parameters: [id], responses: { "200": response("Daftar berkas"), "404": response("Festival tidak ditemukan", 404) } } },
  "/organizer/event/{id}/documents/{type}": { put: { tags: ["Organizer"], security: auth, summary: "Unggah atau ganti berkas verifikasi festival (hanya saat draft/rejected)", description: "Jenis berkas: `cooperation_agreement` (PKS bermeterai), `venue_permit` (izin venue), `crowd_permit` (izin keramaian kepolisian, atau surat pengajuan izin + perjanjian sewa venue bila izin belum terbit), `artist_confirmation` (kontrak/konfirmasi artis), `liability_statement` (SPTJM). Kelima berkas wajib ada sebelum festival diajukan.", parameters: [id, { name: "type", in: "path", required: true, schema: { type: "string", enum: ["cooperation_agreement", "venue_permit", "crowd_permit", "artist_confirmation", "liability_statement"] } }], requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary", description: "PDF/JPG/PNG, maks 5 MB" } } } } } }, responses: { "200": response("Berkas diunggah"), "400": response("Berkas atau jenis berkas tidak valid", 400), "403": response("Organizer belum diverifikasi", 403), "404": response("Festival tidak ditemukan", 404), "409": response("Festival sudah diajukan atau dipublikasikan", 409), "503": response("Penyimpanan berkas belum dikonfigurasi", 503) } } },
  "/organizer/event/{id}/tickets": { get: { tags: ["Organizer"], security: auth, summary: "Daftar tiket festival", parameters: [id], responses: { "200": response("Daftar tiket") } } },
  "/organizer/event/{id}/sales": { get: { tags: ["Organizer"], security: auth, summary: "Monitoring penjualan per festival", parameters: [id], responses: { "200": response("Ringkasan penjualan"), "404": response("Festival tidak ditemukan", 404) } } },
  "/organizer/tickets": { post: { tags: ["Organizer"], security: auth, summary: "Buat tiket dan kuota", requestBody: ticketBody, responses: { "201": response("Tiket dibuat", 201), "400": response("Validasi gagal", 400) } } },
  "/organizer/tickets/{id}": { get: { tags: ["Organizer"], security: auth, summary: "Detail tiket", parameters: [id], responses: { "200": response("Detail tiket") } }, patch: { tags: ["Organizer"], security: auth, summary: "Perbarui tiket atau kuota", parameters: [id], requestBody: ticketBody, responses: { "200": response("Tiket diperbarui"), "409": response("Kuota di bawah tiket terjual", 409) } }, delete: { tags: ["Organizer"], security: auth, summary: "Hapus tiket tanpa penjualan", parameters: [id], responses: { "204": { description: "Tiket dihapus" }, "409": response("Tiket sudah terjual", 409) } } },
} as const;
