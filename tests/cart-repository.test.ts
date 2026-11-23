import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "./helpers/prisma.mock.js";
import { CartRepository } from "../src/modules/cart/cart.repository.js";
import { cartRules } from "../src/modules/cart/cart.service.js";

vi.mock("../src/lib/prisma.js", async () => ({ prisma: (await import("./helpers/prisma.mock.js")).prismaMock }));

const future = new Date(Date.now() + 86_400_000);
const event = { status: "published", is_published: true, end_at: future, sales_start_at: null, sales_end_at: null };
const ticket = (sold: number, quota = 10) => ({
  id: 5n, event_id: 3n, wave: 1, price: 100000, quota, sold, max_purchase: 5,
  status: "active", sale_start_at: null, sale_end_at: null, event,
});

beforeEach(() => {
  prismaMock.$transaction.mockImplementation(((fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock)) as never);
  prismaMock.orders.findMany.mockResolvedValue([] as never); // tidak ada order kadaluarsa
  prismaMock.order_items.aggregate.mockResolvedValue({ _sum: { quantity: 0 } } as never);
});

describe("CartRepository.upsertItem quota guard", () => {
  const arrange = (sold: number, reservedByOthers: number) => {
    prismaMock.ticket_types.findUnique.mockResolvedValue(ticket(sold) as never);
    prismaMock.ticket_types.findMany.mockResolvedValue([] as never); // gelombang pertama
    prismaMock.carts.upsert.mockResolvedValue({ id: 1n } as never);
    prismaMock.ticket_locks.aggregate.mockResolvedValue({ _sum: { quantity: reservedByOthers } } as never);
  };

  it("rejects a reservation when sold + other carts' locks + quantity exceed the quota", async () => {
    arrange(8, 2);

    await expect(new CartRepository(cartRules).upsertItem(1n, 5n, 1)).resolves.toEqual({ reason: "sold_out" });
    expect(prismaMock.ticket_locks.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ NOT: { cart_id: 1n } }) }));
    expect(prismaMock.ticket_locks.upsert).not.toHaveBeenCalled();
  });

  it("reserves the last seat exactly at the quota", async () => {
    arrange(8, 1);

    const result = await new CartRepository(cartRules).upsertItem(1n, 5n, 1);

    expect(result.reason).toBe("ok");
    expect(prismaMock.cart_items.upsert).toHaveBeenCalled();
    expect(prismaMock.ticket_locks.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ ticket_type_id: 5n, quantity: 1 }) }));
  });
});

describe("CartRepository.checkout", () => {
  const arrangeCart = (sold: number) => {
    prismaMock.carts.findUnique.mockResolvedValue({
      id: 1n,
      items: [{ ticket_type_id: 5n, quantity: 2, ticketType: ticket(sold) }],
      locks: [{ ticket_type_id: 5n, quantity: 2, expires_at: future }],
    } as never);
    prismaMock.ticket_types.findUnique.mockResolvedValue(ticket(sold) as never);
    prismaMock.orders.create.mockResolvedValue({ id: 9n, status: "pending" } as never);
  };

  it("creates the order, increments sold, and clears the cart", async () => {
    arrangeCart(3);

    const result = await new CartRepository(cartRules).checkout(1n);

    expect(result.reason).toBe("ok");
    expect(prismaMock.ticket_types.update).toHaveBeenCalledWith({ where: { id: 5n }, data: { sold: { increment: 2 } } });
    expect(prismaMock.cart_items.deleteMany).toHaveBeenCalledWith({ where: { cart_id: 1n } });
    expect(prismaMock.ticket_locks.deleteMany).toHaveBeenCalledWith({ where: { cart_id: 1n } });
  });

  it("refuses to oversell when stock was taken after the reservation", async () => {
    arrangeCart(9);

    await expect(new CartRepository(cartRules).checkout(1n)).resolves.toEqual({ reason: "unavailable" });
    expect(prismaMock.orders.create).not.toHaveBeenCalled();
    expect(prismaMock.ticket_types.update).not.toHaveBeenCalled();
  });

  it("rejects checkout when the reservation lock expired", async () => {
    arrangeCart(3);
    prismaMock.carts.findUnique.mockResolvedValue({
      id: 1n,
      items: [{ ticket_type_id: 5n, quantity: 2, ticketType: ticket(3) }],
      locks: [],
    } as never);

    await expect(new CartRepository(cartRules).checkout(1n)).resolves.toEqual({ reason: "lock_expired" });
    expect(prismaMock.orders.create).not.toHaveBeenCalled();
  });
});
