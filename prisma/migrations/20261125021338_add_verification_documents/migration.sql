-- CreateEnum
CREATE TYPE "OrganizerDocumentType" AS ENUM ('business_entity', 'nib', 'npwp', 'pic_ktp');

-- CreateEnum
CREATE TYPE "EventDocumentType" AS ENUM ('cooperation_agreement', 'venue_permit', 'crowd_permit', 'artist_confirmation', 'liability_statement');

-- DropForeignKey
ALTER TABLE "seat_maps" DROP CONSTRAINT "seat_maps_event_id_fkey";

-- DropForeignKey
ALTER TABLE "seat_reservations" DROP CONSTRAINT "seat_reservations_cart_id_fkey";

-- DropForeignKey
ALTER TABLE "seat_reservations" DROP CONSTRAINT "seat_reservations_order_id_fkey";

-- DropForeignKey
ALTER TABLE "seat_reservations" DROP CONSTRAINT "seat_reservations_seat_id_fkey";

-- DropForeignKey
ALTER TABLE "seat_reservations" DROP CONSTRAINT "seat_reservations_user_id_fkey";

-- DropForeignKey
ALTER TABLE "seat_sections" DROP CONSTRAINT "seat_sections_seat_map_id_fkey";

-- DropForeignKey
ALTER TABLE "seat_sections" DROP CONSTRAINT "seat_sections_ticket_type_id_fkey";

-- DropForeignKey
ALTER TABLE "seats" DROP CONSTRAINT "seats_seat_map_id_fkey";

-- DropForeignKey
ALTER TABLE "seats" DROP CONSTRAINT "seats_section_id_fkey";

-- DropForeignKey
ALTER TABLE "seats" DROP CONSTRAINT "seats_ticket_type_id_fkey";

-- DropForeignKey
ALTER TABLE "tickets" DROP CONSTRAINT "tickets_seat_id_fkey";

-- AlterTable
ALTER TABLE "seats" ALTER COLUMN "public_id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "organizer_documents" (
    "id" BIGSERIAL NOT NULL,
    "organizer_id" BIGINT NOT NULL,
    "type" "OrganizerDocumentType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "organizer_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_documents" (
    "id" BIGSERIAL NOT NULL,
    "event_id" BIGINT NOT NULL,
    "type" "EventDocumentType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "event_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizer_documents_organizer_id_type_key" ON "organizer_documents"("organizer_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "event_documents_event_id_type_key" ON "event_documents"("event_id", "type");

-- AddForeignKey
ALTER TABLE "organizer_documents" ADD CONSTRAINT "organizer_documents_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "organizers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_documents" ADD CONSTRAINT "event_documents_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "seats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_maps" ADD CONSTRAINT "seat_maps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_sections" ADD CONSTRAINT "seat_sections_seat_map_id_fkey" FOREIGN KEY ("seat_map_id") REFERENCES "seat_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_sections" ADD CONSTRAINT "seat_sections_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_seat_map_id_fkey" FOREIGN KEY ("seat_map_id") REFERENCES "seat_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "seat_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_ticket_type_id_fkey" FOREIGN KEY ("ticket_type_id") REFERENCES "ticket_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_reservations" ADD CONSTRAINT "seat_reservations_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "seats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_reservations" ADD CONSTRAINT "seat_reservations_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_reservations" ADD CONSTRAINT "seat_reservations_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_reservations" ADD CONSTRAINT "seat_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
