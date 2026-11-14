<div align="center">

# 🎟️ UKK 2026 Backend

**Backend API untuk aplikasi manajemen event dan ticketing UKK 2026**

![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Swagger](https://img.shields.io/badge/Swagger-85EA2D?logo=swagger&logoColor=black)

</div>

---

## 📑 Daftar Isi

- [Prasyarat](#-prasyarat)
- [Instalasi](#-instalasi)
- [Konfigurasi Environment](#-konfigurasi-environment)
- [Menjalankan](#-menjalankan)
- [Database](#-database)
- [Arsitektur](#-arsitektur)
- [Dokumentasi API](#-dokumentasi-api)
- [Endpoint](#-endpoint)
- [Format Response](#-format-response)
- [Testing](#-testing)
- [Changelog](#-changelog)

---

## ✅ Prasyarat

- Node.js **22+**
- PostgreSQL (atau [Neon](https://neon.tech) serverless Postgres)

## 📦 Instalasi

```bash
npm install
```

## 🔐 Konfigurasi Environment

Buat file `.env` di root project:

```env
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"

# JWT
JWT_SECRET="minimal-32-karakter"
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_TTL_DAYS=7
BCRYPT_ROUNDS=12

# Server
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000

# SMTP (verifikasi email & reset kata sandi)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email@gmail.com
SMTP_PASS=app-password
SMTP_FROM="Backend UKK <email@gmail.com>"
```

| Variabel | Keterangan |
|----------|------------|
| `DATABASE_URL` | Connection string PostgreSQL / Neon |
| `JWT_SECRET` | Secret penandatangan JWT (minimal 32 karakter) |
| `JWT_EXPIRES_IN` | Masa berlaku access token |
| `REFRESH_TOKEN_TTL_DAYS` | Masa berlaku refresh token dalam hari |
| `BCRYPT_ROUNDS` | Cost factor bcrypt (4-15) |
| `PORT` | Port server |
| `CLIENT_URL` | Dipakai untuk link email verifikasi & reset kata sandi |
| `CORS_ORIGIN` | Origin frontend yang diizinkan mengirim cookie |
| `SMTP_*` | Konfigurasi pengiriman email |

## 🚀 Menjalankan

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Mode development (tsx watch) |
| `npm run build` | Kompilasi TypeScript ke `dist/` |
| `npm start` | Jalankan hasil build |

## 🗄️ Database

| Perintah | Fungsi |
|----------|--------|
| `npx prisma migrate dev` | Jalankan migrasi |
| `npx prisma generate` | Generate Prisma Client |
| `npx prisma validate` | Validasi schema |

> Prisma Client di-generate ke `src/generated/prisma`.

## 🏗️ Arsitektur

Setiap domain berada di `src/modules/<domain>/` dan mengikuti pola berlapis:

```mermaid
flowchart LR
    A[Route] --> B[Controller] --> C[Service] --> D[Repository] --> E[Prisma] --> F[(PostgreSQL)]
```

| Layer | Tanggung jawab |
|-------|----------------|
| **Route** | Definisi endpoint + middleware (auth, role, validasi) |
| **Controller** | Parsing HTTP, memanggil service, mengirim response |
| **Service** | Aturan bisnis (hash password, JWT, token, validasi domain) |
| **Repository** | Interaksi database via Prisma |
| **Prisma** | ORM yang menghasilkan client di `src/generated/prisma` |

Domain saat ini: `auth`, `user`, `event`, `organizer`, dan `admin`. Konfigurasi, middleware, utilitas, serta Prisma adalah shared infrastructure di luar folder module.

## 📚 Dokumentasi API

Swagger UI tersedia di:

```
http://localhost:3000/api-docs
```

Dokumentasi dipecah per section (Auth, Users, Events) di `src/config/swagger/`.
Dokumentasi produk, standar engineering, keamanan, testing, serta runbook tersedia di [`src/docs/`](src/docs/index.md).

> Base path semua endpoint: **`/api/v1`**

## 🔌 Endpoint

### Auth

| Method | Path | Keterangan |
|:------:|------|------------|
| `POST` | `/api/v1/auth/register` | Registrasi akun baru (role `buyer`) |
| `POST` | `/api/v1/auth/login` | Login (`refresh_token` dikirim sebagai cookie) |
| `POST` | `/api/v1/auth/refresh-token` | Refresh access token |
| `POST` | `/api/v1/auth/logout` | Logout (butuh token) |
| `GET` | `/api/v1/auth/me` | Profil pengguna (butuh token) |
| `POST` | `/api/v1/auth/reset-password/request` | Request link reset kata sandi (email) |
| `POST` | `/api/v1/auth/reset-password/confirm` | Konfirmasi reset kata sandi |
| `GET` | `/api/v1/auth/reset-password` | Halaman HTML form reset kata sandi |
| `POST` | `/api/v1/auth/verify-email/request` | Request ulang link verifikasi email |
| `POST` | `/api/v1/auth/verify-email/confirm` | Konfirmasi verifikasi email via API |
| `GET` | `/api/v1/auth/verify-email` | Halaman HTML verifikasi email |

### User

| Method | Path | Akses | Keterangan |
|:------:|------|:-----:|------------|
| `GET` | `/api/v1/users` | 🔒 admin | Daftar semua pengguna |
| `GET` | `/api/v1/users/:id` | 👤 pemilik / admin | Detail pengguna by ID |
| `PUT` | `/api/v1/users/:id` | 👤 pemilik / admin | Update pengguna (role hanya admin) |
| `DELETE` | `/api/v1/users/:id` | 🔒 admin | Hapus pengguna |
| `PATCH` | `/api/v1/users/:id/profile` | 👤 pemilik / admin | Update profil (`full_name`) |

### Event

| Method | Path | Akses | Keterangan |
|:------:|------|:-----:|------------|
| `GET` | `/api/v1/events` | Publik | Daftar event dengan pagination & filter (lokasi, tanggal, kategori, harga) |
| `GET` | `/api/v1/events/:id` | Publik | Detail event & daftar jenis tiket aktif |

### Organizer

Semua endpoint berikut memerlukan JWT dengan role `organizer`; akses data juga dibatasi ke organizer pemilik festival.

| Method | Path | Keterangan |
|:------:|------|------------|
| `GET`, `POST` | `/api/v1/organizer/event` | Daftar (pagination) dan buat festival |
| `GET`, `PATCH`, `DELETE` | `/api/v1/organizer/event/:id` | CRUD festival; festival bertiket terjual tidak dapat dihapus |
| `GET` | `/api/v1/organizer/event/:id/tickets` | Daftar tiket pada festival |
| `GET` | `/api/v1/organizer/event/:id/sales` | Monitoring order paid, tiket terjual, pendapatan, dan kuota per tipe tiket |
| `POST` | `/api/v1/organizer/tickets` | Buat tipe tiket dan kuota |
| `GET`, `PATCH`, `DELETE` | `/api/v1/organizer/tickets/:id` | CRUD tiket dan manajemen kuota; kuota tidak boleh kurang dari penjualan |

### Admin

Semua endpoint berikut memerlukan JWT dengan role `admin`. Perubahan status dan approval dicatat pada `audit_logs`.

| Method | Path | Keterangan |
|:------:|------|------------|
| `PUT` | `/api/v1/admin/event/:id/approve` | Menyetujui event `pending_review` dan mempublikasikannya |
| `GET` | `/api/v1/admin/users` | Daftar pengguna dengan pagination serta filter `search`, `role`, dan `is_active` |
| `PATCH` | `/api/v1/admin/users/:id/status` | Mengaktifkan/menonaktifkan akun melalui body `{ "is_active": boolean }` |
| `GET` | `/api/v1/admin/organizers` | Daftar organizer dengan pagination dan filter status |
| `PATCH` | `/api/v1/admin/organizers/:id/status` | Memperbarui status organizer (`pending`, `verified`, `rejected`, `suspended`) |
| `GET` | `/api/v1/admin/dashboard` | Ringkasan user, organizer, event, pending approval, order paid, pendapatan, dan order terbaru |
| `GET` | `/api/v1/admin/transaction-logs` | Log order/pembayaran dengan pagination dan filter status/rentang tanggal |

## 📨 Format Response

**Sukses**

```json
{
  "success": true,
  "code": "OK",
  "status": 200,
  "message": "Success",
  "data": {}
}
```

**Error**

```json
{
  "success": false,
  "code": "UNAUTHORIZED",
  "status": 401,
  "message": "Email Atau Password Salah"
}
```

## 🧪 Testing

```bash
npm test
npm run test:watch
npm run test:coverage
```

Testing memakai Vitest, Supertest, dan `vitest-mock-extended`. Unit test memock Prisma; test HTTP memock singleton Prisma sehingga tidak membutuhkan database atau layanan eksternal. Helper `tests/helpers/prisma.mock.ts` tersedia untuk test repository/unit yang membutuhkan Prisma mock dengan reset otomatis.

## 📝 Changelog

### 2026-11-14 — Admin approval & system monitoring

- Menambahkan modul `admin` dengan akses khusus role admin di prefix `/api/v1/admin`.
- Menambahkan approval event `pending_review` yang mempublikasikan event dan menyimpan jejak audit.
- Menambahkan manajemen status user dan organizer, dashboard monitoring keseluruhan, serta log transaksi order/pembayaran.
- Menambahkan dokumentasi Swagger untuk seluruh endpoint admin.
- Menyamakan struktur controller, service, repository, dan tipe query modul admin dengan konvensi modular proyek.

### 2026-11-13 — Struktur modular per domain

- Memindahkan modul `auth`, `user`, `event`, dan `organizer` ke `src/modules/<domain>/`.
- Mempertahankan alur dependency Route → Controller → Service → Repository → Prisma di dalam setiap module.

### 2026-11-13 — Organizer festival & ticket management

- Menyesuaikan email verifikasi pendaftaran dengan branding Tixo dan tombol aktivasi akun.
- Menambahkan CRUD festival milik organizer pada `/api/v1/organizer/event` beserta pemeriksaan kepemilikan pada service.
- Menambahkan CRUD tiket dan manajemen kuota pada `/api/v1/organizer/tickets`; kuota tidak dapat diturunkan di bawah tiket yang sudah terjual dan entitas yang sudah terjual tidak dapat dihapus.
- Menambahkan monitoring penjualan per festival pada `GET /api/v1/organizer/event/:id/sales`, termasuk order paid, pendapatan, kuota, dan perincian per tipe tiket.

### 2026-11-12 — Security hardening & company documentation

- Menambahkan dokumentasi standar perusahaan di `docs/`: PRD, engineering standards, arsitektur, kontrak API, keamanan, testing, dan runbook.
- Menyimpan dan melakukan lookup token reset password serta verifikasi email dalam bentuk hash; token verifikasi dan reset kini single-use secara atomik, dan reset password mencabut refresh token aktif.
- Memperbaiki form reset password agar memakai base path `/api/v1`, menangani token kosong, dan melakukan HTML escaping terhadap token pada halaman browser.
- Menambahkan validasi path ID numerik, membatasi detail event publik ke event published, dan memindahkan query principal auth ke repository.
- Menambahkan CORS, Helmet, body limit, rate limiting auth, serta dependensi dan lockfile yang diperlukan.

### 2026-11-09 — Automated testing

- Menambahkan konfigurasi Vitest dengan environment Node, coverage V8, serta command `test`, `test:watch`, dan `test:coverage`.
- Menambahkan test HTTP dengan Supertest dan unit test service dengan repository mock.
- Menambahkan helper Prisma mock berbasis `vitest-mock-extended` dengan reset otomatis per test.

### Prisma client output & request logger

- Output Prisma Client dipindah ke `src/generated/prisma`; `src/config/database.ts` dihapus dan digantikan singleton `src/lib/prisma.ts`.
- Semua modul (`index`, repository, middleware, types) diarahkan ke `src/lib/prisma.ts` agar hanya ada satu instance Prisma Client.
- Folder lama `prisma/generated` dihapus dan `.gitignore` disesuaikan (`/src/generated/prisma`, `dist`).
- Menambahkan middleware `requestLogger` yang otomatis mencatat setiap endpoint yang di-hit (method, URL, status, durasi).
- Menambahkan script database di `package.json`: `db:generate`, `db:validate`, `db:migrate`, `db:deploy`, `db:studio`.

### API v1 & integrasi Swagger

- Semua endpoint dipindah ke prefix `/api/v1`.
- Menambahkan Swagger UI (`/api-docs`) dengan dokumentasi lengkap per section (Auth, Users).
- Menyatukan route email-verification & password-reset ke dalam `auth.route.ts`.
- Menambahkan `CLIENT_URL` untuk link email verifikasi & reset kata sandi.
- Menyesuaikan timeout koneksi database (30s) untuk kompatibilitas Neon serverless.
- Menghapus kontroler terpisah `email-verification` & `password-reset` (digabung ke `AuthController`).

### 2026-09-17 — Auth refactor

- Refactor auth ke pola berlapis: `Controller → UserService → AuthRepository → Prisma`.
- Pemisahan tanggung jawab: controller hanya menangani HTTP, service menjalankan business rules, repository menjadi satu-satunya pintu ke database.
- `AuthRepository` menyediakan operasi lengkap: `findAll`, `findById`, `findByUsername`, `findByEmail`, `create`, `update`, `delete`, serta `createBuyerUser`, `createRefreshToken`, `findRefreshToken`, `revokeRefreshToken`, `revokeAllUserRefreshTokens`.
- `UserService` memiliki metode `getAll`, `getById`, `register`, `login`, `getProfile`, `refresh`, `logout`.

### 2026-09-17 — Schema database

- Menambahkan schema Prisma lengkap untuk master data, autentikasi, organizer, event, ticketing, cart, order, pembayaran, ticket check-in, dan sistem pendukung.
- Menambahkan enum status untuk organizer, event, tiket, order, pembayaran, notifikasi, audit, dan gender.
- Memperbaiki primary key, foreign key, relasi, indeks, serta field nullable sesuai rancangan database.
- Menambahkan migrasi awal `20260917030615_init_full_schema`.
- Menghasilkan Prisma Client ke `src/generated/prisma`.

### 2026-11-08 — Event list & detail endpoints

- Menambahkan modul `event` mengikuti pola berlapis: `Route → Controller → Service → Repository → Prisma`.
- `GET /api/v1/events`: daftar event dengan pagination (`page`, `limit` maks 100) dan filter opsional (`search`, `location`, `date`, `category`, `min_price`, `max_price`).
- `GET /api/v1/events/:id`: detail event beserta daftar jenis tiket yang aktif.
- File baru: `types/event.ts`, `repositories/event.repository.ts`, `services/event.service.ts`, `controllers/event.controller.ts`, `routes/event.route.ts`, `validations/event.validation.ts`, `config/swagger/event.paths.ts`.
- Route didaftarkan di `src/index.ts` (`/api/v1/events`) dan Swagger tag `Events` ditambahkan di `src/config/swagger.ts`.
