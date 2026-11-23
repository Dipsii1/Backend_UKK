CREATE TYPE "SeatStatus" AS ENUM ('available', 'held', 'sold', 'blocked');

CREATE TABLE "seat_maps" (
  "id" BIGSERIAL PRIMARY KEY,
  "event_id" BIGINT NOT NULL UNIQUE REFERENCES "events"("id") ON DELETE CASCADE,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3)
);

CREATE TABLE "seat_sections" (
  "id" BIGSERIAL PRIMARY KEY,
  "seat_map_id" BIGINT NOT NULL REFERENCES "seat_maps"("id") ON DELETE CASCADE,
  "ticket_type_id" BIGINT REFERENCES "ticket_types"("id") ON DELETE SET NULL,
  "label" TEXT NOT NULL,
  "x" INTEGER NOT NULL,
  "y" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE "seats" (
  "id" BIGSERIAL PRIMARY KEY,
  "public_id" TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  "seat_map_id" BIGINT NOT NULL REFERENCES "seat_maps"("id") ON DELETE CASCADE,
  "section_id" BIGINT REFERENCES "seat_sections"("id") ON DELETE SET NULL,
  "ticket_type_id" BIGINT REFERENCES "ticket_types"("id") ON DELETE SET NULL,
  "label" TEXT NOT NULL,
  "row_label" TEXT,
  "seat_number" INTEGER,
  "x" INTEGER NOT NULL,
  "y" INTEGER NOT NULL,
  "width" INTEGER NOT NULL DEFAULT 32,
  "height" INTEGER NOT NULL DEFAULT 32,
  "status" "SeatStatus" NOT NULL DEFAULT 'available',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3),
  UNIQUE ("seat_map_id", "label")
);

CREATE TABLE "seat_reservations" (
  "id" BIGSERIAL PRIMARY KEY,
  "seat_id" BIGINT NOT NULL UNIQUE REFERENCES "seats"("id") ON DELETE CASCADE,
  "cart_id" BIGINT REFERENCES "carts"("id") ON DELETE CASCADE,
  "order_id" BIGINT REFERENCES "orders"("id") ON DELETE SET NULL,
  "user_id" BIGINT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3)
);

ALTER TABLE "tickets" ADD COLUMN "seat_id" BIGINT UNIQUE REFERENCES "seats"("id");

CREATE INDEX "seat_sections_seat_map_id_idx" ON "seat_sections"("seat_map_id");
CREATE INDEX "seat_sections_ticket_type_id_idx" ON "seat_sections"("ticket_type_id");
CREATE INDEX "seats_seat_map_id_status_idx" ON "seats"("seat_map_id", "status");
CREATE INDEX "seats_section_id_idx" ON "seats"("section_id");
CREATE INDEX "seats_ticket_type_id_idx" ON "seats"("ticket_type_id");
CREATE INDEX "seat_reservations_cart_id_idx" ON "seat_reservations"("cart_id");
CREATE INDEX "seat_reservations_order_id_idx" ON "seat_reservations"("order_id");
CREATE INDEX "seat_reservations_user_id_expires_at_idx" ON "seat_reservations"("user_id", "expires_at");
