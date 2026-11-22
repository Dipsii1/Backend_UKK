export interface CartItemInput {
  ticket_type_id: bigint;
  quantity: number;
}

export interface CheckoutInput {
  voucher_code?: string;
}
