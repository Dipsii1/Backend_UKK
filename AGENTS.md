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
├── skills-lock.json
├── docs/
│   ├── index.md               # titik masuk docs
│   ├── security.md            # checklist keamanan (auth, IDOR, transaksi)
│   ├── specs/                 # spec per fitur & arsitektur (_template.md, auth.md, architecture.md, data_model.md, runbook.md, testing.md)
│   └── api/conventions.md
├── prisma/
│   ├── schema.prisma
│   └── migrations/            # contoh: 20260917030615_init_full_schema
└── src/
    ├── generated/prisma/      # Prisma Client (generated — jangan edit)
    ├── config/                # env, prisma client instance, swagger config
    ├── modules/               # domain module (route, controller, service, repository, validation/type)
    │   ├── auth/
    │   ├── user/
    │   ├── event/
    │   ├── organizer/
    │   └── admin/                 # approval event, manajemen akun, monitoring sistem
    ├── middlewares/           # auth (JWT), role guard, validasi, error handler
    ├── utils/                 # helper (hash, token, response, pagination)
    ├── types/                 # tipe/DTO bersama
    └── app.ts / server.ts     # bootstrap Express + listen
```

### Konvensi Struktur `src/`
- **Satu domain = satu folder module** di `src/modules/<domain>/`, dengan penamaan `<domain>.<layer>.ts` (contoh: `user.controller.ts`, `user.service.ts`, `user.repository.ts`, `user.route.ts`). Ikuti pola auth/user yang sudah ada.
- Domain mengikuti data model: `user`, `organizer`, `event`, `admin`, `ticket-type`, `ticket`, `cart`, `order`, `payment`, `check-in`, `notification`, `audit-log`, serta master data (`role`, `gender`).
- Router baru **wajib** didaftarkan di `src/index.ts`.
- Helper lintas domain masuk `utils/`, bukan diduplikasi di service/controller.
- Middleware (auth, role, validasi, error handler) masuk `middlewares/`, bukan inline di route.
- Instance Prisma dibuat **sekali** di `config/` dan hanya diimpor oleh repository.
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
Controller → UserService → UserRepository → Prisma → PostgreSQL
```
- `UserRepository`: `findAll`, `findById`, `findByUsername`, `findByEmail`, `create`, `update`, `delete`, `createBuyerUser`, `createRefreshToken`, `findRefreshToken`, `revokeRefreshToken`, `revokeAllUserRefreshTokens`.
- `UserService`: `getAll`, `getById`, `register`, `login`, `getProfile`, `refresh`, `logout`.
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
- **Check-in tiket**: validasi status tiket (belum dipakai, order sudah paid, event sesuai) dalam satu transaksi atomik.
- **Secrets**: `.env` tidak di-commit. Cek `.gitignore` sebelum commit.
- **Logging**: jangan log PII, token, atau password.
- **Error handling**: global error handler, fail-closed, jangan bocorkan stack trace ke client di production.
- **Audit**: aksi sensitif (ubah status order/pembayaran, role, check-in) dicatat ke audit log.
- **Admin**: approval event hanya dapat dilakukan saat status `pending_review`; approval mempublikasikan event dan harus dicatat ke audit log. Perubahan status user/organizer oleh admin juga wajib tercatat.
- **Token one-time**: token reset password dan verifikasi email disimpan sebagai hash, memiliki expiry, dan hanya boleh dikonsumsi sekali secara atomik. Reset password mencabut refresh token aktif pengguna.
- **Event publik**: endpoint publik hanya boleh mengembalikan event dengan `status = published` dan `is_published = true`.

---

## 9. Testing

Testing menggunakan **Vitest** + `@vitest/coverage-v8`, **Supertest** untuk endpoint HTTP, dan **vitest-mock-extended** untuk mock Prisma pada unit test.
- Test berada di `tests/**/*.test.ts` atau `src/**/*.test.ts`; konfigurasi di `vitest.config.ts`.
- Repository didesain **mockable** agar Service bisa di-unit test tanpa database; `tests/helpers/prisma.mock.ts` mereset Prisma mock tiap test.
- Setiap perubahan behavior pada Service sebaiknya disertai test (Red → Green → Refactor).
- Jangan ubah assertion yang sudah ada demi membuat test pass — perbaiki implementasi.
- Verifikasi minimum sebelum commit: `npx tsc --noEmit`, `npx prisma validate`, `npm test`, dan `npm run test:coverage` lolos.
- Target coverage minimum untuk controller dan service adalah 80%.

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
3. Implementasi dari layer bawah ke atas: Repository → Service → Controller → Route (+ Swagger), lalu daftarkan di `routes/index.ts`.
4. Jalankan `npx tsc --noEmit` dan `npx prisma validate`.
5. Commit dengan conventional commit.
6. Setelah implementasi dan verifikasi selesai, **update `README.md`** (changelog + bagian terdampak). Update `AGENTS.md` bila ada perubahan arsitektur/behavior.

---

> Update tabel ini setiap kali ada perubahan keputusan arsitektur/stack.
