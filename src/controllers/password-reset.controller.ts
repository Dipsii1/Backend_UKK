import type { Request, Response } from "express";

export class PasswordResetController {
  static resetPage = (req: Request, res: Response) => {
    const token = req.query.token as string;
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Reset Kata Sandi</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h2>Reset Kata Sandi</h2>
        <form id="resetForm" style="max-width: 400px; margin: 0 auto;">
          <input type="hidden" name="token" value="${token}" />
          <div style="margin-bottom: 10px;">
            <input type="password" name="newPassword" placeholder="Kata sandi baru" required minlength="8" 
                   style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px;" />
          </div>
          <button type="submit" style="background: #dc3545; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">
            Reset Kata Sandi
          </button>
        </form>
        <script>
          document.getElementById('resetForm').onsubmit = async function(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            const res = await fetch('/api/auth/reset-password/confirm', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: formData.token, newPassword: formData.newPassword.value })
            });
            const data = await res.json();
            alert(data.message);
            if (res.ok) window.location.href = '${process.env.CLIENT_URL || 'http://localhost:3000'}';
          };
        </script>
        <p style="margin-top: 20px;"><a href="${process.env.CLIENT_URL || 'http://localhost:3000'}">Batal</a></p>
      </body>
      </html>
    `);
  };
}