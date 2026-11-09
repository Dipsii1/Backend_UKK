# Architecture

## Gambaran
Backend REST API (Node.js 22+, TypeScript, Prisma, PostgreSQL/Neon) dengan arsitektur berlapis. Base path `/api/v1`, Swagger di `/api-docs`.

## Alur Request

```
Client → Route → Controller → Service → Repository → Prisma → PostgreSQL
```

| Layer | Tanggung jawab | Dilarang |
|---|---|---|
| Route | Mapping endpoint, middleware auth/role, Swagger annotation | Business logic |
| Controller | Parse request, validasi input, kirim response | Akses Prisma, business rules |
| Service | Business rules, orkestrasi repository, transaksi | Akses `req`/`res` |
| Repository | Query Prisma, mapping hasil | Business rules, HTTP |

## Aturan Dependency
- Arah: `routes → controllers → services → repositories → prisma`.
- Tidak boleh terbalik dan tidak boleh melompati layer.
- Prisma hanya dipanggil dari Repository.
- Prisma Client hasil generate ada di `src/generated/prisma` (jangan diedit).

## Acuan Implementasi: Auth
```
Controller → UserService → UserRepository → Prisma
```
Fitur baru mengikuti pola ini: Repository → Service → Controller → Route.

## Transaksi
Operasi yang mengubah lebih dari satu tabel terkait stok/order/pembayaran/check-in dijalankan di `prisma.$transaction` dan dikoordinasikan oleh Service (repository menerima transaction client).

## Keputusan Arsitektur
| Keputusan | Alasan |
|---|---|
| Layered, bukan modul penuh | Sederhana untuk skala project, mudah di-test |
| Repository sebagai satu-satunya pintu DB | Mudah di-mock, query terpusat |
| Prisma + Neon PostgreSQL | Type-safe, migrasi terkelola, serverless |
| Status via enum Prisma | Cegah nilai status tidak valid |