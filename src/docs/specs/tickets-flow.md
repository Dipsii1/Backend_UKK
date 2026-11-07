# Spec: Alur Penjualan Tiket Festival

Sumber: dokumen `alur_tiket_konser.docx`. Alur end-to-end dari browsing sampai check-in.

## Aktor
| Aktor | Hak |
|---|---|
| Guest | Lihat homepage, daftar/cari/filter festival, detail festival (tanpa login) |
| Customer | Guest + beli tiket, checkout, bayar, lihat My Tickets |
| Organizer | Buat/kelola festival, jenis tiket, harga, kuota, periode penjualan; lihat data penjualan & peserta festival miliknya |
| Admin | Setujui/tolak event organizer |
| Petugas check-in | Scan QR tiket saat festival (tentukan: role khusus atau organizer/admin) |

## Alur Utama
```
Guest → Homepage → Detail Festival → Beli Tiket → cek login
→ (belum login: Login/Daftar) → pilih tiket + jumlah → Checkout
→ Order dibuat → Pembayaran (payment gateway) → konfirmasi berhasil
→ Order & Pembayaran = paid → E-Ticket + QR Code dibuat
→ Datang ke festival → Scan QR → Validasi → Check-in
```

## Tahapan & Aturan Bisnis

### 1–2. Browsing (publik, tanpa auth)
- Endpoint list/detail event bersifat **publik**.
- Hanya event yang **disetujui admin dan dipublikasikan** yang tampil.
- Detail: poster, deskripsi, tanggal, lokasi, jadwal, jenis tiket (harga, kuota), organizer, FAQ, ketentuan.
- List mendukung pencarian, filter, pagination.

### 3–4. Auth
- Beli tiket wajib login; guest diarahkan Login/Daftar lalu lanjut.

### 5. Checkout
- Pilih jenis tiket + jumlah.
- Validasi: event published, periode penjualan aktif, kuota cukup.
- Hitung: harga tiket, biaya layanan, diskon/voucher (jika ada), pajak (jika dipakai) → total.

### 6. Order
- Buat order dengan **nomor pesanan unik**.
- Simpan: user, tiket & jumlah, harga, diskon, biaya layanan, pajak, total.
- Status awal: pending.
- Pengecekan kuota dan pembuatan order dalam **satu transaksi** (cegah overselling).

### 7–8. Pembayaran
- Via payment gateway; order belum selesai sebelum pembayaran terkonfirmasi.
- Konfirmasi lewat **webhook/callback** gateway: verifikasi signature, **idempoten**.
- Berhasil → status pembayaran dan order = paid → lanjut buat tiket.
- Pembayaran gagal/kedaluwarsa → order tidak paid, kuota dikembalikan.

### 9. E-Ticket
- Satu tiket per unit yang dibeli, masing-masing punya **kode tiket unik** dan **QR Code**.
- Dibuat setelah paid, dalam transaksi yang sama dengan update status.
- Customer melihat tiket di **My Tickets** (hanya milik sendiri).

### 10–12. Check-in
Validasi saat scan:
1. QR/kode tiket ditemukan
2. Tiket valid (tidak dibatalkan) dan order paid
3. Tiket sesuai event
4. Belum pernah digunakan

- Valid → catat waktu check-in, status tiket = sudah digunakan, izinkan masuk.
- Tidak valid (tidak ditemukan / sudah dipakai / dibatalkan / status tidak memenuhi) → tolak.
- Cek + update status dalam **satu transaksi atomik** (cegah double check-in).

### 13. Organizer
- CRUD festival miliknya, jenis tiket, harga, kuota, periode penjualan, info event.
- Lihat penjualan dan peserta **hanya untuk event miliknya** (cek ownership).

### 14. Admin
- Review event organizer: setujui atau tolak.
- Hanya event approved + published yang tampil ke Guest/Customer.

## Alur Status (selaraskan dengan enum di `schema.prisma`)
```
Event:       draft → pending review → approved/published | rejected
Order:       pending → paid | failed | expired | cancelled
Pembayaran:  pending → success | failed | expired
Tiket:       dibuat saat paid → valid → used | cancelled
```

## Endpoint (rancangan; sesuaikan dengan route aktual)
| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| GET | /events | - | List event published (search, filter, pagination) |
| GET | /events/:id | - | Detail event + jenis tiket |
| POST | /checkout | Customer | Hitung total (preview) |
| POST | /orders | Customer | Buat order |
| GET | /orders/:id | Customer | Detail order milik sendiri |
| POST | /payments | Customer | Mulai pembayaran |
| POST | /payments/webhook | Signature gateway | Konfirmasi pembayaran |
| GET | /my-tickets | Customer | Daftar e-ticket milik sendiri |
| POST | /tickets/check-in | Petugas/Organizer | Scan & validasi QR |
| POST/PUT | /organizer/events | Organizer | Kelola event |
| GET | /organizer/events/:id/sales | Organizer | Penjualan & peserta |
| PATCH | /admin/events/:id/status | Admin | Setujui/tolak event |

## Test List
| Input | Expected |
|---|---|
| Guest GET /events | 200, hanya event published |
| Guest POST /orders | 401 |
| Checkout jumlah > kuota | 409 |
| Order dibuat | nomor unik, status pending, total benar |
| Webhook paid valid | order & pembayaran paid, tiket + QR dibuat |
| Webhook diulang | tidak membuat tiket ganda |
| Webhook signature salah | ditolak |
| Check-in tiket valid | 200, status used, waktu tercatat |
| Check-in tiket sama dua kali | ditolak |
| Check-in tiket event lain | ditolak |
| Organizer lihat penjualan event orang lain | 403 |
| Admin tolak event | tidak tampil di GET /events |

## Di Luar Scope
- Refund, transfer tiket, resale (tidak ada di alur).