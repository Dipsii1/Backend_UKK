import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { prismaMock } from "./helpers/prisma.mock.js";
import { env } from "../src/config/env.js";
import { errorHandler } from "../src/middlewares/error.middleware.js";
import { CartRepository } from "../src/modules/cart/cart.repository.js";
import { cartRules } from "../src/modules/cart/cart.service.js";
import { EventRepository } from "../src/modules/event/event.repository.js";

vi.mock("../src/lib/prisma.js", async () => ({ prisma: (await import("./helpers/prisma.mock.js")).prismaMock }));

describe("errorHandler in production", () => {
  const originalEnv = env.NODE_ENV;
  afterEach(() => {
    env.NODE_ENV = originalEnv;
  });

  it("logs unexpected errors but never sends the stack trace to the client", () => {
    env.NODE_ENV = "production";
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = { status: vi.fn().mockReturnThis(), type: vi.fn().mockReturnThis(), send: vi.fn() };
    const error = new Error("db connection lost");

    errorHandler(error, { method: "POST", path: "/api/v1/cart/checkout" } as Request, res as unknown as Response, vi.fn());

    expect(logSpy).toHaveBeenCalledWith("[INTERNAL_ERROR] POST /api/v1/cart/checkout:", error);
    expect(res.status).toHaveBeenCalledWith(500);
    const body = JSON.parse(res.send.mock.calls[0][0]);
    expect(body).toMatchObject({ success: false, code: "INTERNAL_ERROR" });
    expect(JSON.stringify(body)).not.toContain("db connection lost");
  });
});

describe("Stale order expiry job", () => {
  it("releases stock of expired pending orders in a serializable transaction without any cart activity", async () => {
    prismaMock.$transaction.mockImplementation(((fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock)) as never);
    prismaMock.orders.findMany.mockResolvedValue([
      { id: 9n, user_id: 1n, orderItems: [{ ticket_type_id: 5n, quantity: 2 }] },
    ] as never);
    prismaMock.orders.updateMany.mockResolvedValue({ count: 1 } as never);

    await new CartRepository(cartRules).expireStaleOrders();

    expect(prismaMock.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(prismaMock.orders.updateMany).toHaveBeenCalledWith({
      where: { expired_at: { lte: expect.any(Date) }, id: 9n, status: "pending" },
      data: { status: "expired" },
    });
    expect(prismaMock.ticket_types.update).toHaveBeenCalledWith({ where: { id: 5n }, data: { sold: { decrement: 2 } } });
    expect(prismaMock.voucher_usages.deleteMany).toHaveBeenCalledWith({ where: { order_id: 9n } });
  });

  it("does not release stock twice when another transaction already expired the order", async () => {
    prismaMock.$transaction.mockImplementation(((fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock)) as never);
    prismaMock.orders.findMany.mockResolvedValue([
      { id: 9n, user_id: 1n, orderItems: [{ ticket_type_id: 5n, quantity: 2 }] },
    ] as never);
    prismaMock.orders.updateMany.mockResolvedValue({ count: 0 } as never);

    await new CartRepository(cartRules).expireStaleOrders();

    expect(prismaMock.ticket_types.update).not.toHaveBeenCalled();
  });
});

describe("Public event date filter", () => {
  it("treats ?date= as a WIB calendar day, so a 05:00 WIB event is found on its own date", async () => {
    prismaMock.$transaction.mockResolvedValue([[], 0] as never);

    await new EventRepository().findAll({ page: 1, limit: 10, date: "2026-12-01" });

    const where = prismaMock.events.findMany.mock.calls[0][0]!.where!;
    expect(where.start_at).toEqual({ gte: new Date("2026-11-30T17:00:00.000Z"), lte: new Date("2026-12-01T16:59:59.999Z") });
  });
});
