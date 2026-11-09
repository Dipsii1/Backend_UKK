# Runbook

## Setup Lokal
```bash
npm install
cp .env.example .env   # atau buat manual
```
`.env`:
```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
# JWT_SECRET, JWT_REFRESH_SECRET, PORT — sesuaikan dengan kode
```

```bash
npx prisma migrate dev
npx prisma generate
```
Jalankan server dengan script dev di `package.json` (tsx watch).

## Perintah Umum
| Tujuan | Perintah |
|---|---|
| Migrasi dev | `npx prisma migrate dev` |
| Migrasi production | `npx prisma migrate deploy` |
| Generate client | `npx prisma generate` |
| Validasi schema | `npx prisma validate` |
| Lihat data | `npx prisma studio` |
| Typecheck | `npx tsc --noEmit` |

## Troubleshooting
| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `@prisma/client` / import generated error | Client belum digenerate | `npx prisma generate` |
| Tidak bisa konek DB | `DATABASE_URL` salah / Neon sleep | Cek env, coba ulang koneksi |
| Migration drift | Schema DB beda dengan migration | Review; jangan `reset` di data penting |
| 401 terus-menerus | Token kedaluwarsa / secret beda | Cek env JWT, gunakan refresh |

## Deploy (Checklist)
- [ ] Env production terisi (DB, JWT secrets)
- [ ] `npx prisma migrate deploy`
- [ ] Build & start sesuai script
- [ ] Swagger dibatasi/dimatikan di production jika perlu
- [ ] Smoke test: login, list event, buat order