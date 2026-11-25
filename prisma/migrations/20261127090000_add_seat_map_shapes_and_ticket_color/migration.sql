-- CreateEnum
CREATE TYPE "SeatShapeType" AS ENUM ('stage', 'standing', 'entrance', 'exit', 'booth', 'toilet', 'bar', 'text', 'rect', 'circle');

-- AlterTable
ALTER TABLE "ticket_types" ADD COLUMN     "color" TEXT;

-- CreateTable
CREATE TABLE "seat_map_shapes" (
    "id" BIGSERIAL NOT NULL,
    "seat_map_id" BIGINT NOT NULL,
    "type" "SeatShapeType" NOT NULL,
    "label" TEXT,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "seat_map_shapes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seat_map_shapes_seat_map_id_idx" ON "seat_map_shapes"("seat_map_id");

-- AddForeignKey
ALTER TABLE "seat_map_shapes" ADD CONSTRAINT "seat_map_shapes_seat_map_id_fkey" FOREIGN KEY ("seat_map_id") REFERENCES "seat_maps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

