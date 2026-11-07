# Docs Index — UKK 2026 Backend

Titik masuk dokumentasi. Baca `AGENTS.md` di root dulu, lalu dokumen di bawah sesuai kebutuhan.

| Dokumen | Isi | Kapan dibaca |
|---|---|---|
| [architecture.md](architecture.md) | Layer, alur request, aturan dependency | Sebelum menambah fitur/layer |
| [data-model.md](data-model.md) | Domain, enum, aturan schema, migration | Sebelum ubah `schema.prisma` |
| [security.md](security.md) | Checklist keamanan (auth, IDOR, transaksi) | Sebelum merge fitur sensitif |
| [testing.md](testing.md) | Strategi test, verifikasi sebelum commit | Saat menulis test |
| [runbook.md](runbook.md) | Setup, perintah, troubleshooting | Saat setup/deploy/debug |
| [api/conventions.md](api/conventions.md) | Format response, status code, pagination, Swagger | Sebelum membuat endpoint |
| [specs/_template.md](specs/_template.md) | Template spec per fitur | Sebelum mengerjakan fitur baru |
| [specs/auth.md](specs/auth.md) | Spec autentikasi | Saat menyentuh auth |
| [specs/ticket-flow.md](specs/ticket-flow.md) | Alur browsing → order → bayar → e-ticket → check-in | Saat menyentuh event/order/payment/ticket |

## Aturan Docs
- Perubahan behavior/arsitektur → update dokumen terkait di PR yang sama.
- Fitur baru → buat `specs/<fitur>.md` dari template sebelum implementasi.
- Dokumen singkat dan faktual. Hindari duplikasi dengan `AGENTS.md` dan `README.md`.