import type { z } from "zod";
import type { midtransNotificationSchema } from "./payment.validation.js";

export type MidtransNotification = z.output<typeof midtransNotificationSchema>;

export type PaymentStatusValue = "pending" | "settlement" | "expired" | "failed" | "cancelled" | "refunded";
export type OrderStatusValue = "pending" | "paid" | "expired" | "cancelled" | "refunded";

export interface PaymentTarget {
  payment: PaymentStatusValue;
  order: OrderStatusValue;
}

export interface PayableOrder {
  status: string;
  total: { toString(): string } | number;
  expired_at: Date | null;
}

// Aturan bisnis pembayaran dimiliki service; repository memanggilnya di dalam transaksi.
export interface PaymentRules {
  isPayable(order: PayableOrder, now: Date): boolean;
  grossAmount(order: PayableOrder): number;
  canTransition(from: PaymentStatusValue, to: PaymentStatusValue): boolean;
}

export type NotificationResult = "applied" | "unchanged" | "ignored" | "late_settlement";
