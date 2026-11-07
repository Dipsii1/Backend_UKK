# AGENTS.md — UKK 2026 Backend

> Dokumen ini adalah instruksi operasional untuk AI agent yang mengembangkan project ini.
> Version-controlled. Setiap perubahan behavior harus diikuti update dokumen ini.

---

## 1. Project Overview

Backend REST API untuk aplikasi **manajemen event dan ticketing UKK 2026**. Cakupan domain: master data, autentikasi, organizer, event, ticketing, cart, order, pembayaran, ticket check-in, serta sistem pendukung (notifikasi, audit).

**Base path:** `/api/v1`
**Dokumentasi API:** Swagger UI di `/api-docs`

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
- **Layered architecture** (bukan feature-modular penuh): `Route → Controller → Service → Repository → Prisma → PostgreSQL`.
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
│   ├── _index.md              # titik masuk docs
│   ├── architecture.md
│   ├── data-model.md
│   ├── security.md
│   ├── testing.md
│   ├── runbook.md
│   ├── specs/                 # spec per fitur (_template.md, auth.md)
│   └── api/conventions.md
├── prisma/
│   ├── schema.prisma
│   └── migrations/            # contoh: 20260917030615_init_full_schema
└── src/
    ├── generated/prisma/      # Prisma Client (generated — jangan edit)
    ├── routes/                # definisi route + Swagger annotation
    ├── controllers/           # HTTP layer
    ├── services/              # business rules
    ├── repositories/          # akses database via Prisma
    └── ...                    # middleware, utils, config
```

> Struktur `src/` mengikuti layer di atas. Sebelum menambah folder baru, cek struktur yang sudah ada dan ikuti konvensi penamaannya.

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

---

## 9. Testing

Belum ada test framework yang ditetapkan. Sampai ditetapkan:
- Repository didesain **mockable** agar Service bisa di-unit test tanpa database.
- Setiap perubahan behavior pada Service sebaiknya disertai test (Red → Green → Refactor).
- Jangan ubah assertion yang sudah ada demi membuat test pass — perbaiki implementasi.
- Verifikasi minimum sebelum commit: `npx tsc --noEmit` dan `npx prisma validate` lolos.

---

## 10. Constraints & Rules (untuk AI Agent)

### Yang BOLEH
- Edit file di `src/`, `prisma/` (schema + migration baru), dokumentasi.
- Tambah migration baru via `prisma migrate dev`.
- Tambah route, controller, service, repository mengikuti layer.
- Update `README.md` (changelog) dan `AGENTS.md` jika behavior berubah.

### Yang TIDAK BOLEH
- Commit secret, `.env`, atau credential.
- Edit file di `node_modules/`, `.git/`, atau `src/generated/prisma/`.
- Edit migration lama yang sudah dijalankan.
- Jalankan destructive DB ops (`DROP TABLE`, `TRUNCATE`, `migrate reset`) tanpa persetujuan manual.
- Memanggil Prisma dari Controller/Service (harus lewat Repository).
- Menaruh business logic di Controller atau Route.
- Menambah fitur di luar permintaan.
- `console.log` sisa debug di kode final (gunakan logger yang ada).
- TODO comment tanpa tiket/issue.

### Perubahan Minimal
- Ubah hanya yang diminta. Jangan refactor, rename, atau reformat kode di luar scope.
- Jika menyentuh file, kembalikan **file lengkap** yang sudah diperbarui, bukan potongan.

### Output Format
- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Task summary singkat: apa yang diubah, file terdampak, hasil verifikasi.
- Update changelog di `README.md` untuk perubahan yang signifikan.

---

## 11. Workflow per Task

1. Baca file terkait (route, controller, service, repository, schema) sebelum mengubah.
2. Jika perlu perubahan DB: ubah `schema.prisma` → `npx prisma migrate dev --name <nama>` → `npx prisma generate`.
3. Implementasi dari layer bawah ke atas: Repository → Service → Controller → Route (+ Swagger).
4. Jalankan `npx tsc --noEmit` dan `npx prisma validate`.
5. Commit dengan conventional commit.
6. Update `README.md` changelog dan `AGENTS.md` bila ada perubahan arsitektur/behavior.

---

## 12. Change Log

| Tanggal | Perubahan | Oleh |
|---|---|---|
| 2026-11-07 | Initial AGENTS.md dari struktur repo & README | AI Agent |

> Update tabel ini setiap kali ada perubahan keputusan arsitektur/stack.