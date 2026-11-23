import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "./helpers/prisma.mock.js";
import { env } from "../src/config/env.js";

// Controller diuji lewat route asli (auth, role guard, validasi), dengan service diganti mock.
const services = vi.hoisted(() => {
  const fns = new Map<string, ReturnType<typeof vi.fn>>();
  const fn = (key: string) => {
    if (!fns.has(key)) fns.set(key, vi.fn());
    return fns.get(key)!;
  };
  const fake = (name: string) =>
    class {
      constructor() {
        return new Proxy({}, { get: (_target, method) => fn(`${name}.${String(method)}`) });
      }
    };
  return { fn, fake };
});

vi.mock("../src/lib/prisma.js", async () => ({ prisma: (await import("./helpers/prisma.mock.js")).prismaMock }));
vi.mock("../src/modules/admin/admin.service.js", () => ({ AdminService: services.fake("admin") }));
vi.mock("../src/modules/organizer/organizer.service.js", () => ({ OrganizerService: services.fake("organizer") }));
vi.mock("../src/modules/cart/cart.service.js", () => ({ CartService: services.fake("cart"), cartRules: {} }));
vi.mock("../src/modules/payment/payment.service.js", () => ({ PaymentService: services.fake("payment"), paymentRules: {} }));
vi.mock("../src/modules/check-in/check-in.service.js", () => ({ CheckInService: services.fake("checkIn"), checkInRules: {} }));
vi.mock("../src/modules/ticket/ticket.service.js", () => ({ TicketService: services.fake("ticket") }));
vi.mock("../src/modules/notification/notification.service.js", () => ({ NotificationService: services.fake("notification") }));

const { app } = await import("../src/index.js");

const ids = { buyer: 1n, admin: 2n, organizer: 3n } as const;
type Role = keyof typeof ids;
const tokenFor = (role: Role) => jwt.sign({ sub: ids[role].toString(), type: "access" }, env.JWT_SECRET, { expiresIn: "15m" });

beforeEach(() => {
  prismaMock.users.findUnique.mockImplementation((async ({ where }: { where: { id: bigint } }) => {
    const role = (Object.keys(ids) as Role[]).find((key) => ids[key] === where.id);
    return role ? { id: where.id, is_active: true, email_verified: true, role: { name: role } } : null;
  }) as never);
});

type Case = {
  role: Role | null;
  method: "get" | "post" | "put" | "patch" | "delete";
  path: string;
  body?: object;
  service: string;
  returns?: unknown;
  status: number;
  args?: unknown[];
};

const order = { id: 9n, subtotal: 100000, discount: 0, service_fee: 5000, tax: 11550, total: 116550 };
const event = { category_id: "1", venue_id: "1", title: "Festival", slug: "festival", start_at: "2026-12-01T10:00:00Z", end_at: "2026-12-01T20:00:00Z" };
const notification = { order_id: "ORD-9", status_code: "200", gross_amount: "116550.00", signature_key: "a".repeat(128), transaction_status: "settlement" };

