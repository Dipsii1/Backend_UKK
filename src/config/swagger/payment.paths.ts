const auth = [{ bearerAuth: [] }];

const ok = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          code: { type: "string" },
          status: { type: "integer" },
          message: { type: "string" },
          data: {},
        },
      },
    },
  },
});

export const paymentPaths = {
  "/payments/{orderId}": {
    post: {
      tags: ["Payments"],
      security: auth,
      summary: "Buat transaksi Midtrans Snap dari order pending milik buyer",
      description:
        "Tanpa body. gross_amount dihitung server dari total order (dibulatkan ke rupiah). Snap kadaluarsa bersamaan dengan order. Bila transaksi pending sudah ada, token yang sama dikembalikan (200).",
      parameters: [{ name: "orderId", in: "path", required: true, schema: { type: "string", example: "1" } }],
      responses: {
        "201": ok("Transaksi dibuat: payment_id, order_number, gross_amount, snap_token, redirect_url, expired_at"),
        "200": ok("Transaksi pending sudah ada"),
        "401": ok("Belum login"),
        "403": ok("Khusus role buyer"),
        "404": ok("Order tidak ditemukan / bukan milik pengguna"),
        "409": ok("Order bukan pending, sudah kadaluarsa, atau transaksi sedang diproses"),
        "502": ok("Midtrans gagal membuat transaksi"),
        "503": ok("MIDTRANS_SERVER_KEY belum dikonfigurasi"),
      },
    },
  },
  "/payments/midtrans/webhook": {
    post: {
      tags: ["Payments"],
      summary: "HTTP notification Midtrans (tanpa JWT, diverifikasi dengan signature_key)",
      description:
        "signature_key = SHA512(order_id + status_code + gross_amount + ServerKey). gross_amount harus sama dengan transaksi tersimpan. settlement/capture(accept) → PAID + e-ticket terbit; pending → tetap PENDING; deny/failure → FAILED + order CANCELLED; cancel → CANCELLED; expire → EXPIRED; refund → REFUNDED. Gagal/kadaluarsa melepas stok dan voucher. Setiap notifikasi terverifikasi disimpan di payment_logs; notifikasi duplikat tidak mengubah status.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["order_id", "status_code", "gross_amount", "signature_key", "transaction_status"],
              properties: {
                order_id: { type: "string", example: "ORD-3f1c..." },
                status_code: { type: "string", example: "200" },
                gross_amount: { type: "string", example: "116550.00" },
                signature_key: { type: "string" },
                transaction_status: { type: "string", example: "settlement" },
                fraud_status: { type: "string", example: "accept" },
                transaction_id: { type: "string" },
                payment_type: { type: "string", example: "bank_transfer" },
              },
            },
          },
        },
      },
      responses: {
        "200": ok("Diproses: data.result = applied | unchanged | ignored | late_settlement"),
        "400": ok("Payload tidak valid atau gross_amount tidak cocok"),
        "403": ok("Signature tidak valid"),
        "404": ok("Transaksi tidak ditemukan"),
      },
    },
  },
} as const;
