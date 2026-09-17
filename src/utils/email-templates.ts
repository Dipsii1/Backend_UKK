export function verifyEmailTemplate(link: string): string {
  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Verifikasi Email - Backend UKK</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 40px;">
  <div style="background: white; padding: 30px; border-radius: 8px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="color: #333; margin-top: 0;">Verifikasi Email Anda</h2>
    <p>Terima kasih telah mendaftar! Silakan klik tombol di bawah untuk memverifikasi alamat email Anda.</p>
    <p style="text-align: center;">
      <a href="${link}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Verifikasi Email</a>
    </p>
    <p>Link ini akan kadaluarsa dalam 1 jam.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="font-size: 12px; color: #888;">Jika tidak meminta ini, abaikan email ini.</p>
  </div>
</body>
</html>`;
}

export function resetPasswordTemplate(link: string): string {
  return `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Reset Kata Sandi - Backend UKK</title>
</head>
<body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 40px;">
  <div style="background: white; padding: 30px; border-radius: 8px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
    <h2 style="color: #333; margin-top: 0;">Reset Kata Sandi</h2>
    <p>Minta Anda untuk mereset kata sandi. Silakan klik tombol di bawah untuk melanjutkan.</p>
    <p style="text-align: center;">
      <a href="${link}" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Kata Sandi</a>
    </p>
    <p>Link ini akan kadaluarsa dalam 1 jam.</p>
    <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
    <p style="font-size: 12px; color: #888;">Jika tidak meminta ini, abaikan email ini.</p>
  </div>
</body>
</html>`;
}