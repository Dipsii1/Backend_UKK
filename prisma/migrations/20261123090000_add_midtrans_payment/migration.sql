-- Midtrans Snap: status cancelled, Snap token/redirect URL, dan id transaksi provider yang unik.
ALTER TYPE "PaymentStatus" ADD VALUE 'cancelled' BEFORE 'refunded';

ALTER TABLE "payments" RENAME COLUMN "transaction_id" TO "provider_transaction_id";
ALTER TABLE "payments" ADD COLUMN "snap_token" TEXT,
ADD COLUMN "redirect_url" TEXT;

CREATE UNIQUE INDEX "payments_provider_transaction_id_key" ON "payments"("provider_transaction_id");
