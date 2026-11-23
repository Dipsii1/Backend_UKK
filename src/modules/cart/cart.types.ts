export interface CartItemInput {
  ticket_type_id: bigint;
  quantity: number;
}

export interface CheckoutInput {
  voucher_code?: string;
}

export interface SellableTicket {
  status: string;
  sale_start_at: Date | null;
  sale_end_at: Date | null;
  event: {
    status: string;
    is_published: boolean;
    sales_start_at: Date | null;
    sales_end_at: Date | null;
    end_at: Date;
  };
}

export interface VoucherSnapshot {
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_discount: number | null;
  quota: number | null;
  is_active: boolean;
  start_at: Date | null;
  end_at: Date | null;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  service_fee: number;
  tax: number;
  total: number;
}

// Aturan bisnis cart dimiliki service; repository memanggilnya di dalam transaksi.
export interface CartRules {
  lockMinutes: number;
  isSellable(ticket: SellableTicket, now: Date): boolean;
  isVoucherUsable(voucher: VoucherSnapshot, usage: { total: number; byUser: number }, now: Date): boolean;
  calculateTotals(items: { price: number; quantity: number }[], voucher: VoucherSnapshot | null): OrderTotals;
}
