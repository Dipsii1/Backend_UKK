# Security Checklist

Gunakan sebelum merge fitur sensitif (auth, order, pembayaran, check-in).

## A. Autentikasi
- [ ] Password di-hash (bcrypt/argon2), tidak pernah plaintext/di-log
- [ ] JWT secret dari env, access token berumur pendek
- [ ] Refresh token tersimpan di DB, bisa di-revoke (single & semua device)
- [ ] Logout me-revoke refresh token
- [ ] Rate limit pada login/register/refresh
- [ ] Token reset password dan verifikasi email disimpan sebagai hash, expired, dan hanya dipakai sekali
- [ ] Reset password me-revoke seluruh refresh token aktif user

## B. Otorisasi
- [ ] Role dicek di middleware Route
- [ ] Ownership dicek di Service (cegah IDOR): user hanya akses order/tiket sendiri, organizer hanya event sendiri
- [ ] Endpoint admin/organizer tidak bisa diakses role lain
- [ ] Endpoint publik hanya mengembalikan event berstatus `published` dan `is_published = true`

## C. Input & Injection
- [ ] Input divalidasi di Controller sebelum ke Service
- [ ] Tidak ada `$queryRawUnsafe` dengan input user
- [ ] Limit pagination dibatasi maksimum
- [ ] Ukuran body dibatasi

## D. Integritas Transaksi
- [ ] Pembelian tiket, order, pembayaran dalam `$transaction`
- [ ] Stok dicek dan dikurangi atomik (cegah overselling)
- [ ] Callback/konfirmasi pembayaran idempoten (aman diulang)
- [ ] Check-in: tiket belum dipakai, order paid, event sesuai — satu transaksi

## E. Data & Logging
- [ ] Response tidak berisi password/hash/refresh token
- [ ] Log tanpa PII, token, atau password
- [ ] Aksi sensitif masuk audit log
- [ ] Stack trace tidak bocor ke client di production

## F. Konfigurasi
- [ ] `.env` di `.gitignore`, tidak ada secret di repo
- [ ] CORS allowlist, security headers (helmet)
- [ ] `npm audit` tanpa HIGH/CRITICAL

## Gate
- **PASS**: boleh merge.
- **FAIL**: ada HIGH/CRITICAL → wajib diperbaiki.
- **PASS WITH FINDINGS**: hanya LOW/MEDIUM, dokumentasikan risk acceptance.
