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
SMTP_SECURE=false
SMTP_USER=email@gmail.com
SMTP_PASS=app-password
SMTP_FROM="Tixo <email@gmail.com>"

# Reverse proxy (true hanya jika di belakang proxy/load balancer)
TRUST_PROXY=false

# Midtrans Snap (Sandbox)
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxx
MIDTRANS_IS_PRODUCTION=false
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
| `SMTP_*` | Konfigurasi pengiriman email (`SMTP_SECURE=true` untuk port 465) |
| `TRUST_PROXY` | Percayai `X-Forwarded-For` dari satu proxy (untuk rate limit per IP) |
| `MIDTRANS_SERVER_KEY` | Server Key Midtrans (Snap API + verifikasi `signature_key` webhook). Tanpa ini endpoint pembayaran merespons `503` |
| `MIDTRANS_IS_PRODUCTION` | `false` = Sandbox (`app.sandbox.midtrans.com`), `true` = Production |

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
Postman Collection seluruh endpoint tersedia di [`postman/UKK_2026.postman_collection.json`](postman/UKK_2026.postman_collection.json) dan dapat langsung diimpor ke Postman.

> Base path semua endpoint: **`/api/v1`**

## 🔌 Endpoint

### Health

| Method | Path | Akses | Keterangan |
|:------:|------|:-----:|------------|
| `GET` | `/api/v1/health` | Publik | Status layanan, uptime, dan koneksi database (`200` normal, `503` bila database tidak terjangkau) |

### Auth

| Method | Path | Keterangan |
|:------:|------|------------|
| `POST` | `/api/v1/auth/register` | Registrasi akun baru (role `buyer`) |
| `POST` | `/api/v1/auth/register-organizer` | Registrasi organizer website (role `organizer`, status awal `pending`) |
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
| `GET` | `/api/v1/users` | 🔒 admin | Daftar pengguna (pagination `page`, `limit`) |
| `GET` | `/api/v1/users/:id` | 👤 pemilik / admin | Detail pengguna by ID |
| `PUT` | `/api/v1/users/:id` | 👤 pemilik / admin | Update email (wajib verifikasi ulang) / role (hanya admin, diaudit) |
| `DELETE` | `/api/v1/users/:id` | 🔒 admin | Nonaktifkan pengguna (soft delete, sesi dicabut, diaudit) |
| `PATCH` | `/api/v1/users/:id/profile` | 👤 pemilik / admin | Update profil (`full_name`) |

### Event

| Method | Path | Akses | Keterangan |
|:------:|------|:-----:|------------|
| `GET` | `/api/v1/events` | Publik | Daftar event dengan pagination & filter (lokasi, tanggal, kategori, harga) |
| `GET` | `/api/v1/events/:id` | Publik | Detail event & daftar jenis tiket (kecuali `inactive`) |

### Organizer

Semua endpoint berikut memerlukan JWT dengan role `organizer`; akses data juga dibatasi ke organizer pemilik festival. Operasi tulis (buat/ubah/hapus/ajukan) hanya untuk organizer berstatus `verified`.

Alur status festival: `draft` → (`submit`) → `pending_review` → (admin approve) → `published`. Festival hanya bisa diubah atau dihapus saat berstatus `draft`/`rejected`; setelah diajukan, tiket hanya boleh diubah kuota/statusnya (harga terkunci). Tiket bisa ditambah saat `draft`/`rejected`, dan juga saat `published` (selama festival belum berakhir) untuk membuka **gelombang** baru.

**Gelombang tiket:** setiap tipe tiket punya field `wave` (default `1`) dan jadwal jual sendiri `sale_start_at`/`sale_end_at`. Gelombang berikutnya otomatis terbuka saat **semua** tipe tiket gelombang sebelumnya di festival yang sama habis (`sold >= quota`), nonaktif, atau jadwal jualnya lewat — dan tetap harus berada dalam jadwal jualnya sendiri. Sebelum itu, `PUT` item cart ke gelombang tersebut ditolak `409`. Contoh: `{ "event_id": "1", "name": "Reguler", "wave": 2, "price": 150000, "quota": 200, "sale_start_at": "2026-12-01T00:00:00Z" }`. Daftar tiket diurutkan per gelombang.

