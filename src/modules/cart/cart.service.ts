import { CartRepository } from "./cart.repository.js";
import { ConflictError, NotFoundError } from "../../utils/app-error.js";
import type { CartItemInput, CheckoutInput } from "./cart.types.js";

const serializeCart = (cart: Awaited<ReturnType<CartRepository["getCart"]>>) => {
  if (!cart) return { items: [], subtotal: 0 };

  const locks = new Map(cart.locks.map((lock) => [lock.ticket_type_id.toString(), lock.expires_at]));
  const items = cart.items.map((item) => ({
    id: item.id,
    ticket_type_id: item.ticket_type_id,
    quantity: item.quantity,
    unit_price: Number(item.unit_price),
    subtotal: Number(item.subtotal),
    lock_expires_at: locks.get(item.ticket_type_id.toString()) ?? null,
    ticket_type: {
      id: item.ticketType.id,
      name: item.ticketType.name,
      event: item.ticketType.event,
    },
  }));

  return {
    id: cart.id,
    public_id: cart.public_id,
    items,
    subtotal: items.reduce((total, item) => total + item.subtotal, 0),
  };
};

export class CartService {
  constructor(private readonly cartRepo: CartRepository = new CartRepository()) {}

  async getCart(userId: bigint) {
    return serializeCart(await this.cartRepo.getCart(userId));
  }

  async setItem(userId: bigint, input: CartItemInput) {
    const result = await this.cartRepo.upsertItem(userId, input.ticket_type_id, input.quantity);
    if (result.reason === "not_found") throw new NotFoundError("Tipe tiket tidak ditemukan");
    if (result.reason === "unavailable") throw new ConflictError("Tiket tidak tersedia untuk dijual");
    if (result.reason === "max_purchase") {
      throw new ConflictError(`Maksimal pembelian tiket ini adalah ${result.maxPurchase}`);
    }
    if (result.reason === "sold_out") throw new ConflictError("Kuota tiket tidak mencukupi");

    return { cart: await this.getCart(userId), lock_expires_at: result.expiresAt };
  }

  async removeItem(userId: bigint, ticketTypeId: bigint) {
    const removed = await this.cartRepo.removeItem(userId, ticketTypeId);
    if (!removed) throw new NotFoundError("Item keranjang tidak ditemukan");
  }

  async checkout(userId: bigint, input: CheckoutInput) {
    const result = await this.cartRepo.checkout(userId, input.voucher_code);
    if (result.reason === "empty") throw new ConflictError("Keranjang kosong");
    if (result.reason === "lock_expired") {
      throw new ConflictError("Reservasi tiket telah berakhir, perbarui keranjang Anda");
    }
    if (result.reason === "unavailable") throw new ConflictError("Tiket tidak lagi tersedia");
    if (result.reason === "invalid_voucher") throw new ConflictError("Voucher tidak valid atau tidak dapat digunakan");
    return result.order;
  }
}
