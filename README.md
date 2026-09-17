# UKK 2026 Backend

Backend API untuk aplikasi manajemen event dan ticketing UKK 2026.

## Prasyarat

- Node.js 22+
- PostgreSQL

## Instalasi

```bash
npm install
```

Buat `.env` dan isi koneksi PostgreSQL:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
```

## Database

```bash
npx prisma migrate dev
npx prisma generate
```

Validasi schema:

```bash
npx prisma validate
```

## Arsitektur

Alur request mengikuti pola berlapis:

```
Controller  →  UserService  →  UserRepository  →  Prisma  →  PostgreSQL
```

- **Controller**: parsing HTTP, validasi input, mengirim response.
- **Service**: business rules (hash password, JWT, aturan domain).
- **Repository**: interaksi database via Prisma, dapat di-mock untuk unit test.
- **Prisma**: ORM yang menghasilkan client di `src/generated/prisma`.

## Changelog

### 2026-09-17 (auth refactor)

- Refactor auth ke pola berlapis: Controller → UserService → UserRepository → Prisma.
- Memisahkan tanggung jawab: controller hanya menangani HTTP; service menjalankan business rules; repository menjadi satu-satunya pintu ke database.
- Membuat `UserRepository` dengan metode `findByEmail`, `findById`, `createBuyerUser`, `createRefreshToken`, `findRefreshToken`, `revokeRefreshToken`, dan `revokeAllUserRefreshTokens`.
- Refactor `UserService` (auth service) untuk mengikuti pola `Controller → UserService → UserRepository → Prisma`.
- `UserRepository` kini menyediakan semua operasi CRUD lengkap: `findAll`, `findById`, `findByUsername`, `findByEmail`, `create`, `update`, `delete`.
- `UserService` memiliki metode `getAll`, `getById`, `register`, `login`, `getProfile`, `refresh`, `logout`.

### 2026-09-17

- Menambahkan schema Prisma lengkap untuk master data, autentikasi, organizer, event, ticketing, cart, order, pembayaran, ticket check-in, dan sistem pendukung.
- Menambahkan enum status untuk organizer, event, tiket, order, pembayaran, notifikasi, audit, dan gender.
- Memperbaiki primary key, foreign key, relasi, indeks, serta field nullable sesuai rancangan database.
- Menambahkan migrasi awal `20260917030615_init_full_schema`.
- Menghasilkan Prisma Client ke `src/generated/prisma`.
