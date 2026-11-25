# AGENTS.md — UKK 2026 Backend

> Dokumen ini adalah instruksi operasional untuk AI agent yang mengembangkan project ini.
> Version-controlled. Setiap perubahan behavior harus diikuti update dokumen ini.

---

## 1. Project Overview

Backend REST API untuk aplikasi **manajemen event dan ticketing UKK 2026**. Cakupan domain: master data, autentikasi, organizer, event, ticketing, cart, order, pembayaran, ticket check-in, serta sistem pendukung (notifikasi, audit).

**Base path:** `/api/v1`
**Dokumentasi API:** Swagger UI di `/api-docs`
**Dokumentasi operasional:** `src/docs/index.md` (PRD, engineering standards, architecture, API conventions, security, testing, runbook).

---

## 2. Tech Stack (Keputusan Final)

```
Runtime:      Node.js 22+
Language:     TypeScript (dev: tsx watch)
ORM:          Prisma (client di src/generated/prisma)
Database:     PostgreSQL (Neon serverless)
Auth:         JWT (access) + refresh token tersimpan di DB
API Docs:     Swagger UI (/api-docs)
Package mgr:  npm (package-lock.json)
```

### Keputusan Arsitektur
- **Modular layered architecture**: setiap domain berada di `src/modules/<domain>/`, dengan alur `Route → Controller → Service → Repository → Prisma → PostgreSQL` di dalam module.
- Infrastruktur bersama tetap berada di `config/`, `lib/`, `middlewares/`, dan `utils/`; jangan diduplikasi ke module.
- **Repository = satu-satunya pintu ke database.** Service dan Controller tidak boleh memanggil Prisma langsung.
- **Prisma Client digenerate ke `src/generated/prisma`** — jangan edit manual, jangan commit hasil edit tangan.
- **Neon serverless PostgreSQL**: gunakan connection string via `DATABASE_URL`, jangan hardcode.

---

## 3. Struktur Project

```
Backend_UKK/
├── AGENTS.md
├── README.md
├── package.json
├── prisma.config.ts
├── tsconfig.json
├── vitest.config.ts
├── postman/                   # Postman collection seluruh endpoint
├── prisma/
│   ├── schema.prisma
│   └── migrations/            # contoh: 20260917030615_init_full_schema
├── tests/                     # Vitest + Supertest (helpers/prisma.mock.ts)
└── src/
    ├── index.ts               # bootstrap Express, registrasi router, listen
    ├── docs/
    │   ├── index.md           # titik masuk docs
    │   ├── security.md        # checklist keamanan (auth, IDOR, transaksi)
    │   ├── specs/             # spec per fitur & arsitektur (template.md, auth.md, architecture.md, data_model.md, runbook.md, testing.md, ...)
    │   └── api/conventions.md
    ├── generated/prisma/      # Prisma Client (generated — jangan edit)
    ├── config/                # env, swagger config (swagger/*.paths.ts)
    ├── lib/prisma.ts          # instance Prisma (satu-satunya)
    ├── lib/socket.ts          # instance Socket.IO (auth handshake, emitToUser/Role/All)
    ├── modules/               # domain module (route, controller, service, repository, validation, types)
    │   ├── auth/
    │   ├── user/
    │   ├── event/
    │   ├── organizer/
    │   ├── cart/              # keranjang, ticket lock, checkout
    │   ├── payment/           # Midtrans Snap: buat transaksi & webhook notifikasi
    │   ├── ticket/            # e-ticket buyer (GET /me/tickets) + QR
    │   ├── check-in/          # scan & validasi QR e-ticket
    │   ├── health/            # GET /api/v1/health (cek koneksi database)
    │   ├── notification/      # notifikasi user, Expo push token, broadcast admin
    │   ├── admin/             # approval event, manajemen akun, monitoring sistem
    │   └── analytics/         # data chart dashboard admin & organizer (route dipasang di admin/organizer router)
    ├── middlewares/           # auth (JWT), role guard, validasi, error handler, rate limit, logger, upload berkas (multer)
    └── utils/                 # response, app-error, validation (parseSchema, paginationSchema), mailer, midtrans, document-storage (Cloudinary)
```

