import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  events: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  roles: { upsert: vi.fn() },
  users: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn(), delete: vi.fn() },
  user_profiles: { create: vi.fn(), update: vi.fn() },
  refresh_tokens: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  password_resets: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  email_verifications: { create: vi.fn(), findUnique: vi.fn() },
}));

vi.mock("../src/lib/prisma.js", () => ({ prisma: prismaMock }));
vi.mock("../src/utils/mailer.js", () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));

const { app } = await import("../src/index.js");

const buyer = {
  id: 1n,
  public_id: "user-1",
  email: "buyer@example.com",
  password: "unused",
  is_active: true,
  email_verified: true,
  role: { name: "buyer" },
  userProfiles: [{ full_name: "Buyer One", phone: null, gender: null, birth_date: null, avatar: null, address: null, province_id: null, city_id: null }],
};

const admin = { ...buyer, id: 2n, public_id: "user-2", email: "admin@example.com", role: { name: "admin" } };
const tokenFor = (id: bigint) => jwt.sign({ sub: id.toString() }, env.JWT_SECRET, { expiresIn: "15m" });

const setDefaults = () => {
  prismaMock.$transaction.mockResolvedValue([[], 0]);
  prismaMock.events.findUnique.mockResolvedValue(null);
  prismaMock.users.findUnique.mockResolvedValue(null);
  prismaMock.users.findMany.mockResolvedValue([]);
};

