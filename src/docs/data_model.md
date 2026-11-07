# Data Model

Sumber kebenaran: `prisma/schema.prisma`. Dokumen ini ringkasan; jika berbeda, schema yang benar.

## Domain
| Area | Cakupan |
|---|---|
| Master data & auth | user, role, gender, refresh token |
| Organizer & event | organizer, event |
| Ticketing | tipe tiket, tiket, ticket check-in |
| Transaksi | cart, order, pembayaran |
| Pendukung | notifikasi, audit log |

Migration awal: `20260917030615_init_full_schema`.

## Enum Status
Organizer, event, tiket, order, pembayaran, notifikasi, audit, gender — semua enum Prisma. Jangan memakai string bebas untuk status.

## Aturan Schema
- PK, FK, relasi, indeks, dan nullable harus konsisten dengan rancangan database.
- Indeks untuk FK dan kolom yang sering difilter (status, tanggal event).
- Soft delete hanya jika ada kebutuhan bisnis; jika dipakai, konsisten di semua tabel terkait.
- Jangan simpan password/token mentah; simpan hash.

## Migration
```bash
npx prisma migrate dev --name <nama_perubahan>
npx prisma generate
npx prisma validate
```
- Perubahan schema = migration baru. Jangan edit migration lama.
- `migrate reset`, `DROP`, `TRUNCATE` butuh persetujuan manual.
- Production memakai `npx prisma migrate deploy`.

## Alur Status
Sumber: `specs/ticket-flow.md`. Selaraskan dengan enum di `schema.prisma`.
```
Event:       draft → pending review → approved/published | rejected
Order:       pending → paid | failed | expired | cancelled
Pembayaran:  pending → success | failed | expired
Tiket:       dibuat saat paid → valid → used | cancelled
```
- Tiket baru dibuat **setelah** pembayaran berhasil (satu tiket per unit, kode unik + QR).
- Order menyimpan nomor pesanan unik, harga, diskon, biaya layanan, pajak, total.