| Method | Path | Keterangan |
|:------:|------|------------|
| `GET`, `POST` | `/api/v1/organizer/event` | Daftar (pagination) dan buat festival |
| `GET`, `PATCH`, `DELETE` | `/api/v1/organizer/event/:id` | CRUD festival; festival bertiket terjual atau memiliki order tidak dapat dihapus |
| `POST` | `/api/v1/organizer/event/:id/submit` | Ajukan festival `draft`/`rejected` (minimal satu tipe tiket) untuk direview admin |
| `GET` | `/api/v1/organizer/event/:id/tickets` | Daftar tiket pada festival |
| `GET` | `/api/v1/organizer/event/:id/sales` | Monitoring order paid, tiket terjual, pendapatan, dan kuota per tipe tiket |
| `POST` | `/api/v1/organizer/tickets` | Buat tipe tiket, kuota, dan gelombang (`wave`); bisa saat festival `published` |
| `GET`, `PATCH`, `DELETE` | `/api/v1/organizer/tickets/:id` | CRUD tiket dan manajemen kuota; kuota tidak boleh kurang dari penjualan |

### Cart

Semua endpoint cart memerlukan JWT dengan role `buyer`. Item keranjang menahan kuota tiket selama 15 menit. `max_purchase` dihitung dari keranjang ditambah order `pending`/`paid` milik user.

| Method | Path | Keterangan |
|:------:|------|------------|
| `GET` | `/api/v1/cart` | Keranjang aktif beserta masa berlaku reservasi per item |
| `PUT` | `/api/v1/cart/items` | Tambah atau ubah jumlah item; body: `ticket_type_id`, `quantity` |
| `DELETE` | `/api/v1/cart/items/:ticketTypeId` | Hapus item dan lepaskan reservasi tiket |
| `POST` | `/api/v1/cart/checkout` | Buat order pending dan kalkulasi voucher, admin fee, pajak, serta total |

### Payments

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `POST` | `/api/v1/payments/:orderId` | (buyer, pemilik order) Buat transaksi Midtrans Snap dari order `pending`. Tanpa body: `gross_amount` dihitung server dari total order. Mengembalikan `snap_token` dan `redirect_url`; bila transaksi pending sudah ada, token yang sama dikembalikan (`200`) |
| `POST` | `/api/v1/payments/midtrans/webhook` | (publik, dipanggil Midtrans) HTTP notification. Diverifikasi dengan `signature_key` = SHA512(`order_id`+`status_code`+`gross_amount`+ServerKey) dan `gross_amount` harus sama dengan transaksi tersimpan |

Atur **Payment Notification URL** di Dashboard Midtrans Sandbox ke `https://<host>/api/v1/payments/midtrans/webhook`.

Pemetaan status: `settlement` / `capture` (fraud `accept`) → payment `settlement`, order `paid`, e-ticket terbit; `pending` → tetap pending; `deny`/`failure` → payment `failed`, order `cancelled`; `cancel` → payment `cancelled`, order `cancelled`; `expire` → `expired`; `refund` → `refunded` (tiket `issued` dibatalkan). Order batal/kadaluarsa melepas stok dan voucher. Settlement yang datang setelah order kadaluarsa tidak menerbitkan tiket dan dicatat di audit log (`needs_refund`).

### E-Ticket (Buyer)

Memerlukan JWT role `buyer`. Hanya tiket milik sendiri dari order `paid` yang dikembalikan; tiket buyer lain atau order belum dibayar → `404`.

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `GET` | `/api/v1/me/tickets?page=&limit=` | Daftar e-ticket: event (judul, venue, `gate_open_at`, `start_at`, `end_at`), ticket type, `ticket_code`, status `UNUSED`/`USED`/`CANCELLED`/`EXPIRED`, dan `qr_code` (PNG data URL) |
| `GET` | `/api/v1/me/tickets/:ticketId` | Detail satu e-ticket dengan field yang sama |

E-ticket diterbitkan otomatis saat pembayaran terverifikasi: satu record per unit tiket, dengan `ticket_code` dan `qr_token` acak yang unik. QR hanya berisi `qr_token` (tanpa data pribadi/pembayaran) dan dirender saat diminta, tidak disimpan sebagai file.

### Check-in

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `POST` | `/api/v1/check-in` | (organizer pemilik event yang `verified`, atau admin) body `event_id`, `qr_token`. Sukses → status tiket `USED`, menyimpan `checked_in_at` dan `checked_in_by` |

Jendela check-in dimulai dari `gate_open_at` (atau `start_at` bila kosong) sampai `end_at` event. Validasi gagal tidak mengubah status tiket. Setiap scan dicatat di `ticket_scans` beserta petugas, waktu, event, dan hasilnya.

