# API Conventions

Base path: `/api/v1` — Swagger: `/api-docs`

## Response
Ikuti format yang sudah dipakai di controller yang ada. Struktur yang disarankan:

Sukses:
```json
{ "success": true, "message": "OK", "data": {} }
```
Error:
```json
{ "success": false, "message": "Deskripsi error", "errors": [] }
```
List dengan pagination:
```json
{ "success": true, "data": [], "meta": { "page": 1, "limit": 10, "total": 0 } }
```

## Status Code
| Code | Arti |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | No content |
| 400 | Validasi gagal |
| 401 | Belum autentikasi |
| 403 | Tidak punya hak |
| 404 | Tidak ditemukan |
| 409 | Konflik (duplikat, stok habis) |
| 500 | Error server |

## Aturan
- Tiap endpoint punya anotasi Swagger (request, response, auth).
- Validasi input di Controller sebelum Service.
- Pagination: `page`, `limit` (limit maksimum dibatasi).
- Auth: header `Authorization: Bearer <accessToken>`.
- Jangan kembalikan password, hash, atau refresh token mentah.
- Penamaan route: jamak & kebab-case (`/events`, `/ticket-types`).
- Breaking change → update Swagger dan info ke konsumen API.