const cases: Case[] = [
  // Admin
  { role: "admin", method: "put", path: "/api/v1/admin/event/5/approve", service: "admin.approveEvent", status: 200, args: [5n, ids.admin] },
  { role: "admin", method: "get", path: "/api/v1/admin/users?is_active=true", service: "admin.listUsers", status: 200 },
  { role: "admin", method: "patch", path: "/api/v1/admin/users/4/status", body: { is_active: false }, service: "admin.updateUserStatus", status: 200, args: [4n, false, ids.admin] },
  { role: "admin", method: "get", path: "/api/v1/admin/organizers", service: "admin.listOrganizers", status: 200 },
  { role: "admin", method: "patch", path: "/api/v1/admin/organizers/4/status", body: { status: "verified" }, service: "admin.updateOrganizerStatus", status: 200, args: [4n, "verified", ids.admin] },
  { role: "admin", method: "get", path: "/api/v1/admin/dashboard", service: "admin.getDashboard", status: 200 },
  { role: "admin", method: "get", path: "/api/v1/admin/transaction-logs?status=paid", service: "admin.listTransactionLogs", status: 200 },
  // Organizer
  { role: "organizer", method: "get", path: "/api/v1/organizer/event?page=2", service: "organizer.listEvents", status: 200, args: [ids.organizer, 2, 10] },
  { role: "organizer", method: "post", path: "/api/v1/organizer/event", body: event, service: "organizer.createEvent", status: 201 },
  { role: "organizer", method: "get", path: "/api/v1/organizer/event/5", service: "organizer.getEvent", status: 200, args: [ids.organizer, 5n] },
  { role: "organizer", method: "patch", path: "/api/v1/organizer/event/5", body: { title: "Baru" }, service: "organizer.updateEvent", status: 200 },
  { role: "organizer", method: "delete", path: "/api/v1/organizer/event/5", service: "organizer.deleteEvent", status: 204 },
  { role: "organizer", method: "post", path: "/api/v1/organizer/event/5/submit", service: "organizer.submitEvent", status: 200 },
  { role: "organizer", method: "get", path: "/api/v1/organizer/event/5/tickets", service: "organizer.listTickets", status: 200 },
  { role: "organizer", method: "get", path: "/api/v1/organizer/event/5/sales", service: "organizer.getSales", status: 200 },
  { role: "organizer", method: "get", path: "/api/v1/organizer/tickets/7", service: "organizer.getTicket", status: 200, args: [ids.organizer, 7n] },
  { role: "organizer", method: "post", path: "/api/v1/organizer/tickets", body: { event_id: "5", name: "VIP", price: 100000, quota: 10 }, service: "organizer.createTicket", status: 201 },
  { role: "organizer", method: "patch", path: "/api/v1/organizer/tickets/7", body: { quota: 20 }, service: "organizer.updateTicket", status: 200, args: [ids.organizer, 7n, { quota: 20 }] },
  { role: "organizer", method: "delete", path: "/api/v1/organizer/tickets/7", service: "organizer.deleteTicket", status: 204 },
  // Buyer: cart, payment, tickets
  { role: "buyer", method: "get", path: "/api/v1/cart", service: "cart.getCart", status: 200, args: [ids.buyer] },
  { role: "buyer", method: "put", path: "/api/v1/cart/items", body: { ticket_type_id: "7", quantity: 2 }, service: "cart.setItem", status: 200, args: [ids.buyer, { ticket_type_id: 7n, quantity: 2 }] },
  { role: "buyer", method: "delete", path: "/api/v1/cart/items/7", service: "cart.removeItem", status: 204, args: [ids.buyer, 7n] },
  { role: "buyer", method: "post", path: "/api/v1/cart/checkout", body: {}, service: "cart.checkout", returns: order, status: 201 },
  { role: "buyer", method: "post", path: "/api/v1/payments/9", service: "payment.createTransaction", returns: { created: true, data: {} }, status: 201, args: [ids.buyer, 9n] },
  { role: "buyer", method: "post", path: "/api/v1/payments/9", service: "payment.createTransaction", returns: { created: false, data: {} }, status: 200 },
  { role: null, method: "post", path: "/api/v1/payments/midtrans/webhook", body: notification, service: "payment.handleNotification", returns: { result: "applied" }, status: 200 },
  { role: "buyer", method: "get", path: "/api/v1/me/tickets", service: "ticket.getMyTickets", status: 200, args: [ids.buyer, 1, 10] },
  { role: "buyer", method: "get", path: "/api/v1/me/tickets/21", service: "ticket.getMyTicket", status: 200, args: [ids.buyer, 21n] },
  // Check-in
  { role: "organizer", method: "post", path: "/api/v1/check-in", body: { event_id: "5", qr_token: "a".repeat(43) }, service: "checkIn.checkIn", status: 200, args: [ids.organizer, "organizer", { event_id: 5n, qr_token: "a".repeat(43) }] },
  // Notifications
  { role: "buyer", method: "get", path: "/api/v1/notifications", service: "notification.getMine", status: 200, args: [ids.buyer, 1, 10] },
  { role: "buyer", method: "patch", path: "/api/v1/notifications/4/read", service: "notification.markRead", status: 200, args: [ids.buyer, 4n] },
  { role: "buyer", method: "post", path: "/api/v1/notifications/push-tokens", body: { token: "ExponentPushToken[abc]" }, service: "notification.registerPushToken", status: 201, args: [ids.buyer, "ExponentPushToken[abc]"] },
  { role: "buyer", method: "delete", path: "/api/v1/notifications/push-tokens", body: { token: "ExponentPushToken[abc]" }, service: "notification.removePushToken", status: 204 },
  { role: "admin", method: "post", path: "/api/v1/notifications/broadcast", body: { title: "Promo", role: "buyer" }, service: "notification.broadcast", returns: { recipients: 2, push_sent: 1 }, status: 201, args: [ids.admin, { title: "Promo", role: "buyer" }] },
];

describe("Controllers via HTTP routes", () => {
  it.each(cases)("$method $path -> $status ($service)", async ({ role, method, path, body, service, returns, status, args }) => {
    const fn = services.fn(service);
    fn.mockResolvedValue(returns ?? { ok: true });

    let req = request(app)[method](path);
    if (role) req = req.set("Authorization", `Bearer ${tokenFor(role)}`);
    const response = await (body ? req.send(body) : req);

    expect(response.status).toBe(status);
    expect(fn).toHaveBeenCalledTimes(1);
    if (args) expect(fn).toHaveBeenCalledWith(...args);
  });

  it("formats checkout money fields as Rupiah", async () => {
    services.fn("cart.checkout").mockResolvedValue(order);

    const response = await request(app).post("/api/v1/cart/checkout").set("Authorization", `Bearer ${tokenFor("buyer")}`).send({});

    expect(response.body.data).toMatchObject({ total: 116550, total_formatted: "Rp 116.550", service_fee_formatted: "Rp 5.000" });
  });

  it("blocks other roles before reaching the controller", async () => {
    const forbidden = [
      request(app).get("/api/v1/admin/dashboard").set("Authorization", `Bearer ${tokenFor("organizer")}`),
      request(app).get("/api/v1/organizer/event").set("Authorization", `Bearer ${tokenFor("buyer")}`),
      request(app).get("/api/v1/cart").set("Authorization", `Bearer ${tokenFor("organizer")}`),
      request(app).post("/api/v1/check-in").set("Authorization", `Bearer ${tokenFor("buyer")}`).send({ event_id: "5", qr_token: "a".repeat(43) }),
    ];

    for (const response of await Promise.all(forbidden)) expect(response.status).toBe(403);
    expect(services.fn("admin.getDashboard")).not.toHaveBeenCalled();
    expect(services.fn("checkIn.checkIn")).not.toHaveBeenCalled();
  });
});
