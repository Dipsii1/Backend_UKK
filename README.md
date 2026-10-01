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
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server
NODE_ENV=development
PORT=3000
CLIENT_URL=http://localhost:3000/api/v1

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
| `JWT_ACCESS_EXPIRES_IN` | Masa berlaku access token |
| `JWT_REFRESH_EXPIRES_IN` | Masa berlaku refresh token |
| `PORT` | Port server |
| `CLIENT_URL` | Dipakai untuk link email verifikasi & reset kata sandi |
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

Alur request mengikuti pola berlapis:

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

## 📚 Dokumentasi API

Swagger UI tersedia di:

```
http://localhost:3000/api-docs
```

Dokumentasi dipecah per section (Auth, Users) di `src/config/swagger/`.

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

## 📝 Changelog

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