### Konvensi Struktur `src/`
- **Satu domain = satu folder module** di `src/modules/<domain>/`, dengan penamaan `<domain>.<layer>.ts` (contoh: `user.controller.ts`, `user.service.ts`, `user.repository.ts`, `user.route.ts`). Ikuti pola auth/user yang sudah ada.
- Domain mengikuti data model: `user`, `organizer`, `event`, `admin`, `ticket-type`, `ticket`, `cart`, `order`, `payment`, `check-in`, `notification`, `audit-log`, serta master data (`role`, `gender`).
- Router baru **wajib** didaftarkan di `src/index.ts`.
- Helper lintas domain masuk `utils/`, bukan diduplikasi di service/controller.
- Middleware (auth, role, validasi, error handler) masuk `middlewares/`, bukan inline di route.
- Instance Prisma dibuat **sekali** di `src/lib/prisma.ts` dan hanya diimpor oleh repository.
- Sebelum menambah folder/file baru, cek struktur yang sudah ada dan ikuti penamaannya. Jika nama aktual di repo berbeda dari contoh di atas, **nama aktual yang menang**.

**Aturan dependency:** `routes → controllers → services → repositories → prisma`. Tidak boleh terbalik, tidak boleh melompati layer.

---

## 4. Layer Responsibilities

| Layer | Tanggung Jawab | Dilarang |
|---|---|---|
| **Route** | Mapping endpoint, middleware (auth/role), Swagger doc | Business logic |
| **Controller** | Parsing request, validasi input, kirim response + status code | Akses Prisma, business rules |
| **Service** | Business rules (hash password, JWT, aturan domain, orkestrasi antar repository) | Akses `req`/`res`, query Prisma langsung |
| **Repository** | Query Prisma (CRUD), mapping hasil | Business rules, HTTP concern |

### Pola Auth (acuan implementasi)
```
AuthController → AuthService → UserAuthRepository → Prisma → PostgreSQL
UserController → UserService → UserRepository → Prisma → PostgreSQL
```
- `UserAuthRepository`: `findByEmail`, `findById`, `findAuthUserById`, `createBuyerUser`, `createOrganizerUser`, `createRefreshToken`, `findRefreshToken`, `revokeRefreshTokenIfActive`, `revokeAllUserRefreshTokens`, token reset password & verifikasi email.
- `AuthService`: `register`, `registerOrganizer`, `login`, `getProfile`, `updateProfile`, `refresh`, `logout`, reset password, verifikasi email.
- `UserRepository` / `UserService`: list (pagination), detail, update email/role, update nama, soft delete (`deactivate`).
- Validasi body memakai `validate(schema)` di route; query string memakai `parseSchema(schema, req.query)` dari `src/utils/validation.ts` di controller. Jangan membuat helper parse baru per module.
- Gaya kode mengikuti module `auth`: controller `static x = asyncHandler(async (req: Request, res: Response) => ...)`, service dibuat dengan repository-nya (`new XService(new XRepository())`), `req.userId!` / `BigInt(req.params.id as string)` ditulis langsung tanpa helper, route dikelompokkan dengan komentar dan `router.use(authenticate, authorize(...))` untuk grup terlindungi, tipe ditulis sebagai `export type` di `<domain>.types.ts`, query Prisma ditulis multiline.
- Bila aturan bisnis harus berjalan di dalam interactive transaction (mis. cart/checkout), service mendefinisikan aturan dan menyuntikkannya ke repository (`CartRules`); repository hanya query, lock, dan tulis.
- Fitur baru wajib mengikuti pola yang sama.

---

## 5. Data Model (Ringkas)

Domain di `prisma/schema.prisma`:
- **Master data & auth**: user, role, refresh token, gender.
- **Organizer & event**: organizer, event (status via enum).
- **Ticketing**: tipe tiket, tiket (status via enum), ticket check-in.
- **Transaksi**: cart, order (status via enum), pembayaran (status via enum).
- **Pendukung**: notifikasi, audit log.

Aturan schema:
- Primary key, foreign key, relasi, indeks, dan nullable field harus konsisten dengan rancangan database.
- Status selalu pakai **enum Prisma**, bukan string bebas.
- Tambah indeks untuk kolom yang sering difilter/join (FK, status, tanggal event).
- Perubahan schema = **migration baru**. Jangan edit migration yang sudah ada.