describe("HTTP routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaults();
  });

  it("returns published event pagination data", async () => {
    const response = await request(app).get("/api/v1/events?page=1&limit=10");
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 });
  });

  it("rejects invalid event query input", async () => {
    const response = await request(app).get("/api/v1/events?limit=101");
    expect(response.status).toBe(422);
  });

  it("returns not found and database error for event detail/list", async () => {
    const missing = await request(app).get("/api/v1/events/99");
    expect(missing.status).toBe(404);
    prismaMock.$transaction.mockRejectedValueOnce(new Error("database unavailable"));
    const failed = await request(app).get("/api/v1/events");
    expect(failed.status).toBe(500);
  });

  it("rejects invalid auth payloads before the service", async () => {
    const register = await request(app).post("/api/v1/auth/register").send({ email: "invalid" });
    const login = await request(app).post("/api/v1/auth/login").send({ email: "invalid", password: "" });
    const refresh = await request(app).post("/api/v1/auth/refresh-token").send({});
    expect([register.status, login.status, refresh.status]).toEqual([422, 422, 422]);
  });

  it("registers a buyer and returns no password", async () => {
    const created = { id: 3n, public_id: "user-3", email: "new@example.com" };
    prismaMock.$transaction.mockImplementationOnce(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
    prismaMock.roles.upsert.mockResolvedValue({ id: 1n });
    prismaMock.users.create.mockResolvedValue(created);
    prismaMock.user_profiles.create.mockResolvedValue({});
    prismaMock.email_verifications.create.mockResolvedValue({});

    const response = await request(app).post("/api/v1/auth/register").send({
      email: "new@example.com", password: "Password123!", fullName: "New Buyer",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user).toEqual({ public_id: "user-3", email: "new@example.com", full_name: "New Buyer" });
    expect(JSON.stringify(response.body)).not.toContain("Password123!");
  });

  it("returns conflict for registered email and generic unauthorized login errors", async () => {
    prismaMock.users.findUnique.mockResolvedValueOnce(buyer);
    const conflict = await request(app).post("/api/v1/auth/register").send({ email: buyer.email, password: "Password123!", fullName: "Buyer One" });
    const login = await request(app).post("/api/v1/auth/login").send({ email: "unknown@example.com", password: "Password123!" });
    expect(conflict.status).toBe(409);
    expect(login.status).toBe(401);
    expect(login.body.message).toBe("Email Atau Password Salah");
  });

  it("logs in a verified active user and sets an httpOnly refresh cookie", async () => {
    const password = await bcrypt.hash("Password123!", env.BCRYPT_ROUNDS);
    prismaMock.users.findUnique.mockResolvedValueOnce({ ...buyer, password });
    prismaMock.refresh_tokens.create.mockImplementationOnce(async ({ data }: { data: { token: string } }) => ({ token: data.token }));

    const response = await request(app).post("/api/v1/auth/login").send({ email: buyer.email, password: "Password123!" });
    expect(response.status).toBe(200);
    expect(response.headers["set-cookie"]?.[0]).toContain("refresh_token=");
    expect(response.body.data).not.toHaveProperty("refreshToken");
  });

  it("rejects inactive and unverified accounts", async () => {
    const password = await bcrypt.hash("Password123!", env.BCRYPT_ROUNDS);
    prismaMock.users.findUnique.mockResolvedValueOnce({ ...buyer, password, is_active: false });
    const inactive = await request(app).post("/api/v1/auth/login").send({ email: buyer.email, password: "Password123!" });
    prismaMock.users.findUnique.mockResolvedValueOnce({ ...buyer, password, email_verified: false });
    const unverified = await request(app).post("/api/v1/auth/login").send({ email: buyer.email, password: "Password123!" });
    expect([inactive.status, unverified.status]).toEqual([403, 403]);
  });

  it("requires valid auth and enforces user role and ownership", async () => {
    const none = await request(app).get("/api/v1/users");
    const invalid = await request(app).get("/api/v1/users").set("Authorization", "Bearer invalid");
    prismaMock.users.findUnique.mockResolvedValueOnce(buyer);
    const denied = await request(app).get("/api/v1/users").set("Authorization", `Bearer ${tokenFor(1n)}`);
    prismaMock.users.findUnique.mockResolvedValueOnce(buyer);
    const foreign = await request(app).get("/api/v1/users/2").set("Authorization", `Bearer ${tokenFor(1n)}`);
    expect([none.status, invalid.status, denied.status, foreign.status]).toEqual([401, 401, 403, 403]);
  });

  it("returns authenticated profile, logout, and admin user list", async () => {
    prismaMock.users.findUnique.mockResolvedValueOnce(buyer).mockResolvedValueOnce(buyer);
    const profile = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${tokenFor(1n)}`);
    prismaMock.users.findUnique.mockResolvedValueOnce(buyer);
    prismaMock.refresh_tokens.updateMany.mockResolvedValue({ count: 1 });
    const logout = await request(app).post("/api/v1/auth/logout").set("Authorization", `Bearer ${tokenFor(1n)}`);
    prismaMock.users.findUnique.mockResolvedValueOnce(admin);
    prismaMock.users.findMany.mockResolvedValueOnce([{ id: 1n, email: buyer.email }]);
    const list = await request(app).get("/api/v1/users").set("Authorization", `Bearer ${tokenFor(2n)}`);
    expect([profile.status, logout.status, list.status]).toEqual([200, 200, 200]);
  });

  it("handles password reset and email verification token failures", async () => {
    prismaMock.password_resets.findUnique.mockResolvedValueOnce(null);
    const reset = await request(app).post("/api/v1/auth/reset-password/confirm").send({ token: "invalid", newPassword: "Password123!" });
    prismaMock.email_verifications.findUnique.mockResolvedValueOnce(null);
    const verify = await request(app).post("/api/v1/auth/verify-email/confirm").send({ token: "invalid" });
    expect([reset.status, verify.status]).toEqual([401, 401]);
  });

  it("serves auth HTML pages and generic reset or verification requests", async () => {
    const resetPage = await request(app).get("/api/v1/auth/reset-password?token=reset-token");
    const verifyMissing = await request(app).get("/api/v1/auth/verify-email");
    const resetRequest = await request(app).post("/api/v1/auth/reset-password/request").send({ email: "missing@example.com" });
    const verifyRequest = await request(app).post("/api/v1/auth/verify-email/request").send({ email: "missing@example.com" });
    expect([resetPage.status, verifyMissing.status, resetRequest.status, verifyRequest.status]).toEqual([200, 400, 200, 200]);
  });

  it("updates, profiles, reads, and deletes users through authorized routes", async () => {
    prismaMock.users.findUnique.mockResolvedValueOnce(buyer).mockResolvedValueOnce({ id: 1n, email: "changed@example.com" });
    const update = await request(app).put("/api/v1/users/1").set("Authorization", `Bearer ${tokenFor(1n)}`).send({ email: "changed@example.com" });
    prismaMock.users.findUnique.mockResolvedValueOnce(buyer).mockResolvedValueOnce({ id: 1n, email: buyer.email }).mockResolvedValueOnce({ id: 1n, email: buyer.email });
    prismaMock.user_profiles.update.mockResolvedValueOnce({});
    const profile = await request(app).patch("/api/v1/users/1/profile").set("Authorization", `Bearer ${tokenFor(1n)}`).send({ full_name: "Changed Name" });
    prismaMock.users.findUnique.mockResolvedValueOnce(buyer).mockResolvedValueOnce({ id: 1n, email: buyer.email });
    const get = await request(app).get("/api/v1/users/1").set("Authorization", `Bearer ${tokenFor(1n)}`);
    prismaMock.users.findUnique.mockResolvedValueOnce(admin).mockResolvedValueOnce({ id: 1n, email: buyer.email });
    prismaMock.users.delete.mockResolvedValueOnce({ id: 1n });
    const deleted = await request(app).delete("/api/v1/users/1").set("Authorization", `Bearer ${tokenFor(2n)}`);
    expect([update.status, profile.status, get.status, deleted.status]).toEqual([200, 200, 200, 200]);
  });
});
