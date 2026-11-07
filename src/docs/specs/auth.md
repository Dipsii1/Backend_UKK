# Spec: Autentikasi

## Tujuan
Registrasi, login, profil, refresh token, dan logout dengan JWT + refresh token di DB.

## Alur
```
Controller → UserService → UserRepository → Prisma
```

## Endpoint (sesuaikan dengan route aktual)
| Method | Path | Auth | Deskripsi |
|---|---|---|---|
| POST | /auth/register | - | Daftar user buyer |
| POST | /auth/login | - | Login, kembalikan access + refresh token |
| GET | /auth/profile | Bearer | Profil user login |
| POST | /auth/refresh | refresh token | Tukar refresh token dengan access token baru |
| POST | /auth/logout | Bearer | Revoke refresh token |

## Aturan Bisnis
- Email dan username unik; duplikat → 409.
- Password di-hash sebelum disimpan.
- Register membuat user dengan role buyer (`createBuyerUser`).
- Refresh token disimpan di DB; logout me-revoke token tersebut; `revokeAllUserRefreshTokens` untuk logout semua device.
- Refresh token yang di-revoke/kedaluwarsa → 401.

## Komponen
- `UserRepository`: `findAll`, `findById`, `findByUsername`, `findByEmail`, `create`, `update`, `delete`, `createBuyerUser`, `createRefreshToken`, `findRefreshToken`, `revokeRefreshToken`, `revokeAllUserRefreshTokens`.
- `UserService`: `getAll`, `getById`, `register`, `login`, `getProfile`, `refresh`, `logout`.

## Test List
| Input | Expected |
|---|---|
| register email baru valid | 201, user dibuat, tanpa password di response |
| register email sudah ada | 409 |
| login password benar | 200, access + refresh token |
| login password salah | 401 |
| refresh token valid | 200, access token baru |
| refresh token revoked | 401 |
| logout | refresh token ter-revoke |

## Keamanan
- Rate limit login/register/refresh.
- Pesan error login tidak membedakan email salah vs password salah.
- Jangan log password/token.