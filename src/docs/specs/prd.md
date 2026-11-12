# PRD — Platform Ticketing Festival UKK 2026

## Tujuan

Menyediakan API untuk menemukan festival, membeli tiket secara aman, menerima e-ticket setelah pembayaran tervalidasi, dan melakukan check-in QR saat acara.

## Aktor

| Aktor | Kemampuan utama |
|---|---|
| Guest | Melihat, mencari, memfilter, dan membaca detail festival yang dipublikasikan |
| Buyer | Registrasi, verifikasi email, login, checkout, bayar, dan melihat tiket |
| Organizer | Mengelola event, informasi, kuota, dan penjualan event miliknya |
| Admin | Menyetujui/menolak event serta mengelola data administratif |
| Petugas check-in | Memvalidasi QR ticket pada event yang ditugaskan |

## Alur bisnis utama

1. Guest membuka homepage, mencari atau memfilter event, lalu melihat detail event publik.
2. Saat memilih beli tiket, guest harus login atau mendaftar dan memverifikasi email.
3. Buyer memilih tipe dan jumlah tiket. Sistem memvalidasi periode jual, kuota, batas pembelian, harga, voucher, biaya, dan total.
4. Checkout membuat order `pending` dengan snapshot harga. Stok, order, dan pembayaran diproses atomik untuk mencegah overselling.
5. Callback payment gateway idempoten mengubah payment dan order menjadi `paid`.
6. Hanya order `paid` yang menerbitkan satu e-ticket unik dan QR token untuk setiap unit tiket.
7. Check-in memastikan tiket milik event yang benar, order paid, dan belum dipakai; lalu mencatat scan secara atomik.

## Aturan produk

- Hanya event `published` dan `is_published = true` terlihat oleh guest.
- Harga dan kuota pada order adalah snapshot saat checkout.
- Tiket tidak sah, dibatalkan, atau telah check-in harus ditolak.
- Organizer hanya mengelola event miliknya; buyer hanya mengakses order/tiket miliknya.

## Scope rilis backend saat ini

Tersedia: autentikasi, user dasar, browsing event publik, Swagger, dan fondasi schema domain. Endpoint order, payment, ticket, check-in, serta organizer belum diimplementasikan secara lengkap.