| HTTP | `code` | Kondisi |
|------|--------|---------|
| `400` | `VALIDATION_ERROR` | Body tidak valid atau format QR salah |
| `403` | `CHECKIN_FORBIDDEN` | Bukan organizer pemilik event, atau organizer belum `verified` |
| `404` | `EVENT_NOT_FOUND` | Event tidak ditemukan |
| `404` | `TICKET_NOT_FOUND` | Token QR tidak dikenal |
| `409` | `WRONG_EVENT` | Tiket untuk event lain |
| `409` | `CHECKIN_NOT_OPEN` / `CHECKIN_CLOSED` | Di luar jendela check-in |
| `409` | `TICKET_UNPAID` | Order belum dibayar |
| `409` | `TICKET_CANCELLED` / `TICKET_EXPIRED` | Tiket dibatalkan atau kadaluarsa |
| `409` | `TICKET_USED` | Tiket sudah dipakai |

### Admin

Semua endpoint berikut memerlukan JWT dengan role `admin`. Perubahan status dan approval dicatat pada `audit_logs`.

| Method | Path | Keterangan |
|:------:|------|------------|
| `PUT` | `/api/v1/admin/event/:id/approve` | Menyetujui event `pending_review` milik organizer `verified` dan mempublikasikannya |
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

### 2026-11-25 — Harga dalam format Rupiah
- Helper `formatRupiah` di `src/utils/currency.ts` (`150000` → `"Rp 150.000"`, tanpa sen).
- Field angka tetap dikirim; ditambah field teks: `price_formatted` pada tipe tiket di endpoint event publik, `unit_price_formatted`/`subtotal_formatted` per item dan `subtotal_formatted` pada cart, serta `subtotal_formatted`, `discount_formatted`, `service_fee_formatted`, `tax_formatted`, `total_formatted` pada response checkout.

### 2026-11-25 — Gelombang otomatis
- Tiket gelombang N baru bisa dimasukkan ke cart setelah semua tipe tiket gelombang < N di festival yang sama habis terjual, nonaktif, atau lewat `sale_end_at` (`cartRules.isWaveOpen`). Jika belum, cart menolak dengan `409` "Gelombang ini belum dibuka".
- Pengecekan ada di transaksi Serializable saat menambah item cart; reservasi yang sudah ada tetap bisa di-checkout.

### 2026-11-25 — Gelombang tiket
- Field baru `ticket_types.wave` (default `1`); migrasi `20261125090000_add_ticket_wave`.
- `POST /organizer/tickets` kini bisa dipakai saat festival `published` (selama belum berakhir) untuk menambah gelombang baru; saat `pending_review` tetap ditolak. Hapus tiket dan ubah harga tetap hanya saat `draft`/`rejected`.
- `wave` ditampilkan di endpoint event publik dan daftar tiket organizer, diurutkan per gelombang. Swagger body tiket kini mencantumkan `wave`, `sale_start_at`, `sale_end_at`.

### 2026-11-24 — Check-in lengkap
- Error code spesifik per kondisi scan: `TICKET_NOT_FOUND`, `WRONG_EVENT`, `CHECKIN_NOT_OPEN`, `CHECKIN_CLOSED`, `TICKET_UNPAID`, `TICKET_CANCELLED`, `TICKET_EXPIRED`, `TICKET_USED`, `CHECKIN_FORBIDDEN`, `EVENT_NOT_FOUND`.
- Jendela check-in: `gate_open_at` (atau `start_at`) sampai `end_at` event.
- Format `qr_token` divalidasi (43 karakter base64url) sebelum menyentuh database.
- Migrasi `20261124120000_add_checkin_audit`: kolom `tickets.checked_in_by` dan `ticket_scans.event_id`.
- Test untuk setiap kondisi scan, termasuk bahwa validasi gagal tidak mengubah status tiket.

### 2026-11-24 — E-ticket, QR, dan check-in
- E-ticket diterbitkan saat order menjadi PAID: satu record per unit, `ticket_code` (UUID acak) dan `qr_token` (32 byte acak) unik. Tabel `tickets` kini berelasi langsung ke `orders` dan `ticket_types`, dengan kolom `sequence` dan constraint unik `(order_item_id, sequence)`; penerbitan memakai `skipDuplicates` sehingga webhook yang diproses ulang tidak menambah tiket.
- Migrasi `20261124090000_add_eticket_relations` (backfill `order_id`, `ticket_type_id`, `sequence` untuk baris lama).
- Module baru `ticket`: `GET /api/v1/me/tickets` dan `GET /api/v1/me/tickets/:ticketId` (buyer, hanya order PAID, QR sebagai PNG data URL dari `qr_token`).
- Module baru `check-in`: `POST /api/v1/check-in` memvalidasi token, event, status order, dan status tiket dalam satu transaksi dengan row lock; scan dicatat ke `ticket_scans`, check-in sukses ke audit log.
- Dependency baru `qrcode`. Test baru di `tests/eticket.test.ts`.
- Belum termasuk: pengiriman e-ticket lewat email (subtask terpisah).