---

## 6. Setup & Perintah

```bash
npm install

# .env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

npx prisma migrate dev     # jalankan migrasi (dev)
npx prisma generate        # generate client ke src/generated/prisma
npx prisma validate        # validasi schema
```

Jalankan dev server dan build sesuai script di `package.json` (jangan asumsikan nama script; baca file-nya dulu).

---

## 7. API Conventions

- Semua endpoint di bawah `/api/v1`.
- Format response konsisten (success & error) — ikuti format yang sudah dipakai di controller yang ada.
- Status code: `200` OK, `201` created, `204` no content, `400` validasi, `401` belum login, `403` tidak punya hak, `404` tidak ditemukan, `409` konflik, `500` error server.
- Setiap endpoint baru **wajib** punya anotasi Swagger (request, response, auth requirement).
- Validasi input di Controller (atau middleware validasi) **sebelum** masuk Service.
- Endpoint list: sediakan pagination (`page`, `limit`) dan batasi `limit` maksimum.
- Jangan pernah mengembalikan `password`, hash, atau refresh token mentah di response.

---

## 8. Security Baseline

- **Password**: hash (bcrypt/argon2), tidak pernah disimpan atau di-log plaintext.
- **JWT**: secret dari env, expiry pendek untuk access token; refresh token disimpan di DB dan bisa di-revoke (`revokeRefreshToken`, `revokeAllUserRefreshTokens`).
- **Authorization**: cek role/ownership di Route middleware **dan** Service (cegah IDOR — user hanya akses order/tiket miliknya; organizer hanya event miliknya).
- **Injection**: query lewat Prisma (parameterized). Jangan pakai `$queryRawUnsafe` dengan input user.
- **Pembayaran & order**: operasi yang mengubah stok tiket, order, dan pembayaran harus dalam **Prisma transaction** agar konsisten dan mencegah overselling.
- **Cart & ticket locking**: cart item harus memiliki reservasi tiket ber-expiry. Perubahan reservasi dan checkout memakai interactive transaction `Serializable` serta row lock berparameter; stok order pending kadaluarsa harus dilepas secara atomik sebelum transaksi cart/checkout berikutnya memeriksa kuota, dan juga oleh job berkala tiap 1 menit (`CartService.expireStaleOrders`, didaftarkan di `src/index.ts`; satu instance).
- **Seat map**: geometri denah disimpan terstruktur (`seat_maps`, `seat_sections`, `seats`), bukan SVG markup. Organizer hanya mengubah denah saat event `draft`/`rejected`; viewer publik memakai query viewport untuk culling. Reservasi kursi berlaku 5 menit dan memakai transaksi `Serializable` + row lock; checkout memindahkannya ke order, dan settlement menandai kursi `sold`. Event Socket.IO `seat:status-changed` hanya membawa delta status kursi.
- **Check-in tiket**: validasi (event sesuai, jendela `gate_open_at`/`start_at`–`end_at`, order paid, tiket tidak batal/kadaluarsa, belum dipakai) dalam satu transaksi atomik dengan `FOR UPDATE` pada baris tiket; validasi gagal tidak mengubah tiket. Hanya organizer pemilik event (status `verified`) atau admin. Sukses menyimpan `checked_in_at` + `checked_in_by`. Setiap scan dicatat di `ticket_scans` (petugas, waktu, event, hasil); scan tidak pernah membuat tiket. Penolakan memakai error code spesifik (`TICKET_USED`, `WRONG_EVENT`, `CHECKIN_NOT_OPEN`, dst.).
- **E-ticket**: diterbitkan hanya di transisi order `pending` → `paid` (di transaksi webhook yang sama), satu record per unit dengan `sequence` 1..quantity. Constraint unik `(order_item_id, sequence)` + `skipDuplicates` mencegah penerbitan ganda. QR hanya berisi `qr_token` acak, tidak pernah data pribadi/pembayaran. Endpoint buyer hanya mengembalikan tiket milik sendiri dari order `paid`.
- **Secrets**: `.env` tidak di-commit. Cek `.gitignore` sebelum commit.
- **Logging**: jangan log PII, token, atau password.
- **Error handling**: global error handler, fail-closed, jangan bocorkan stack trace ke client di production; error 500 tak terduga selalu dicatat ke log server.
- **OWASP Top 10**: terapkan kontrol untuk A01–A10 sesuai checklist `src/docs/security.md`; gunakan `authenticate` sebelum `authorize` atau `authorizeSelfOrRole` pada endpoint terlindungi.
- **Audit**: aksi sensitif (ubah status order/pembayaran, role, check-in) dicatat ke audit log.
- **Admin**: approval event hanya dapat dilakukan saat status `pending_review` dan organizer `verified`; approval mempublikasikan event dan harus dicatat ke audit log. Perubahan status/role/soft delete user dan status organizer oleh admin juga wajib tercatat.
- **JWT type**: access token memakai klaim `type: "access"`, refresh token `type: "refresh"`; `authenticate` hanya menerima access token dan `refresh` hanya menerima refresh token.
- **Organizer & event**: operasi tulis organizer mewajibkan status `verified`. Alur event: `draft` → `POST /organizer/event/:id/submit` → `pending_review` → approve → `published`. Event hanya bisa diubah/dihapus saat `draft`/`rejected`; tiket bisa ditambah saat `draft`/`rejected`/`published` (published: selama event belum berakhir, untuk gelombang baru via `ticket_types.wave` + `sale_start_at`/`sale_end_at`); harga tiket terkunci setelah diajukan.
- **Cart**: khusus role `buyer`; tiket gelombang N hanya bisa masuk cart setelah semua tiket gelombang < N di event yang sama habis/nonaktif/lewat `sale_end_at` (`cartRules.isWaveOpen`); `max_purchase` dihitung lintas order `pending`/`paid`; voucher usage dilepas saat order expired; transaksi Serializable di-retry saat P2034.
- **Pembayaran Midtrans**: `gross_amount` selalu dihitung server dari `orders.total`, jangan pernah dari body request. Satu transaksi Snap pending per order (lock baris order). Webhook wajib lolos verifikasi `signature_key` = SHA512(order_id+status_code+gross_amount+ServerKey) dan kecocokan `gross_amount` sebelum menyentuh status. Perubahan payment/order/stok/tiket dalam satu transaksi `Serializable` dengan urutan lock `ticket_types` → `orders`; transisi status hanya maju agar idempotent. E-ticket hanya terbit saat settlement/capture (fraud `accept`). Server Key hanya dari env `MIDTRANS_SERVER_KEY`.
- **Error Prisma**: P2002/P2003/P2034 → `409`, P2025 → `404` (dipetakan di `errorHandler`). Route tak dikenal → JSON `404`.
- **Token one-time**: token reset password dan verifikasi email disimpan sebagai hash, memiliki expiry, dan hanya boleh dikonsumsi sekali secara atomik. Reset password mencabut refresh token aktif pengguna.
- **Notifikasi & realtime**: push memakai Expo Push (`utils/expo-push.ts`), realtime memakai Socket.IO (`lib/socket.ts`). Handshake socket wajib access token (`verifyAccessToken`) dan user aktif + email terverifikasi; client masuk room `user:<id>` dan `role:<name>`. Emit dilakukan **setelah** transaksi commit; payload tidak boleh berisi PII/token. `order:updated` hanya ke pemilik order. Broadcast hanya admin, wajib tercatat di audit log. Kegagalan push tidak boleh membatalkan notifikasi tersimpan; jangan log push token.
- **Chart dashboard**: `GET /admin/dashboard/charts` (seluruh sistem) dan `GET /organizer/dashboard/charts` (hanya event milik organizer; `event_id` asing → 404). Kontrak chart `{ type, labels, series[{ key, name, unit, data }] }`, bucket zona `Asia/Jakarta` lewat `$queryRaw` berparameter, time series zero-fill, rentang maks 366 hari.
- **Berkas verifikasi**: register organizer wajib 4 berkas legalitas (`business_entity`, `nib`, `npwp`, `pic_ktp`); event wajib 5 berkas (`cooperation_agreement`, `venue_permit`, `crowd_permit`, `artist_confirmation`, `liability_statement`) sebelum submit, hanya bisa diunggah/diganti saat `draft`/`rejected`. File via `uploadDocuments` (multer memory, maks 5 MB, tipe dari magic bytes) lalu `documentStorage` (Cloudinary `type: "private"`); akses hanya signed URL 10 menit, `storage_key` tidak pernah dikirim ke client. Admin `verified` organizer dan approve event (dicek di transaksi) ditolak bila berkas belum lengkap. Upload terjadi sebelum tulis DB; bila DB gagal, file dihapus kembali.
- **Event publik**: endpoint publik hanya boleh mengembalikan event dengan `status = published` dan `is_published = true`.

