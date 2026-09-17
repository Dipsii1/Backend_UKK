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

## Changelog

### 2026-09-17

- Menambahkan schema Prisma lengkap untuk master data, autentikasi, organizer, event, ticketing, cart, order, pembayaran, ticket check-in, dan sistem pendukung.
- Menambahkan enum status untuk organizer, event, tiket, order, pembayaran, notifikasi, audit, dan gender.
- Memperbaiki primary key, foreign key, relasi, indeks, serta field nullable sesuai rancangan database.
- Menambahkan migrasi awal `20260917030615_init_full_schema`.
- Menghasilkan Prisma Client ke `src/generated/prisma`.