### 2026-11-23 — Konsistensi gaya kode antar module
- Semua module mengikuti gaya `auth`: handler controller bertipe `(req: Request, res: Response)`, service dibuat dengan repository eksplisit, tanpa helper `getUserId`/`getIdParam`.
- Validasi body dipindah dari controller ke `validate(schema)` di route untuk `admin`, `organizer`, `cart`, dan `payment`; validasi query tetap `parseSchema` di controller.
- Route `organizer`, `cart`, dan `payment` memakai `router.use(authenticate, authorize(...))` dan pengelompokan komentar seperti `auth`/`admin`.
- Tipe input organizer dipindah ke `organizer.types.ts`; `interface` di `cart.types.ts` dan `payment.types.ts` diganti `export type`.
- `AdminRepository` dirapikan menjadi query multiline dan `tx: Prisma.TransactionClient` eksplisit (tanpa perubahan logika).
- Catatan perilaku: pada route `organizer` dan `cart`, autentikasi kini dicek sebelum validasi ID, sehingga request tanpa token dengan ID tidak valid mendapat `401` (sebelumnya `400`).

### 2026-11-23 — Pembayaran Midtrans Snap (Sandbox)
- Module baru `payment`: `POST /api/v1/payments/:orderId` membuat transaksi Snap dari order `pending` milik buyer. `order_id` = `order_number`, `gross_amount` dihitung server (total order dibulatkan ke rupiah), dan expiry Snap disamakan dengan `expired_at` order. Baris order di-lock agar tidak ada transaksi ganda; bila Midtrans gagal, slot payment dihapus agar bisa dicoba lagi.
- `POST /api/v1/payments/midtrans/webhook`: verifikasi `signature_key` (timing-safe), cocokkan `gross_amount`, simpan setiap notifikasi ke `payment_logs`, lalu perbarui payment + order + stok + tiket dalam satu transaksi `Serializable`. Transisi status hanya maju (pending → final, settlement → refunded), jadi notifikasi duplikat tidak mengubah apa pun.
- E-ticket (`tickets`) diterbitkan hanya saat pembayaran terverifikasi (settlement / capture accept).
- Migrasi `20261123090000_add_midtrans_payment`: enum `PaymentStatus` + `cancelled`, kolom `snap_token`, `redirect_url`, dan `transaction_id` diganti nama menjadi `provider_transaction_id` (unik).
- `CartRepository`: helper `runSerializable`, `lockTicketType`, dan `releasePendingOrder` diekspor untuk dipakai ulang oleh module payment (perilaku cart tidak berubah).
- Env baru `MIDTRANS_SERVER_KEY`, `MIDTRANS_IS_PRODUCTION`; Swagger tag Payments; folder Payments di Postman.

### 2026-11-23 — Health check
- Endpoint publik `GET /api/v1/health` (module `health`) untuk uptime monitor / load balancer: mengecek koneksi database dengan `SELECT 1`, mengembalikan `200` bila normal dan `503` bila database tidak terjangkau. Detail error database tidak dibocorkan.

### 2026-11-23 — Perbaikan bug & konsistensi
- **Alur event**: endpoint baru `POST /organizer/event/:id/submit` (`draft`/`rejected` → `pending_review`); sebelumnya event tidak pernah bisa dipublikasikan. Event yang sudah diajukan/published tidak bisa diubah; harga tiket terkunci.
- **Keamanan token**: access & refresh token kini membawa klaim `type`; refresh token tidak lagi diterima sebagai access token (dan sebaliknya). Token lama tanpa `type` harus login ulang.
- **Organizer**: operasi tulis mewajibkan status `verified`; approve admin juga menolak organizer yang belum terverifikasi.
- **Error handling**: kode status validasi menjadi `400` (sesuai konvensi); error Prisma P2002/P2003 → `409`, P2025 → `404`, P2034 → `409`; JSON rusak → `400`, body terlalu besar → `413`; route tak dikenal → JSON `404`.
- **Cart**: khusus role `buyer`; cek periode jual event dan `end_at`; `max_purchase` lintas order; voucher dikembalikan saat order expired; retry otomatis untuk konflik transaksi Serializable; aturan bisnis (sellable, voucher, total) dipindah ke service.
- **User**: validasi body `PUT /users/:id` dan `PATCH /users/:id/profile`; ganti email mewajibkan verifikasi ulang dan mencabut sesi; perubahan role diaudit; `GET /users` berpagination; `DELETE /users/:id` menjadi soft delete (sebelumnya selalu gagal karena foreign key).
- **Organizer delete**: hapus event/tiket ikut membersihkan item cart; ditolak `409` bila sudah ada order.
- **Lainnya**: verifikasi email atomik; halaman reset password diperbaiki; token one-time tidak lagi tercatat di log request; `SMTP_SECURE` dan `REFRESH_TOKEN_TTL_DAYS` dipakai konsisten; rate limit per IP + opsi `TRUST_PROXY`; filter `date` divalidasi; nilai Decimal (uang) selalu dikirim sebagai number; helper validasi & `paginationSchema` disatukan di `src/utils/validation.ts`.

