# Engineering Standards

## Aturan implementasi

- Gunakan dependency `route → controller → service → repository → Prisma`; Prisma hanya diakses oleh repository.
- Controller menangani HTTP dan validasi; service menangani aturan bisnis; repository menangani query.
- Setiap domain baru berada di `src/modules/<domain>/`; route tetap didaftarkan pada bootstrap di `src/index.ts` dan memiliki dokumentasi Swagger.
- Gunakan enum Prisma untuk status; perubahan schema selalu melalui migration baru.
- Jangan mengedit generated client, migration lama, `.env`, atau `node_modules`.

## Standar perubahan

1. Baca layer, schema, dan dokumen yang terkait sebelum mengubah kode.
2. Implementasikan dari repository ke route dan tambahkan test behavior yang berubah.
3. Perbarui README, dokumen di `src/docs`, dan `AGENTS.md` bila behavior atau aturan berubah.
4. Jalankan typecheck, validasi Prisma, test, dan coverage sebelum merge.

## Kualitas dan keamanan

- Validasi input dan parameter path sebelum konversi tipe.
- Password dan token persisten disimpan sebagai hash; token single-use harus dikonsumsi atomik.
- Gunakan transaksi untuk operasi multi-tabel dan conditional update untuk state yang hanya boleh berubah sekali.
- Jangan menulis secret, PII, password, atau token ke log.
- Gunakan Conventional Commits, misalnya `fix: secure password reset token consumption`.