---

## 9. Testing

Testing menggunakan **Vitest** + `@vitest/coverage-v8`, **Supertest** untuk endpoint HTTP, dan **vitest-mock-extended** untuk mock Prisma pada unit test.
- Test berada di `tests/**/*.test.ts` atau `src/**/*.test.ts`; konfigurasi di `vitest.config.ts`.
- Repository didesain **mockable** agar Service bisa di-unit test tanpa database; `tests/helpers/prisma.mock.ts` mereset Prisma mock tiap test.
- Setiap perubahan behavior pada Service sebaiknya disertai test (Red → Green → Refactor).
- Jangan ubah assertion yang sudah ada demi membuat test pass — perbaiki implementasi.
- Verifikasi minimum sebelum commit: `npx tsc --noEmit`, `npx prisma validate`, `npm test`, dan `npm run test:coverage` lolos.
- Target coverage minimum untuk controller dan service adalah 80% (`coverage.include` di `vitest.config.ts` = `src/modules/**/*.{controller,service}.ts`). Controller baru ditambahkan ke tabel kasus di `tests/controllers.test.ts`.

---

## 10. Constraints & Rules (untuk AI Agent)

### Yang BOLEH
- Edit file di `src/`, `prisma/` (schema + migration baru), dokumentasi.
- Tambah migration baru via `prisma migrate dev`.
- Tambah route, controller, service, repository mengikuti layer dan konvensi struktur di Section 3.
- Update `README.md` (changelog) dan `AGENTS.md` jika behavior berubah.

