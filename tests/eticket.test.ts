import QRCode from "qrcode";
import { describe, expect, it, vi } from "vitest";
import { prismaMock } from "./helpers/prisma.mock.js";
import { PaymentRepository } from "../src/modules/payment/payment.repository.js";
import { paymentRules } from "../src/modules/payment/payment.service.js";
import { CheckInRepository } from "../src/modules/check-in/check-in.repository.js";
import { CheckInService, checkInRules } from "../src/modules/check-in/check-in.service.js";
import { TicketService } from "../src/modules/ticket/ticket.service.js";
import { ConflictError, ForbiddenError, NotFoundError } from "../src/utils/app-error.js";

vi.mock("../src/lib/prisma.js", async () => ({ prisma: (await import("./helpers/prisma.mock.js")).prismaMock }));

const runTransactionsOnMock = () => {
  prismaMock.$transaction.mockImplementation(((fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock)) as never);
};

describe("E-ticket issuance on payment notification", () => {
  const payment = { id: 3n, order_id: 9n };
  const settlement = {
    order_id: "ORD-9",
    status_code: "200",
    gross_amount: "300000.00",
    signature_key: "a".repeat(128),
    transaction_status: "settlement",
    transaction_id: "mid-1",
  };

  const arrange = (paymentStatus: string, orderStatus: string) => {
    runTransactionsOnMock();
    prismaMock.order_items.findMany.mockResolvedValue([
      { id: 11n, ticket_type_id: 5n, quantity: 2 },
      { id: 12n, ticket_type_id: 6n, quantity: 1 },
    ] as never);
    prismaMock.payments.findUniqueOrThrow.mockResolvedValue({ id: 3n, status: paymentStatus, provider_transaction_id: null, payment_method: null } as never);
    prismaMock.orders.findUniqueOrThrow.mockResolvedValue({ id: 9n, user_id: 1n, status: orderStatus } as never);
  };

  it("issues exactly one unique e-ticket per paid seat, linked to order and ticket type", async () => {
    arrange("pending", "pending");
    const repository = new PaymentRepository(paymentRules);

    await expect(repository.applyNotification(payment, settlement, { payment: "settlement", order: "paid" })).resolves.toBe("applied");

    const { data, skipDuplicates } = prismaMock.tickets.createMany.mock.calls[0][0] as {
      data: { order_id: bigint; order_item_id: bigint; ticket_type_id: bigint; sequence: number; ticket_code: string; qr_token: string }[];
      skipDuplicates: boolean;
    };
    expect(skipDuplicates).toBe(true);
    expect(data.map(({ order_id, order_item_id, ticket_type_id, sequence }) => ({ order_id, order_item_id, ticket_type_id, sequence }))).toEqual([
      { order_id: 9n, order_item_id: 11n, ticket_type_id: 5n, sequence: 1 },
      { order_id: 9n, order_item_id: 11n, ticket_type_id: 5n, sequence: 2 },
      { order_id: 9n, order_item_id: 12n, ticket_type_id: 6n, sequence: 1 },
    ]);
    expect(new Set(data.map((ticket) => ticket.ticket_code)).size).toBe(3);
    expect(new Set(data.map((ticket) => ticket.qr_token)).size).toBe(3);
    expect(data.every((ticket) => ticket.qr_token.length >= 43)).toBe(true);
  });

  it("does not issue tickets again when the same settlement webhook is replayed", async () => {
    arrange("settlement", "paid");
    const repository = new PaymentRepository(paymentRules);

    await expect(repository.applyNotification(payment, settlement, { payment: "settlement", order: "paid" })).resolves.toBe("unchanged");
    expect(prismaMock.tickets.createMany).not.toHaveBeenCalled();
    expect(prismaMock.payment_logs.create).toHaveBeenCalled();
  });

  it("does not issue tickets for an order that is still unpaid", async () => {
    arrange("pending", "pending");
    const repository = new PaymentRepository(paymentRules);

    await repository.applyNotification(payment, { ...settlement, transaction_status: "pending", status_code: "201" }, { payment: "pending", order: "pending" });
    expect(prismaMock.tickets.createMany).not.toHaveBeenCalled();
    expect(prismaMock.orders.update).not.toHaveBeenCalled();
  });
});

