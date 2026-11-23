export type CheckInInput = {
  event_id: bigint;
  qr_token: string;
};

export type CheckInReason =
  | "ok"
  | "wrong_event"
  | "not_open"
  | "closed"
  | "unpaid"
  | "cancelled"
  | "expired"
  | "duplicate";

export type CheckInWindow = {
  eventId: bigint;
  opensAt: Date;
  closesAt: Date;
};

export type ScannableTicket = {
  status: "issued" | "checked_in" | "cancelled" | "expired";
  order: { status: string };
  ticketType: { event_id: bigint };
};

// Aturan validasi dimiliki service; repository memanggilnya di dalam transaksi setelah tiket di-lock.
export type CheckInRules = {
  verify(ticket: ScannableTicket, window: CheckInWindow, now: Date): CheckInReason;
};
