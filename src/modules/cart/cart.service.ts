import { CartRepository } from "./cart.repository.js";
import { ConflictError, NotFoundError } from "../../utils/app-error.js";
import { formatRupiah } from "../../utils/currency.js";
import type { CartItemInput, CartRules, CheckoutInput } from "./cart.types.js";

const TAX_RATE = 0.11;
const SERVICE_FEE = 5000;

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const withinWindow = (start: Date | null, end: Date | null, now: Date) =>
  (start === null || start <= now) && (end === null || end >= now);

export const cartRules: CartRules = {
  lockMinutes: 15,

  isSellable(ticket, now) {
    return (
      ticket.status === "active" &&
      ticket.event.status === "published" &&
      ticket.event.is_published &&
      ticket.event.end_at > now &&
      withinWindow(ticket.sale_start_at, ticket.sale_end_at, now) &&
      withinWindow(ticket.event.sales_start_at, ticket.event.sales_end_at, now)
    );
  },

  // Gelombang terbuka bila semua tiket gelombang sebelumnya habis, nonaktif, atau jadwal jualnya lewat.
  isWaveOpen(previousWaves, now) {
    return previousWaves.every(
      (ticket) =>
        ticket.status !== "active" ||
        ticket.sold >= ticket.quota ||
        (ticket.sale_end_at !== null && ticket.sale_end_at < now),
    );
  },

  isVoucherUsable(voucher, usage, now) {
    return (
      voucher.is_active &&
      withinWindow(voucher.start_at, voucher.end_at, now) &&
      (voucher.quota === null || usage.total < voucher.quota) &&
      usage.byUser === 0
    );
  },

  calculateTotals(items, voucher) {
    const subtotal = money(items.reduce((total, item) => total + item.price * item.quantity, 0));
    const rawDiscount = !voucher
      ? 0
      : voucher.discount_type === "percentage"
        ? (subtotal * voucher.discount_value) / 100
        : voucher.discount_value;
    // max_discount null = tanpa batas; 0 berarti benar-benar 0.
    const discount = money(Math.min(rawDiscount, voucher?.max_discount ?? Infinity, subtotal));
    const taxable = money(subtotal - discount + SERVICE_FEE);
    const tax = money(taxable * TAX_RATE);
    return { subtotal, discount, service_fee: SERVICE_FEE, tax, total: money(taxable + tax) };
  },
};

const serializeCart = (cart: Awaited<ReturnType<CartRepository["getCart"]>>) => {
  if (!cart) return { items: [], subtotal: 0, subtotal_formatted: formatRupiah(0) };

  const locks = new Map(cart.locks.map((lock) => [lock.ticket_type_id.toString(), lock.expires_at]));
  const items = cart.items.map((item) => ({
    id: item.id,
    ticket_type_id: item.ticket_type_id,
    quantity: item.quantity,
    unit_price: Number(item.unit_price),
    subtotal: Number(item.subtotal),
    unit_price_formatted: formatRupiah(item.unit_price),
    subtotal_formatted: formatRupiah(item.subtotal),
    lock_expires_at: locks.get(item.ticket_type_id.toString()) ?? null,
    ticket_type: {
      id: item.ticketType.id,
      name: item.ticketType.name,
      event: item.ticketType.event,
    },
  }));

  const subtotal = items.reduce((total, item) => total + item.subtotal, 0);
  return {
    id: cart.id,
    public_id: cart.public_id,
    items,
    subtotal,
    subtotal_formatted: formatRupiah(subtotal),
  };
};

export class CartService {
  constructor(private readonly cartRepo: CartRepository = new CartRepository(cartRules)) {}

  async getCart(userId: bigint) {
    return serializeCart(await this.cartRepo.getCart(userId));
  }

  async setItem(userId: bigint, input: CartItemInput) {
    const result = await this.cartRepo.upsertItem(userId, input.ticket_type_id, input.quantity);
    if (result.reason === "not_found") throw new NotFoundError("Tipe tiket tidak ditemukan");
    if (result.reason === "unavailable") throw new ConflictError("Tiket tidak tersedia untuk dijual");
    if (result.reason === "wave_locked") throw new ConflictError("Gelombang ini belum dibuka, gelombang sebelumnya belum habis");
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
    if (result.reason === "max_purchase") {
      throw new ConflictError(`Maksimal pembelian tiket ini adalah ${result.maxPurchase}`);
    }
    return result.order;
  }
}
