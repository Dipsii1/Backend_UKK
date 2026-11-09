# Testing

## Status
Testing memakai **Vitest** + `@vitest/coverage-v8`, **Supertest** untuk endpoint HTTP, dan **vitest-mock-extended** untuk mock Prisma pada unit test.

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

## Perintah
```bash
npm test
npm run test:watch
npm run test:coverage
```

Konfigurasi test berada di `vitest.config.ts`; test berada di `tests/**/*.test.ts` atau `src/**/*.test.ts`. Helper `tests/helpers/prisma.mock.ts` mereset Prisma mock otomatis setiap test.

## Verifikasi Minimum Sebelum Commit
```bash
npx tsc --noEmit
npx prisma validate
npm test
npm run test:coverage
```

Target coverage minimum untuk controller dan service adalah 80%.