# Security Checklist

Gunakan sebelum merge fitur sensitif (auth, order, pembayaran, check-in).

## OWASP Top 10 (2021)

| Risiko | Kontrol yang wajib diterapkan di API ini |
|---|---|
| A01 Broken Access Control | Gunakan `authenticate` lalu `authorize`/`authorizeSelfOrRole` di route; Service wajib memeriksa ownership. |
| A02 Cryptographic Failures | Password memakai bcrypt; JWT secret dan kredensial hanya dari environment; token reset/verifikasi disimpan sebagai hash. HTTPS/TLS wajib di terminasi oleh deployment. |
| A03 Injection | Validasi seluruh input dengan Zod dan gunakan Prisma parameterized query; dilarang memakai `$queryRawUnsafe` dengan input pengguna. |
| A04 Insecure Design | Dokumentasikan aturan bisnis, gunakan transaksi atomik untuk stok/order/pembayaran, dan tambahkan test atas aturan keamanan. |
| A05 Security Misconfiguration | Helmet, CORS allowlist, batas ukuran body, rate limit global/API auth, dan header `X-Powered-By` dinonaktifkan. |
| A06 Vulnerable and Outdated Components | Jalankan `npm audit` dan perbarui dependensi yang memiliki temuan HIGH atau CRITICAL sebelum rilis. |
| A07 Identification and Authentication Failures | Access token singkat, refresh token dapat dicabut, pemeriksaan akun aktif/email terverifikasi, serta rate limit untuk endpoint auth. |
| A08 Software and Data Integrity Failures | Commit `package-lock.json`, review perubahan dependency, dan jangan menjalankan artefak/dependency yang tidak tepercaya. |
| A09 Security Logging and Monitoring Failures | Catat request dan audit action sensitif tanpa password, token, atau PII; pantau respons 401/403/429/5xx. |
| A10 Server-Side Request Forgery (SSRF) | Jangan melakukan request server-side ke URL yang berasal dari pengguna tanpa allowlist, validasi DNS/IP, dan pembatasan redirect. |

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
- [ ] Cart menggunakan reservasi ber-expiry; add/update cart dan checkout memakai transaksi `Serializable` serta row lock berparameter pada tipe tiket.
- [ ] Checkout memvalidasi ulang event published, periode penjualan, masa reservasi, dan kuota sebelum order dibuat.
- [ ] Pembuatan order dan perubahan order menjadi expired dicatat di `audit_logs`.
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