describe("Check-in with QR token", () => {
  const ticket = {
    id: 21n,
    ticket_code: "TCK-1",
    status: "issued",
    order: { status: "paid" },
    ticketType: { event_id: 4n, name: "VIP" },
  };

  it("checks in a valid QR token and never creates a new ticket", async () => {
    runTransactionsOnMock();
    prismaMock.$queryRaw.mockResolvedValue([{ id: 21n }] as never);
    prismaMock.tickets.findUniqueOrThrow.mockResolvedValue(ticket as never);
    prismaMock.tickets.update.mockResolvedValue({ ...ticket, status: "checked_in", checked_in_at: new Date() } as never);
    const repository = new CheckInRepository(checkInRules);

    const result = await repository.checkIn(4n, "valid-token", 2n);

    expect(result.reason).toBe("ok");
    expect(prismaMock.tickets.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 21n } }));
    expect(prismaMock.ticket_scans.create).toHaveBeenCalledWith({ data: { ticket_id: 21n, scanned_by: 2n, scan_result: "success" } });
    expect(prismaMock.tickets.create).not.toHaveBeenCalled();
    expect(prismaMock.tickets.createMany).not.toHaveBeenCalled();
  });

  it("records a duplicate scan when the same QR is scanned again", async () => {
    runTransactionsOnMock();
    prismaMock.$queryRaw.mockResolvedValue([{ id: 21n }] as never);
    prismaMock.tickets.findUniqueOrThrow.mockResolvedValue({ ...ticket, status: "checked_in" } as never);
    const repository = new CheckInRepository(checkInRules);

    await expect(repository.checkIn(4n, "valid-token", 2n)).resolves.toMatchObject({ reason: "duplicate" });
    expect(prismaMock.tickets.update).not.toHaveBeenCalled();
    expect(prismaMock.ticket_scans.create).toHaveBeenCalledWith({ data: { ticket_id: 21n, scanned_by: 2n, scan_result: "duplicate" } });
  });

  it("returns not_found for an unknown token without writing anything", async () => {
    runTransactionsOnMock();
    prismaMock.$queryRaw.mockResolvedValue([] as never);
    const repository = new CheckInRepository(checkInRules);

    await expect(repository.checkIn(4n, "unknown-token", 2n)).resolves.toEqual({ reason: "not_found" });
    expect(prismaMock.ticket_scans.create).not.toHaveBeenCalled();
  });

  const event = { id: 4n, organizer: { user_id: 7n, status: "verified" } };

  it("returns USED for a valid QR scanned by the event organizer", async () => {
    const repository = {
      findEvent: vi.fn().mockResolvedValue(event),
      checkIn: vi.fn().mockResolvedValue({ reason: "ok", ticket: { ...ticket, status: "checked_in", checked_in_at: new Date() } }),
    };
    const service = new CheckInService(repository as never);

    await expect(service.checkIn(7n, "organizer", { event_id: 4n, qr_token: "valid-token" })).resolves.toMatchObject({ ticket_code: "TCK-1", status: "USED" });
  });

  it("rejects an unknown token, a reused token, and another organizer's event", async () => {
    const service = (reason: string) =>
      new CheckInService({ findEvent: vi.fn().mockResolvedValue(event), checkIn: vi.fn().mockResolvedValue({ reason, ticket }) } as never);

    await expect(service("not_found").checkIn(7n, "organizer", { event_id: 4n, qr_token: "unknown" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service("duplicate").checkIn(7n, "organizer", { event_id: 4n, qr_token: "used" })).rejects.toBeInstanceOf(ConflictError);
    await expect(service("ok").checkIn(99n, "organizer", { event_id: 4n, qr_token: "valid" })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("validates event, payment, and usage of a scanned ticket", () => {
    expect(checkInRules.verify(ticket as never, 4n)).toBe("ok");
    expect(checkInRules.verify(ticket as never, 5n)).toBe("wrong_event");
    expect(checkInRules.verify({ ...ticket, order: { status: "pending" } } as never, 4n)).toBe("invalid");
    expect(checkInRules.verify({ ...ticket, status: "cancelled" } as never, 4n)).toBe("invalid");
    expect(checkInRules.verify({ ...ticket, status: "checked_in" } as never, 4n)).toBe("duplicate");
  });
});

describe("Buyer e-tickets", () => {
  const record = {
    id: 21n,
    public_id: "ticket-1",
    ticket_code: "TCK-1",
    qr_token: "opaque-qr-token",
    status: "issued",
    checked_in_at: null,
    order: { id: 9n, order_number: "ORD-9" },
    ticketType: {
      id: 5n,
      name: "VIP",
      event: { id: 4n, title: "Festival", slug: "festival", gate_open_at: null, start_at: new Date(), end_at: new Date(), venue: { name: "GBK", address: null } },
    },
  };

  it("returns UNUSED status and a QR encoding only the ticket token", async () => {
    const repository = { findByIdAndOwner: vi.fn().mockResolvedValue(record) };
    const service = new TicketService(repository as never);

    const ticket = await service.getMyTicket(1n, 21n);

    expect(repository.findByIdAndOwner).toHaveBeenCalledWith(21n, 1n);
    expect(ticket).toMatchObject({ status: "UNUSED", ticket_code: "TCK-1", ticket_type: { name: "VIP" }, event: { title: "Festival" } });
    expect(ticket.qr_code).toBe(await QRCode.toDataURL("opaque-qr-token", { errorCorrectionLevel: "M", margin: 2, width: 320 }));
    expect(ticket).not.toHaveProperty("qr_token");
  });

  it("hides tickets owned by other buyers or from unpaid orders", async () => {
    const service = new TicketService({ findByIdAndOwner: vi.fn().mockResolvedValue(null) } as never);

    await expect(service.getMyTicket(1n, 99n)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("paginates the buyer's tickets and maps USED status", async () => {
    const repository = { findByOwner: vi.fn().mockResolvedValue({ data: [{ ...record, status: "checked_in" }], total: 1 }) };
    const service = new TicketService(repository as never);

    await expect(service.getMyTickets(1n, 1, 10)).resolves.toMatchObject({ total: 1, totalPages: 1, data: [{ status: "USED" }] });
  });
});
