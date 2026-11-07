# Testing

## Status
Belum ada test framework yang ditetapkan. Rekomendasi: **Vitest** (TS native) + **supertest** untuk integration.

## Strategi
| Level | Target | Cara |
|---|---|---|
| Unit | Service | Mock Repository, tanpa DB |
| Integration | Controller + route | supertest + database test terpisah |
| Manual | Alur end-to-end (beli tiket → bayar → check-in) | Swagger UI / Postman |

## Siklus (Red → Green → Refactor)
1. Tulis daftar behavior (input → expected output) dengan nilai konkret.
2. Tulis satu test yang gagal karena alasan yang benar.
3. Implementasi minimum agar lulus.
4. Refactor sambil test tetap hijau.

## Aturan
- Jangan test yang hanya mengecek "tidak throw".
- Jangan ubah assertion lama demi lulus; perbaiki implementasi.
- Database test terpisah dari dev/production (jangan pakai Neon production).
- Prioritas test: auth, otorisasi/ownership, order & pembayaran, check-in.

## Verifikasi Minimum Sebelum Commit
```bash
npx tsc --noEmit
npx prisma validate
```
Tambahkan perintah test begitu framework terpasang.