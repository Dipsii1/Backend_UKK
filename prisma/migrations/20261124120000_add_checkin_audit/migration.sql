-- Check-in: petugas yang memindai tiket dan event tempat scan dilakukan.
ALTER TABLE "tickets" ADD COLUMN "checked_in_by" BIGINT;
CREATE INDEX "tickets_checked_in_by_idx" ON "tickets"("checked_in_by");
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_checked_in_by_fkey"
  FOREIGN KEY ("checked_in_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ticket_scans" ADD COLUMN "event_id" BIGINT;
CREATE INDEX "ticket_scans_event_id_idx" ON "ticket_scans"("event_id");
ALTER TABLE "ticket_scans" ADD CONSTRAINT "ticket_scans_event_id_fkey"
  FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