### Yang TIDAK BOLEH
- Commit secret, `.env`, atau credential.
- Edit file di `node_modules/`, `.git/`, atau `src/generated/prisma/`.
- Edit migration lama yang sudah dijalankan.
- Jalankan destructive DB ops (`DROP TABLE`, `TRUNCATE`, `migrate reset`) tanpa persetujuan manual.
- Memanggil Prisma dari Controller/Service (harus lewat Repository).
- Menaruh business logic di Controller atau Route.
- Menambah fitur di luar permintaan.
- Membuat struktur folder/penamaan file baru yang berbeda dari konvensi di Section 3.
- `console.log` sisa debug di kode final (gunakan logger yang ada).
- TODO comment tanpa tiket/issue.

### Perubahan Minimal
- Ubah hanya yang diminta. Jangan refactor, rename, atau reformat kode di luar scope.
- Jika menyentuh file, kembalikan **file lengkap** yang sudah diperbarui, bukan potongan.

### Output Format
- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Task summary singkat: apa yang diubah, file terdampak, hasil verifikasi.
- **Setelah task selesai, wajib update `README.md`** (changelog + bagian yang terdampak, mis. endpoint, setup, struktur) sebelum dianggap selesai.

---

## 11. Workflow per Task

1. Baca file terkait (route, controller, service, repository, schema) sebelum mengubah.
2. Jika perlu perubahan DB: ubah `schema.prisma` → `npx prisma migrate dev --name <nama>` → `npx prisma generate`.
3. Implementasi dari layer bawah ke atas: Repository → Service → Controller → Route (+ Swagger), lalu daftarkan di `src/index.ts`.
4. Jalankan `npx tsc --noEmit` dan `npx prisma validate`.
5. Commit dengan conventional commit.
6. Setelah implementasi dan verifikasi selesai, **update `README.md`** (changelog + bagian terdampak). Update `AGENTS.md` bila ada perubahan arsitektur/behavior.

---

> Update tabel ini setiap kali ada perubahan keputusan arsitektur/stack.
