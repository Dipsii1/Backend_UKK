import { PaymentRepository } from "./payment.repository.js";
import { midtrans } from "../../utils/midtrans.js";
import { emitToAll, emitToUser } from "../../lib/socket.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../utils/app-error.js";
import type { MidtransNotification, PaymentRules, PaymentStatusValue, PaymentTarget } from "./payment.types.js";

// Snap minimal 20 detik; beri ruang 1 menit agar pembeli sempat membayar sebelum order kadaluarsa.
const MIN_PAY_WINDOW_MS = 60_000;

const TRANSITIONS: Partial<Record<PaymentStatusValue, PaymentStatusValue[]>> = {
  pending: ["settlement", "failed", "cancelled", "expired"],
  settlement: ["refunded"],
};

const toCents = (value: { toString(): string } | number) => Math.round(Number(value.toString()) * 100);

export const paymentRules: PaymentRules = {
  isPayable(order, now) {
    return (
      order.status === "pending" &&
      order.expired_at !== null &&
      order.expired_at.getTime() - now.getTime() >= MIN_PAY_WINDOW_MS
    );
  },

  // shortcut: Midtrans IDR hanya menerima integer, total dibulatkan ke rupiah; ubah cartRules agar total bulat jika selisih ini jadi masalah.
  grossAmount(order) {
    return Math.round(Number(order.total.toString()));
  },

  canTransition(from, to) {
    return TRANSITIONS[from]?.includes(to) ?? false;
  },
};

export const mapMidtransStatus = (notification: MidtransNotification): PaymentTarget | null => {
  switch (notification.transaction_status) {
    case "settlement":
      return notification.status_code === "200" ? { payment: "settlement", order: "paid" } : null;
    case "capture":
      // Capture kartu hanya sah bila lolos fraud detection; "challenge" masih menunggu review.
      if (notification.status_code !== "200") return null;
      return notification.fraud_status === "accept"
        ? { payment: "settlement", order: "paid" }
        : { payment: "pending", order: "pending" };
    case "pending":
      return { payment: "pending", order: "pending" };
    case "deny":
    case "failure":
      return { payment: "failed", order: "cancelled" };
    case "cancel":
      return { payment: "cancelled", order: "cancelled" };
    case "expire":
      return { payment: "expired", order: "expired" };
    case "refund":
      return { payment: "refunded", order: "refunded" };
    default:
      return null; // partial_refund, authorize, dll: dicatat saja.
  }
};

type Reserved = Extract<Awaited<ReturnType<PaymentRepository["reserve"]>>, { payment: unknown }>;

const serialize = (payment: Reserved["payment"], order: Reserved["order"]) => ({
  payment_id: payment.public_id,
  order_id: order.id,
  order_number: order.order_number,
  gross_amount: Number(payment.gross_amount),
  status: payment.status,
  snap_token: payment.snap_token,
  redirect_url: payment.redirect_url,
  expired_at: order.expired_at,
});

export class PaymentService {
  constructor(
    private readonly paymentRepo: PaymentRepository = new PaymentRepository(paymentRules),
    private readonly gateway: Pick<typeof midtrans, "createSnapTransaction" | "isValidSignature"> = midtrans,
  ) {}

  async createTransaction(userId: bigint, orderId: bigint) {
    const result = await this.paymentRepo.reserve(orderId, userId);
    if (result.reason === "not_found") throw new NotFoundError("Order tidak ditemukan");
    if (result.reason === "not_payable") throw new ConflictError("Order tidak dapat dibayar atau sudah kadaluarsa");

    const { order, payment, now } = result;
    if (result.reason === "exists") {
      if (!payment.snap_token) throw new ConflictError("Transaksi pembayaran sedang diproses");
      return { created: false, data: serialize(payment, order) };
    }

    let snap;
    try {
      snap = await this.gateway.createSnapTransaction({
        orderId: order.order_number,
        grossAmount: Number(payment.gross_amount),
        expiresAt: order.expired_at!,
        now,
      });
    } catch (error) {
      // Lepas slot agar pembeli bisa mencoba lagi.
      await this.paymentRepo.deletePayment(payment.id);
      throw error;
    }

    const saved = await this.paymentRepo.saveSnap(payment.id, snap);
    return { created: true, data: serialize(saved, order) };
  }

  async handleNotification(notification: MidtransNotification) {
    const { order_id, status_code, gross_amount, signature_key } = notification;
    if (!this.gateway.isValidSignature(order_id, status_code, gross_amount, signature_key)) {
      throw new ForbiddenError("Signature notifikasi tidak valid");
    }

    const payment = await this.paymentRepo.findByOrderNumber(order_id);
    if (!payment) throw new NotFoundError("Transaksi pembayaran tidak ditemukan");

    if (toCents(gross_amount) !== toCents(payment.gross_amount)) {
      await this.paymentRepo.logNotification(payment.id, notification);
      throw new ValidationError("gross_amount tidak sesuai dengan transaksi");
    }

    const target = mapMidtransStatus(notification);
    const result = await this.paymentRepo.applyNotification(payment, notification, target);
    // Dikirim setelah transaksi commit agar aplikasi buyer langsung refresh order & e-ticket.
    if (result === "applied" && target) {
      emitToUser(payment.order.user_id, "order:updated", {
        order_number: order_id,
        order_status: target.order,
        payment_status: target.payment,
      });
      if (["paid", "expired", "cancelled"].includes(target.order) && typeof (this.paymentRepo as Partial<PaymentRepository>).findSeatIdsByOrder === "function") {
        const seats = (await this.paymentRepo.findSeatIdsByOrder(payment.order_id)) ?? [];
        const byMap = new Map<bigint, typeof seats>();
        for (const seat of seats) byMap.set(seat.seat.seat_map_id, [...(byMap.get(seat.seat.seat_map_id) ?? []), seat]);
        for (const [seatMapId, items] of byMap) emitToAll("seat:status-changed", { seat_map_id: seatMapId, seats: items.map((seat) => ({ id: seat.seat_id, status: seat.seat.status })) });
      }
    }
    return { result };
  }
}
