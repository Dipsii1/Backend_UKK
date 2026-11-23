import QRCode from "qrcode";
import { describe, expect, it, vi } from "vitest";
import { prismaMock } from "./helpers/prisma.mock.js";
import { PaymentRepository } from "../src/modules/payment/payment.repository.js";
import { paymentRules } from "../src/modules/payment/payment.service.js";
import { CheckInRepository } from "../src/modules/check-in/check-in.repository.js";
import { CheckInService, checkInRules } from "../src/modules/check-in/check-in.service.js";
import { TicketService } from "../src/modules/ticket/ticket.service.js";
import { NotFoundError } from "../src/utils/app-error.js";

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
  const hour = 3_600_000;
  const window = { eventId: 4n, opensAt: new Date(Date.now() - hour), closesAt: new Date(Date.now() + hour) };
  const ticket = {
    id: 21n,
    ticket_code: "TCK-1",
    status: "issued",
    checked_in_by: null,
    order: { status: "paid" },
    ticketType: { event_id: 4n, name: "VIP" },
  };

  const lockTicket = (found: object | null) => {
    runTransactionsOnMock();
    prismaMock.$queryRaw.mockResolvedValue((found ? [{ id: 21n }] : []) as never);
    if (found) prismaMock.tickets.findUniqueOrThrow.mockResolvedValue(found as never);
  };

  it("checks in a valid QR token, records the officer, and never creates a new ticket", async () => {
    lockTicket(ticket);
    prismaMock.tickets.update.mockResolvedValue({ ...ticket, status: "checked_in", checked_in_at: new Date(), checked_in_by: 2n } as never);
    const repository = new CheckInRepository(checkInRules);

    const result = await repository.checkIn(window, "valid-token", 2n);

    expect(result.reason).toBe("ok");
    expect(prismaMock.tickets.update).toHaveBeenCalledWith({
      where: { id: 21n },
      data: { status: "checked_in", checked_in_at: expect.any(Date), checked_in_by: 2n },
    });
    expect(prismaMock.ticket_scans.create).toHaveBeenCalledWith({ data: { ticket_id: 21n, scanned_by: 2n, event_id: 4n, scan_result: "success" } });
    expect(prismaMock.audit_logs.create).toHaveBeenCalled();
    expect(prismaMock.tickets.create).not.toHaveBeenCalled();
    expect(prismaMock.tickets.createMany).not.toHaveBeenCalled();
  });

  it.each([
    ["duplicate", { ...ticket, status: "checked_in" }, "duplicate"],
    ["unpaid", { ...ticket, order: { status: "pending" } }, "invalid"],
    ["wrong_event", { ...ticket, ticketType: { event_id: 5n, name: "VIP" } }, "invalid"],
  ])("does not change the ticket when validation fails (%s) but still logs the scan", async (reason, found, scanResult) => {
    lockTicket(found);
    const repository = new CheckInRepository(checkInRules);

    await expect(repository.checkIn(window, "valid-token", 2n)).resolves.toMatchObject({ reason });
    expect(prismaMock.tickets.update).not.toHaveBeenCalled();
    expect(prismaMock.audit_logs.create).not.toHaveBeenCalled();
    expect(prismaMock.ticket_scans.create).toHaveBeenCalledWith({ data: { ticket_id: 21n, scanned_by: 2n, event_id: 4n, scan_result: scanResult } });
  });

  it("returns not_found for an unknown token without writing anything", async () => {
    lockTicket(null);
    const repository = new CheckInRepository(checkInRules);

    await expect(repository.checkIn(window, "unknown-token", 2n)).resolves.toEqual({ reason: "not_found" });
    expect(prismaMock.ticket_scans.create).not.toHaveBeenCalled();
    expect(prismaMock.tickets.update).not.toHaveBeenCalled();
  });

  it("classifies every scan condition", () => {
    const now = new Date();
    const verify = (overrides: object, at = now) => checkInRules.verify({ ...ticket, ...overrides } as never, window, at);

    expect(verify({})).toBe("ok");
    expect(verify({ ticketType: { event_id: 5n } })).toBe("wrong_event");
    expect(verify({}, new Date(now.getTime() - 2 * hour))).toBe("not_open");
    expect(verify({}, new Date(now.getTime() + 2 * hour))).toBe("closed");
    expect(verify({ order: { status: "pending" } })).toBe("unpaid");
    expect(verify({ status: "cancelled" })).toBe("cancelled");
    expect(verify({ status: "expired" })).toBe("expired");
    expect(verify({ status: "checked_in" })).toBe("duplicate");
  });

  const event = {
    id: 4n,
    gate_open_at: window.opensAt,
    start_at: window.opensAt,
    end_at: window.closesAt,
    organizer: { user_id: 7n, status: "verified" },
  };
  const serviceFor = (reason: string, foundEvent: object | null = event) => {
    const repository = {
      findEvent: vi.fn().mockResolvedValue(foundEvent),
      checkIn: vi.fn().mockResolvedValue({ reason, ticket: { ...ticket, status: "checked_in", checked_in_at: new Date(), checked_in_by: 7n } }),
    };
    return { repository, service: new CheckInService(repository as never) };
  };
  const input = { event_id: 4n, qr_token: "valid-token" };

  it("returns USED with officer and time for a valid QR scanned by the event organizer", async () => {
    const { repository, service } = serviceFor("ok");

    await expect(service.checkIn(7n, "organizer", input)).resolves.toMatchObject({ ticket_code: "TCK-1", status: "USED", checked_in_by: 7n });
    expect(repository.checkIn).toHaveBeenCalledWith({ eventId: 4n, opensAt: window.opensAt, closesAt: window.closesAt }, "valid-token", 7n);
  });

  it("opens check-in at start_at when the event has no gate_open_at", async () => {
    const { repository, service } = serviceFor("ok", { ...event, gate_open_at: null });

    await service.checkIn(2n, "admin", input);
    expect(repository.checkIn.mock.calls[0][0]).toMatchObject({ opensAt: event.start_at });
  });

  it.each([
    ["not_found", 404, "TICKET_NOT_FOUND"],
    ["wrong_event", 409, "WRONG_EVENT"],
    ["not_open", 409, "CHECKIN_NOT_OPEN"],
    ["closed", 409, "CHECKIN_CLOSED"],
    ["unpaid", 409, "TICKET_UNPAID"],
    ["cancelled", 409, "TICKET_CANCELLED"],
    ["expired", 409, "TICKET_EXPIRED"],
    ["duplicate", 409, "TICKET_USED"],
  ])("maps %s to HTTP %i with code %s", async (reason, statusCode, code) => {
    const { service } = serviceFor(reason);

    await expect(service.checkIn(7n, "organizer", input)).rejects.toMatchObject({ statusCode, code });
  });

  it("rejects unauthorized officers and unknown events before scanning", async () => {
    const other = serviceFor("ok");
    const unverified = serviceFor("ok", { ...event, organizer: { user_id: 7n, status: "suspended" } });
    const missing = serviceFor("ok", null);

    await expect(other.service.checkIn(99n, "organizer", input)).rejects.toMatchObject({ statusCode: 403, code: "CHECKIN_FORBIDDEN" });
    await expect(unverified.service.checkIn(7n, "organizer", input)).rejects.toMatchObject({ statusCode: 403, code: "CHECKIN_FORBIDDEN" });
    await expect(missing.service.checkIn(7n, "organizer", input)).rejects.toMatchObject({ statusCode: 404, code: "EVENT_NOT_FOUND" });
    expect(other.repository.checkIn).not.toHaveBeenCalled();
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