### 2026-11-22 — Cart, ticket locking, dan checkout order

- Menambahkan modul `cart` pada `/api/v1/cart`: melihat keranjang, menambah/memperbarui item, menghapus item, dan checkout.
- Penambahan item membuat reservasi tiket sementara selama 15 menit melalui tabel `ticket_locks`; item yang dihapus atau kadaluarsa tidak lagi menahan kuota.
- Checkout memakai Prisma interactive transaction ber-isolasi `Serializable` dan row lock PostgreSQL (`FOR UPDATE`) untuk tipe tiket serta voucher. Stok hanya ditambah untuk order pending yang berhasil dibuat; order pending yang kadaluarsa dilepas secara aman pada transaksi cart/checkout berikutnya.
- Checkout menghitung dan menyimpan snapshot `subtotal`, diskon voucher, admin fee Rp5.000, PPN 11%, dan `total`; voucher divalidasi untuk masa aktif, kuota global, dan satu kali penggunaan per user.
- Menambahkan migrasi `20261122093000_add_ticket_locks` dan dokumentasi Swagger untuk endpoint Cart.
- Menyelaraskan struktur modul Cart dengan modul lain: route → controller → service → repository, pola parsing validasi controller, dan middleware per endpoint.
- Merapikan gaya `CartRepository` agar mengikuti repository lain: pemanggilan Prisma, transaction client eksplisit, dan query multiline yang mudah ditinjau.
- Menyamakan gaya file Cart lainnya (service, route, dan Swagger) dengan pola modul yang telah ada tanpa mengubah kontrak endpoint.
- Menambahkan pemeriksaan ulang periode penjualan saat checkout, nomor order berbasis UUID kriptografis, dan audit untuk pembuatan maupun expiry order.

### 2026-11-22 — OWASP Top 10 baseline

- Menambahkan kontrol baseline OWASP Top 10: pembatasan request global API, pembatasan algoritme JWT ke HS256, validasi klaim JWT, pengamanan error autentikasi, pembersihan bucket rate limit, dan penghapusan header `X-Powered-By`.
- Menambahkan pemetaan kontrol OWASP Top 10 di `src/docs/security.md`.

### 2026-11-22 — Middleware authentication & authorization

- Mengganti nama middleware menjadi `authenticate`, `authorize`, dan `authorizeSelfOrRole` agar peran autentikasi, otorisasi role, serta otorisasi kepemilikan lebih jelas.

### 2026-11-21 — Pendaftaran organizer

- Menambahkan `POST /api/v1/auth/register-organizer` untuk pendaftaran langsung dari website sebagai role `organizer` dengan status `pending`.
- Pendaftaran organizer membuat user, profil, organisasi, dan token verifikasi email dalam satu transaksi database; organizer harus verifikasi email dan menunggu persetujuan admin.

### 2026-11-21 — Build reliability

- Memperbaiki script `npm run build` agar menggunakan konfigurasi TypeScript yang tersedia (`tsconfig.json`), sehingga build produksi menghasilkan output `dist/`.

### 2026-11-14 — Admin approval & system monitoring

- Menambahkan modul `admin` dengan akses khusus role admin di prefix `/api/v1/admin`.
- Menambahkan approval event `pending_review` yang mempublikasikan event dan menyimpan jejak audit.
- Menambahkan manajemen status user dan organizer, dashboard monitoring keseluruhan, serta log transaksi order/pembayaran.
- Menambahkan dokumentasi Swagger untuk seluruh endpoint admin.
- Menyamakan struktur controller, service, repository, dan tipe query modul admin dengan konvensi modular proyek.
- Menambahkan Postman Collection JSON untuk seluruh endpoint Auth, User, Event, Organizer, dan Admin.

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
