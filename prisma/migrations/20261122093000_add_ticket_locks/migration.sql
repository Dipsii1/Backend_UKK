-- Temporary reservations are held per cart and expire automatically during cart/checkout operations.
CREATE TABLE "ticket_locks" (
    "id" BIGSERIAL NOT NULL,
    "cart_id" BIGINT NOT NULL,
    "ticket_type_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "ticket_locks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cart_items_cart_id_ticket_type_id_key" ON "cart_items"("cart_id", "ticket_type_id");
CREATE UNIQUE INDEX "ticket_locks_cart_id_ticket_type_id_key" ON "ticket_locks"("cart_id", "ticket_type_id");
CREATE INDEX "ticket_locks_ticket_type_id_expires_at_idx" ON "ticket_locks"("ticket_type_id", "expires_at");
CREATE INDEX "ticket_locks_expires_at_idx" ON "ticket_locks"("expires_at");

ALTER TABLE "ticket_locks" ADD CONSTRAINT "ticket_locks_cart_id_fkey"
  FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ticket_locks" ADD CONSTRAINT "ticket_locks_ticket_type_id_fkey"
  FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
