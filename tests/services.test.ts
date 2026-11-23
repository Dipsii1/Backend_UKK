import { describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { EventService } from "../src/modules/event/event.service.js";
import { UserService } from "../src/modules/user/user.service.js";
import { AuthService } from "../src/modules/auth/auth.service.js";
import { NotFoundError, UnauthorizedError } from "../src/utils/app-error.js";
import { ForbiddenError } from "../src/utils/app-error.js";
import { OrganizerService } from "../src/modules/organizer/organizer.service.js";
import { ConflictError } from "../src/utils/app-error.js";
import { AdminService } from "../src/modules/admin/admin.service.js";
import { CartService, cartRules } from "../src/modules/cart/cart.service.js";
import { PaymentService, mapMidtransStatus, paymentRules } from "../src/modules/payment/payment.service.js";
import { midtrans } from "../src/utils/midtrans.js";
import { env } from "../src/config/env.js";
import { formatRupiah, toNumber } from "../src/utils/currency.js";
import { Prisma } from "../src/generated/prisma/client.js";

vi.mock("../src/utils/mailer.js", () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));

describe("EventService", () => {
  it("returns event list from repository", async () => {
    const result = { data: [], total: 0, page: 1, limit: 10, totalPages: 0 };
    const repository = { findAll: vi.fn().mockResolvedValue(result) };
    const service = new EventService(repository as never);

    await expect(service.getEvents({ page: 1, limit: 10 })).resolves.toEqual(result);
    expect(repository.findAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });

  it("throws not found when event does not exist", async () => {
    const service = new EventService({ findById: vi.fn().mockResolvedValue(null) } as never);

    await expect(service.getEventById(1n)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("propagates repository database errors", async () => {
    const service = new EventService({ findAll: vi.fn().mockRejectedValue(new Error("database unavailable")) } as never);

    await expect(service.getEvents({ page: 1, limit: 10 })).rejects.toThrow("database unavailable");
  });
});

describe("OrganizerService", () => {
  it("rejects a ticket quota lower than the number already sold", async () => {
    const repository = {
      findByOwnerId: vi.fn().mockResolvedValue({ id: 9n, status: "verified" }),
      findTicketByIdAndOrganizer: vi.fn().mockResolvedValue({ id: 7n, sold: 8, quota: 10 }),
      updateTicket: vi.fn(),
    };
    const service = new OrganizerService(repository as never);

    await expect(service.updateTicket(1n, 7n, { quota: 7 })).rejects.toBeInstanceOf(ConflictError);
    expect(repository.updateTicket).not.toHaveBeenCalled();
  });

  it("allows adding a new ticket wave to a published festival", async () => {
    const repository = {
      findByOwnerId: vi.fn().mockResolvedValue({ id: 9n, status: "verified" }),
      findEventByIdAndOrganizer: vi.fn().mockResolvedValue({ id: 3n, status: "published", end_at: new Date(Date.now() + 86_400_000), ticketTypes: [] }),
      createTicket: vi.fn().mockResolvedValue({ id: 5n }),
    };
    const service = new OrganizerService(repository as never);

    await service.createTicket(1n, { event_id: 3n, name: "Gelombang 2", price: 150000, quota: 50, wave: 2 });
    expect(repository.createTicket).toHaveBeenCalledWith(expect.objectContaining({ wave: 2, status: "active" }));
  });

  it("rejects new tickets for a published festival that has ended or is under review", async () => {
    const ended = { id: 3n, status: "published", end_at: new Date(Date.now() - 1000), ticketTypes: [] };
    const repository = {
      findByOwnerId: vi.fn().mockResolvedValue({ id: 9n, status: "verified" }),
      findEventByIdAndOrganizer: vi.fn().mockResolvedValueOnce(ended).mockResolvedValueOnce({ ...ended, status: "pending_review" }),
      createTicket: vi.fn(),
    };
    const service = new OrganizerService(repository as never);
    const input = { event_id: 3n, name: "Gelombang 2", price: 150000, quota: 50, wave: 2 };

    await expect(service.createTicket(1n, input)).rejects.toBeInstanceOf(ConflictError);
    await expect(service.createTicket(1n, input)).rejects.toBeInstanceOf(ConflictError);
    expect(repository.createTicket).not.toHaveBeenCalled();
  });

  it("uses paid orders only when calculating festival sales", async () => {
    const repository = {
      findByOwnerId: vi.fn().mockResolvedValue({ id: 9n }),
      findSalesByEvent: vi.fn().mockResolvedValue({
        id: 3n,
        title: "Festival",
        ticketTypes: [{ id: 4n, public_id: "ticket-1", name: "VIP", price: 100000, quota: 20, sold: 3, orderItems: [{ quantity: 2, subtotal: 200000, order_id: 12n }] }],
      }),
    };
    const service = new OrganizerService(repository as never);

    await expect(service.getSales(1n, 3n)).resolves.toMatchObject({
      summary: { paid_orders: 1, paid_tickets: 2, revenue: 200000, quota: 20, sold: 3 },
      ticket_types: [{ available: 17 }],
    });
  });
});

describe("CartService", () => {
  it("rejects cart item when the ticket quota is exhausted", async () => {
    const repository = { upsertItem: vi.fn().mockResolvedValue({ reason: "sold_out" }) };
    const service = new CartService(repository as never);

    await expect(service.setItem(1n, { ticket_type_id: 2n, quantity: 1 })).rejects.toBeInstanceOf(ConflictError);
  });

  it("formats cart prices as Rupiah", async () => {
    const repository = { getCart: vi.fn().mockResolvedValue({ id: 1n, public_id: "c1", locks: [], items: [{ id: 2n, ticket_type_id: 3n, quantity: 2, unit_price: "150000.00", subtotal: "300000.00", ticketType: { id: 3n, name: "VIP", event: {} } }] }) };
    const cart = await new CartService(repository as never).getCart(1n);

    expect(cart).toMatchObject({ subtotal: 300000, subtotal_formatted: "Rp 300.000", items: [{ unit_price_formatted: "Rp 150.000", subtotal_formatted: "Rp 300.000" }] });
    expect(formatRupiah(0)).toBe("Rp 0");
  });

  it("rejects cart item when its ticket wave is not open yet", async () => {
    const repository = { upsertItem: vi.fn().mockResolvedValue({ reason: "wave_locked" }) };
    const service = new CartService(repository as never);

    await expect(service.setItem(1n, { ticket_type_id: 2n, quantity: 1 })).rejects.toThrow("Gelombang ini belum dibuka");
  });

  it("rejects checkout when its temporary ticket lock has expired", async () => {
    const repository = { checkout: vi.fn().mockResolvedValue({ reason: "lock_expired" }) };
    const service = new CartService(repository as never);

    await expect(service.checkout(1n, {})).rejects.toBeInstanceOf(ConflictError);
  });

  it("returns the created order after an atomic checkout", async () => {
    const order = { id: 9n, total: 116550 };
    const repository = { checkout: vi.fn().mockResolvedValue({ reason: "ok", order }) };
    const service = new CartService(repository as never);

    await expect(service.checkout(1n, { voucher_code: "HEMAT10" })).resolves.toEqual(order);
    expect(repository.checkout).toHaveBeenCalledWith(1n, "HEMAT10");
  });
});

describe("UserService", () => {
  it("returns a user when it exists", async () => {
    const user = { id: 1n, email: "buyer@example.com" };
    const repository = { findById: vi.fn().mockResolvedValue(user) };
    const service = new UserService(repository as never);

    await expect(service.getById(1n)).resolves.toEqual(user);
  });

  it("throws not found when user does not exist", async () => {
    const service = new UserService({ findById: vi.fn().mockResolvedValue(null) } as never);

    await expect(service.getById(1n)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("removes role change requests from non-admin updates", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue({ id: 1n }),
      update: vi.fn().mockResolvedValue({ id: 1n, email: "updated@example.com" }),
    };
    const service = new UserService(repository as never, { requestEmailVerification: vi.fn() });

    await service.update(1n, { email: "updated@example.com", role_id: 2n }, "buyer");

    expect(repository.update).toHaveBeenCalledWith(1n, { email: "updated@example.com" });
  });

  it("sends a verification email to the new address after an email change", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue({ id: 1n, email: "old@example.com" }),
      update: vi.fn().mockResolvedValue({ id: 1n, email: "new@example.com" }),
    };
    const authService = { requestEmailVerification: vi.fn().mockResolvedValue({ message: "ok" }) };
    const service = new UserService(repository as never, authService);

    await service.update(1n, { email: "new@example.com" }, "buyer");
    expect(authService.requestEmailVerification).toHaveBeenCalledWith("new@example.com");

    authService.requestEmailVerification.mockClear();
    await service.update(1n, { email: "old@example.com" }, "buyer");
    expect(authService.requestEmailVerification).not.toHaveBeenCalled();
  });
});

describe("AdminService", () => {
  it("approves a pending event through the repository", async () => {
    const event = { id: 5n, status: "published" };
    const repository = { approveEvent: vi.fn().mockResolvedValue({ event, currentStatus: "pending_review" }) };
    const service = new AdminService(repository as never);

    await expect(service.approveEvent(5n, 1n)).resolves.toEqual(event);
    expect(repository.approveEvent).toHaveBeenCalledWith(5n, 1n);
  });

  it("rejects approval when event is not pending review", async () => {
    const service = new AdminService({ approveEvent: vi.fn().mockResolvedValue({ event: null, currentStatus: "draft" }) } as never);
    await expect(service.approveEvent(5n, 1n)).rejects.toBeInstanceOf(ConflictError);
  });

  it("prevents an admin from disabling their own account", async () => {
    const repository = { setUserActive: vi.fn() };
    const service = new AdminService(repository as never);
    await expect(service.updateUserStatus(1n, false, 1n)).rejects.toBeInstanceOf(ConflictError);
    expect(repository.setUserActive).not.toHaveBeenCalled();
  });
});

describe("AuthService", () => {
  it("rejects login for an unknown email without leaking account existence", async () => {
    const repository = { findByEmail: vi.fn().mockResolvedValue(null) };
    const service = new AuthService(repository as never);

    await expect(service.login({ email: "unknown@example.com", password: "Password123!" })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("returns the same password-reset response for unknown email", async () => {
    const repository = { findByEmail: vi.fn().mockResolvedValue(null) };
    const service = new AuthService(repository as never);

    await expect(service.requestPasswordReset("unknown@example.com")).resolves.toEqual({
      message: "Jika email terdaftar, link reset kata sandi telah dikirim",
    });
  });

  it("rejects reset password with missing token", async () => {
    const repository = { findPasswordResetToken: vi.fn().mockResolvedValue(null) };
    const service = new AuthService(repository as never);

    await expect(service.resetPassword({ token: "invalid", newPassword: "Password123!" })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("looks up reset tokens by their hash and revokes sessions after use", async () => {
    const rawToken = "reset-token";
    const repository = {
      findPasswordResetToken: vi.fn().mockResolvedValue({
        id: 4n,
        user_id: 1n,
        used_at: null,
        expired_at: new Date(Date.now() + 60_000),
      }),
      completePasswordReset: vi.fn().mockResolvedValue(true),
    };
    const service = new AuthService(repository as never);

    await expect(service.resetPassword({ token: rawToken, newPassword: "Password123!" })).resolves.toEqual({
      message: "Kata sandi berhasil direset",
    });
    expect(repository.findPasswordResetToken).toHaveBeenCalledWith(
      crypto.createHash("sha256").update(rawToken).digest("hex"),
    );
    expect(repository.completePasswordReset).toHaveBeenCalledWith(4n, 1n, expect.any(String));
  });

  it("looks up and consumes email-verification tokens by their hash", async () => {
    const rawToken = "verify-token";
    const repository = {
      findEmailVerificationToken: vi.fn().mockResolvedValue({
        id: 5n,
        expired_at: new Date(Date.now() + 60_000),
        verified_at: null,
        user: { id: 1n },
      }),
      consumeEmailVerificationToken: vi.fn().mockResolvedValue({ count: 1 }),
      setEmailVerified: vi.fn().mockResolvedValue({}),
    };
    const service = new AuthService(repository as never);

    await expect(service.confirmEmailVerification(rawToken)).resolves.toEqual({ message: "Email berhasil diverifikasi" });
    expect(repository.findEmailVerificationToken).toHaveBeenCalledWith(
      crypto.createHash("sha256").update(rawToken).digest("hex"),
    );
    expect(repository.consumeEmailVerificationToken).toHaveBeenCalledWith(5n);
  });

  it("rejects login for inactive and unverified users", async () => {
    const password = await (await import("bcrypt")).default.hash("Password123!", 4);
    const baseUser = {
      id: 1n,
      password,
      is_active: true,
      email_verified: true,
      public_id: "user-1",
      email: "buyer@example.com",
      role: { name: "buyer" },
      userProfiles: [],
    };
    const repository = { findByEmail: vi.fn().mockResolvedValueOnce({ ...baseUser, is_active: false }).mockResolvedValueOnce({ ...baseUser, email_verified: false }) };
    const service = new AuthService(repository as never);

    await expect(service.login({ email: baseUser.email, password: "Password123!" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.login({ email: baseUser.email, password: "Password123!" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects login when the requested role does not match, before creating a session", async () => {
    const password = await (await import("bcrypt")).default.hash("Password123!", 4);
    const buyer = {
      id: 1n,
      password,
      is_active: true,
      email_verified: true,
      public_id: "user-1",
      email: "buyer@example.com",
      role: { name: "buyer" },
      userProfiles: [],
    };
    const repository = { findByEmail: vi.fn().mockResolvedValue(buyer), createRefreshToken: vi.fn() };
    const service = new AuthService(repository as never);

    await expect(service.login({ email: buyer.email, password: "Password123!", role: "admin" })).rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.createRefreshToken).not.toHaveBeenCalled();

    const ok = await service.login({ email: buyer.email, password: "Password123!", role: "buyer" });
    expect(ok.user.role).toBe("buyer");
    expect(repository.createRefreshToken).toHaveBeenCalledTimes(1);
  });

  it("rejects a verification token that was consumed concurrently", async () => {
    const repository = {
      findEmailVerificationToken: vi.fn().mockResolvedValue({
        id: 5n,
        expired_at: new Date(Date.now() + 60_000),
        verified_at: null,
        user: { id: 1n },
      }),
      consumeEmailVerificationToken: vi.fn().mockResolvedValue({ count: 0 }),
    };
    const service = new AuthService(repository as never);

    await expect(service.confirmEmailVerification("verify-token")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects a reset token that could not be consumed atomically", async () => {
    const repository = {
      findPasswordResetToken: vi.fn().mockResolvedValue({ id: 4n, user_id: 1n, used_at: null, expired_at: new Date(Date.now() + 60_000) }),
      completePasswordReset: vi.fn().mockResolvedValue(false),
    };
    const service = new AuthService(repository as never);

    await expect(service.resetPassword({ token: "reset-token", newPassword: "Password123!" })).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("rejects an already-used email verification token", async () => {
    const repository = {
      findEmailVerificationToken: vi.fn().mockResolvedValue({ id: 5n, expired_at: new Date(Date.now() + 60_000), verified_at: new Date(), user: { id: 1n } }),
    };
    const service = new AuthService(repository as never);

    await expect(service.confirmEmailVerification("verify-token")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("creates hashed password-reset and verification tokens for a known user", async () => {
    const user = { id: 1n, email: "buyer@example.com" };
    const repository = {
      findByEmail: vi.fn().mockResolvedValue(user),
      createPasswordResetToken: vi.fn().mockResolvedValue({}),
      createEmailVerificationToken: vi.fn().mockResolvedValue({}),
    };
    const service = new AuthService(repository as never);

    await service.requestPasswordReset(user.email);
    await service.requestEmailVerification(user.email);

    expect(repository.createPasswordResetToken).toHaveBeenCalledWith(expect.objectContaining({ userId: user.id, token: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(repository.createEmailVerificationToken).toHaveBeenCalledWith(expect.objectContaining({ userId: user.id, token: expect.stringMatching(/^[a-f0-9]{64}$/) }));
  });

  it("rejects an invalid refresh token before accessing the repository", async () => {
    const repository = { findRefreshToken: vi.fn() };
    const service = new AuthService(repository as never);

    await expect(service.refresh("invalid")).rejects.toBeInstanceOf(UnauthorizedError);
    expect(repository.findRefreshToken).not.toHaveBeenCalled();
  });
});

describe("Organizer event workflow", () => {
  const draftEvent = { id: 3n, status: "draft", ticketTypes: [{ id: 1n, sold: 0 }] };

  it("blocks unverified organizers from creating events", async () => {
    const repository = { findByOwnerId: vi.fn().mockResolvedValue({ id: 9n, status: "pending" }), createEvent: vi.fn() };
    const service = new OrganizerService(repository as never);
    await expect(service.createEvent(1n, {} as never)).rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.createEvent).not.toHaveBeenCalled();
  });

  it("submits a draft event with tickets for review", async () => {
    const repository = {
      findByOwnerId: vi.fn().mockResolvedValue({ id: 9n, status: "verified" }),
      findEventByIdAndOrganizer: vi.fn().mockResolvedValue(draftEvent),
      updateEvent: vi.fn().mockResolvedValue({ id: 3n, status: "pending_review" }),
    };
    const service = new OrganizerService(repository as never);
    await service.submitEvent(1n, 3n);
    expect(repository.updateEvent).toHaveBeenCalledWith(3n, { status: "pending_review", rejected_reason: null });
  });

  it("rejects submitting an event without tickets or editing a published event", async () => {
    const repository = {
      findByOwnerId: vi.fn().mockResolvedValue({ id: 9n, status: "verified" }),
      findEventByIdAndOrganizer: vi.fn()
        .mockResolvedValueOnce({ ...draftEvent, ticketTypes: [] })
        .mockResolvedValueOnce({ ...draftEvent, status: "published" }),
      updateEvent: vi.fn(),
    };
    const service = new OrganizerService(repository as never);
    await expect(service.submitEvent(1n, 3n)).rejects.toBeInstanceOf(ConflictError);
    await expect(service.updateEvent(1n, 3n, { title: "Baru" })).rejects.toBeInstanceOf(ConflictError);
    expect(repository.updateEvent).not.toHaveBeenCalled();
  });

  it("refuses to delete an event that already has orders", async () => {
    const repository = {
      findByOwnerId: vi.fn().mockResolvedValue({ id: 9n, status: "verified" }),
      findEventByIdAndOrganizer: vi.fn().mockResolvedValue(draftEvent),
      countOrderItemsByEvent: vi.fn().mockResolvedValue(2),
      deleteEvent: vi.fn(),
    };
    const service = new OrganizerService(repository as never);
    await expect(service.deleteEvent(1n, 3n)).rejects.toBeInstanceOf(ConflictError);
    expect(repository.deleteEvent).not.toHaveBeenCalled();
  });
});

describe("Cart rules", () => {
  const now = new Date("2026-11-23T10:00:00Z");
  const ticket = {
    status: "active",
    sale_start_at: null,
    sale_end_at: null,
    event: { status: "published", is_published: true, sales_start_at: null, sales_end_at: null, end_at: new Date("2026-12-01T00:00:00Z") },
  };

  it("rejects tickets after the event ended or outside the event sales window", () => {
    expect(cartRules.isSellable(ticket, now)).toBe(true);
    expect(cartRules.isSellable({ ...ticket, event: { ...ticket.event, end_at: new Date("2026-11-01T00:00:00Z") } }, now)).toBe(false);
    expect(cartRules.isSellable({ ...ticket, event: { ...ticket.event, sales_end_at: new Date("2026-11-22T00:00:00Z") } }, now)).toBe(false);
  });

  it("opens the next wave only after every earlier wave is sold out, inactive, or past its sale window", () => {
    const wave1 = { status: "active", quota: 10, sold: 10, sale_end_at: null };
    expect(cartRules.isWaveOpen([], now)).toBe(true);
    expect(cartRules.isWaveOpen([wave1], now)).toBe(true);
    expect(cartRules.isWaveOpen([wave1, { ...wave1, sold: 9 }], now)).toBe(false);
    expect(cartRules.isWaveOpen([{ ...wave1, sold: 9, status: "inactive" }], now)).toBe(true);
    expect(cartRules.isWaveOpen([{ ...wave1, sold: 9, sale_end_at: new Date(now.getTime() - 1000) }], now)).toBe(true);
  });

  it("calculates totals with a capped percentage voucher", () => {
    const voucher = { discount_type: "percentage" as const, discount_value: 50, max_discount: 20000, quota: null, is_active: true, start_at: null, end_at: null };
    expect(cartRules.calculateTotals([{ price: 100000, quantity: 1 }], voucher)).toEqual({
      subtotal: 100000, discount: 20000, service_fee: 5000, tax: 9350, total: 94350,
    });
  });

  it("treats a voucher as unusable once the user or quota has used it", () => {
    const voucher = { discount_type: "fixed" as const, discount_value: 10000, max_discount: null, quota: 1, is_active: true, start_at: null, end_at: null };
    expect(cartRules.isVoucherUsable(voucher, { total: 0, byUser: 0 }, now)).toBe(true);
    expect(cartRules.isVoucherUsable(voucher, { total: 1, byUser: 0 }, now)).toBe(false);
    expect(cartRules.isVoucherUsable({ ...voucher, quota: null }, { total: 5, byUser: 1 }, now)).toBe(false);
  });
});

describe("Hardening", () => {
  it("rejects approval when the event organizer is not verified", async () => {
    const service = new AdminService({
      approveEvent: vi.fn().mockResolvedValue({ event: null, currentStatus: "pending_review", organizerStatus: "suspended" }),
    } as never);
    await expect(service.approveEvent(5n, 1n)).rejects.toBeInstanceOf(ConflictError);
  });

  it("prevents an admin from deleting their own account", async () => {
    const repository = { findById: vi.fn(), deactivate: vi.fn() };
    const service = new UserService(repository as never);
    await expect(service.delete(1n, 1n)).rejects.toBeInstanceOf(ConflictError);
    expect(repository.deactivate).not.toHaveBeenCalled();
  });

  it("rejects an access token presented as a refresh token", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const { env } = await import("../src/config/env.js");
    const accessToken = jwt.sign({ sub: "1", type: "access" }, env.JWT_SECRET, { expiresIn: "15m" });
    const repository = { findRefreshToken: vi.fn() };
    const service = new AuthService(repository as never);
    await expect(service.refresh(accessToken)).rejects.toBeInstanceOf(UnauthorizedError);
    expect(repository.findRefreshToken).not.toHaveBeenCalled();
  });
});

describe("PaymentService", () => {
  const order = { id: 9n, order_number: "ORD-9", total: 116550, status: "pending", expired_at: new Date(Date.now() + 10 * 60_000) };
  const pendingPayment = { id: 3n, order_id: 9n, order: { user_id: 1n }, public_id: "pay-1", gross_amount: 116550, status: "pending", snap_token: null, redirect_url: null };
  const notification = {
    order_id: "ORD-9",
    status_code: "200",
    gross_amount: "116550.00",
    signature_key: "a".repeat(128),
    transaction_status: "settlement",
    transaction_id: "mid-1",
  };
  const gateway = (overrides = {}) => ({
    createSnapTransaction: vi.fn().mockResolvedValue({ token: "snap-1", redirect_url: "https://snap/1" }),
    isValidSignature: vi.fn().mockReturnValue(true),
    ...overrides,
  });

  it("sends the server-side order total and stored order number to Snap", async () => {
    const now = new Date();
    const repository = {
      reserve: vi.fn().mockResolvedValue({ reason: "created", order, payment: pendingPayment, now }),
      saveSnap: vi.fn().mockResolvedValue({ ...pendingPayment, snap_token: "snap-1", redirect_url: "https://snap/1" }),
    };
    const snap = gateway();
    const service = new PaymentService(repository as never, snap);

    await expect(service.createTransaction(1n, 9n)).resolves.toMatchObject({ created: true, data: { snap_token: "snap-1", gross_amount: 116550 } });
    expect(repository.reserve).toHaveBeenCalledWith(9n, 1n);
    expect(snap.createSnapTransaction).toHaveBeenCalledWith({ orderId: "ORD-9", grossAmount: 116550, expiresAt: order.expired_at, now });
  });

  it("returns the existing Snap token instead of creating a duplicate transaction", async () => {
    const repository = { reserve: vi.fn().mockResolvedValue({ reason: "exists", order, payment: { ...pendingPayment, snap_token: "snap-1" }, now: new Date() }) };
    const snap = gateway();
    const service = new PaymentService(repository as never, snap);

    await expect(service.createTransaction(1n, 9n)).resolves.toMatchObject({ created: false, data: { snap_token: "snap-1" } });
    expect(snap.createSnapTransaction).not.toHaveBeenCalled();
  });

  it("rejects payment for orders that are not owned or not payable", async () => {
    const notFound = new PaymentService({ reserve: vi.fn().mockResolvedValue({ reason: "not_found" }) } as never, gateway());
    const notPayable = new PaymentService({ reserve: vi.fn().mockResolvedValue({ reason: "not_payable" }) } as never, gateway());

    await expect(notFound.createTransaction(1n, 9n)).rejects.toBeInstanceOf(NotFoundError);
    await expect(notPayable.createTransaction(1n, 9n)).rejects.toBeInstanceOf(ConflictError);
  });

  it("releases the payment slot when Midtrans fails", async () => {
    const repository = {
      reserve: vi.fn().mockResolvedValue({ reason: "created", order, payment: pendingPayment, now: new Date() }),
      deletePayment: vi.fn().mockResolvedValue(undefined),
      saveSnap: vi.fn(),
    };
    const service = new PaymentService(repository as never, gateway({ createSnapTransaction: vi.fn().mockRejectedValue(new Error("gateway down")) }));

    await expect(service.createTransaction(1n, 9n)).rejects.toThrow("gateway down");
    expect(repository.deletePayment).toHaveBeenCalledWith(3n);
    expect(repository.saveSnap).not.toHaveBeenCalled();
  });

  it("rejects notifications with an invalid signature before touching the database", async () => {
    const repository = { findByOrderNumber: vi.fn() };
    const service = new PaymentService(repository as never, gateway({ isValidSignature: vi.fn().mockReturnValue(false) }));

    await expect(service.handleNotification(notification)).rejects.toBeInstanceOf(ForbiddenError);
    expect(repository.findByOrderNumber).not.toHaveBeenCalled();
  });

  it("logs but does not apply a notification whose gross_amount differs from the stored payment", async () => {
    const repository = {
      findByOrderNumber: vi.fn().mockResolvedValue(pendingPayment),
      logNotification: vi.fn().mockResolvedValue(undefined),
      applyNotification: vi.fn(),
    };
    const service = new PaymentService(repository as never, gateway());

    await expect(service.handleNotification({ ...notification, gross_amount: "1000.00" })).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.logNotification).toHaveBeenCalled();
    expect(repository.applyNotification).not.toHaveBeenCalled();
  });

  it("applies a verified settlement as PAID", async () => {
    const repository = {
      findByOrderNumber: vi.fn().mockResolvedValue(pendingPayment),
      applyNotification: vi.fn().mockResolvedValue("applied"),
    };
    const service = new PaymentService(repository as never, gateway());

    await expect(service.handleNotification(notification)).resolves.toEqual({ result: "applied" });
    expect(repository.applyNotification).toHaveBeenCalledWith(pendingPayment, notification, { payment: "settlement", order: "paid" });
  });

  it("verifies signature_key as SHA512(order_id + status_code + gross_amount + ServerKey)", () => {
    const original = env.MIDTRANS_SERVER_KEY;
    env.MIDTRANS_SERVER_KEY = "SB-Mid-server-test";
    const signature = crypto.createHash("sha512").update("ORD-9" + "200" + "116550.00" + "SB-Mid-server-test").digest("hex");

    expect(midtrans.isValidSignature("ORD-9", "200", "116550.00", signature)).toBe(true);
    expect(midtrans.isValidSignature("ORD-9", "200", "1.00", signature)).toBe(false);
    env.MIDTRANS_SERVER_KEY = original;
  });

  it("maps Midtrans statuses to payment and order statuses", () => {
    const map = (transaction_status: string, extra = {}) => mapMidtransStatus({ ...notification, transaction_status, ...extra });

    expect(map("capture", { fraud_status: "accept" })).toEqual({ payment: "settlement", order: "paid" });
    expect(map("capture", { fraud_status: "challenge" })).toEqual({ payment: "pending", order: "pending" });
    expect(map("settlement", { status_code: "201" })).toBeNull();
    expect(map("pending", { status_code: "201" })).toEqual({ payment: "pending", order: "pending" });
    expect(map("deny", { status_code: "202" })).toEqual({ payment: "failed", order: "cancelled" });
    expect(map("cancel", { status_code: "202" })).toEqual({ payment: "cancelled", order: "cancelled" });
    expect(map("expire", { status_code: "202" })).toEqual({ payment: "expired", order: "expired" });
    expect(map("refund")).toEqual({ payment: "refunded", order: "refunded" });
    expect(map("partial_refund")).toBeNull();
  });

  it("only allows forward payment transitions and payable pending orders", () => {
    const now = new Date();
    expect(paymentRules.canTransition("pending", "settlement")).toBe(true);
    expect(paymentRules.canTransition("settlement", "refunded")).toBe(true);
    expect(paymentRules.canTransition("settlement", "expired")).toBe(false);
    expect(paymentRules.canTransition("expired", "settlement")).toBe(false);
    expect(paymentRules.isPayable({ ...order, expired_at: new Date(now.getTime() + 30_000) }, now)).toBe(false);
    expect(paymentRules.isPayable({ ...order, status: "paid" }, now)).toBe(false);
    expect(paymentRules.grossAmount({ ...order, total: 1000.5 })).toBe(1001);
  });
});

describe("toNumber", () => {
  it("converts Prisma Decimals and plain values, treating null as zero", () => {
    expect(toNumber(new Prisma.Decimal("116550.50"))).toBe(116550.5);
    expect(toNumber(150000)).toBe(150000);
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
  });
});
