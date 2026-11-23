-- E-ticket: relasi langsung ke order & ticket type, plus nomor urut per order item untuk mencegah penerbitan ganda.
ALTER TABLE "tickets" ADD COLUMN "order_id" BIGINT,
ADD COLUMN "ticket_type_id" BIGINT,
ADD COLUMN "sequence" INTEGER;

UPDATE "tickets" AS t
SET "order_id" = oi."order_id", "ticket_type_id" = oi."ticket_type_id"
FROM "order_items" AS oi
WHERE oi."id" = t."order_item_id";

UPDATE "tickets" AS t
SET "sequence" = s."rn"
FROM (SELECT "id", ROW_NUMBER() OVER (PARTITION BY "order_item_id" ORDER BY "id") AS "rn" FROM "tickets") AS s
WHERE s."id" = t."id";

ALTER TABLE "tickets" ALTER COLUMN "order_id" SET NOT NULL,
ALTER COLUMN "ticket_type_id" SET NOT NULL,
ALTER COLUMN "sequence" SET NOT NULL;

CREATE UNIQUE INDEX "tickets_order_item_id_sequence_key" ON "tickets"("order_item_id", "sequence");
CREATE INDEX "tickets_order_id_idx" ON "tickets"("order_id");
CREATE INDEX "tickets_ticket_type_id_idx" ON "tickets"("ticket_type_id");

ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ticket_type_id_fkey"
  FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
