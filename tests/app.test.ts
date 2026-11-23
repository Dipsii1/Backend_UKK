import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import { Prisma } from "../src/generated/prisma/client.js";

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  events: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  roles: { upsert: vi.fn() },
  organizers: { findUnique: vi.fn(), create: vi.fn() },
  users: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(), count: vi.fn(), delete: vi.fn() },
  user_profiles: { create: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  refresh_tokens: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  password_resets: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  email_verifications: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn() },
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
const tokenFor = (id: bigint) => jwt.sign({ sub: id.toString(), type: "access" }, env.JWT_SECRET, { expiresIn: "15m" });
const refreshTokenFor = (id: bigint) => jwt.sign({ sub: id.toString(), type: "refresh" }, env.JWT_SECRET, { expiresIn: "7d" });

const setDefaults = () => {
  prismaMock.$transaction.mockResolvedValue([[], 0]);
  prismaMock.events.findFirst.mockResolvedValue(null);
  prismaMock.users.findUnique.mockResolvedValue(null);
  prismaMock.users.findMany.mockResolvedValue([]);
  prismaMock.organizers.findUnique.mockResolvedValue(null);
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
    expect(response.status).toBe(400);
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
    expect([register.status, login.status, refresh.status]).toEqual([400, 400, 400]);
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

  it("registers an organizer as pending and returns no password", async () => {
    const createdUser = { id: 4n, public_id: "user-4", email: "organizer@example.com" };
    const createdOrganizer = { id: 1n, public_id: "organizer-1", company_name: "Tixo Event", slug: "tixo-event", status: "pending" };
    prismaMock.$transaction.mockImplementationOnce(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
    prismaMock.roles.upsert.mockResolvedValue({ id: 2n });
    prismaMock.users.create.mockResolvedValue(createdUser);
    prismaMock.user_profiles.create.mockResolvedValue({});
    prismaMock.organizers.create.mockResolvedValue(createdOrganizer);
    prismaMock.email_verifications.create.mockResolvedValue({});

    const response = await request(app).post("/api/v1/auth/register-organizer").send({
      email: "organizer@example.com",
      password: "Password123!",
      fullName: "Organizer One",
      companyName: "Tixo Event",
      slug: "tixo-event",
      phone: "081234567890",
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      user: { public_id: "user-4", email: "organizer@example.com", full_name: "Organizer One" },
      organizer: { public_id: "organizer-1", company_name: "Tixo Event", slug: "tixo-event", status: "pending" },
    });
    expect(prismaMock.roles.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { name: "organizer" } }));
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

  it("refreshes a valid token and confirms email verification", async () => {
    const refreshToken = refreshTokenFor(1n);
    prismaMock.refresh_tokens.findUnique.mockResolvedValueOnce({ id: 9n, revoked_at: null, expired_at: new Date(Date.now() + 60_000) });
    prismaMock.users.findUnique.mockResolvedValueOnce(buyer);
    prismaMock.refresh_tokens.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.refresh_tokens.create.mockResolvedValueOnce({});
    const refreshed = await request(app).post("/api/v1/auth/refresh-token").send({ refreshToken });

    prismaMock.email_verifications.findUnique.mockResolvedValueOnce({ id: 8n, expired_at: new Date(Date.now() + 60_000), verified_at: null, user: buyer });
    prismaMock.$transaction.mockImplementationOnce(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
    prismaMock.email_verifications.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.users.updateMany.mockResolvedValueOnce({ count: 1 });
    const verified = await request(app).post("/api/v1/auth/verify-email/confirm").send({ token: "valid-token" });

    expect([refreshed.status, verified.status]).toEqual([200, 200]);
  });

  it("serves auth HTML pages and generic reset or verification requests", async () => {
    const resetPage = await request(app).get("/api/v1/auth/reset-password?token=reset-token");
    const verifyMissing = await request(app).get("/api/v1/auth/verify-email");
    const resetRequest = await request(app).post("/api/v1/auth/reset-password/request").send({ email: "missing@example.com" });
    const verifyRequest = await request(app).post("/api/v1/auth/verify-email/request").send({ email: "missing@example.com" });
    expect([resetPage.status, verifyMissing.status, resetRequest.status, verifyRequest.status]).toEqual([200, 400, 200, 200]);
  });

  it("rejects a reset page without a token, escapes its token, and shows verification failure safely", async () => {
    const missingReset = await request(app).get("/api/v1/auth/reset-password");
    const resetPage = await request(app).get("/api/v1/auth/reset-password?token=%22%3E%3Cscript%3Ealert(1)%3C%2Fscript%3E");
    const verificationFailure = await request(app).get("/api/v1/auth/verify-email?token=invalid");

    expect(missingReset.status).toBe(400);
    expect(resetPage.text).toContain("/api/v1/auth/reset-password/confirm");
    expect(resetPage.text).not.toContain('value="\"><script>');
    expect(verificationFailure.status).toBe(400);
  });

  it("updates, profiles, reads, and deletes users through authorized routes", async () => {
    prismaMock.users.findUnique.mockResolvedValueOnce(buyer).mockResolvedValueOnce({ id: 1n, email: "changed@example.com" });
    const update = await request(app).put("/api/v1/users/1").set("Authorization", `Bearer ${tokenFor(1n)}`).send({ email: "changed@example.com" });
    prismaMock.users.findUnique.mockResolvedValueOnce(buyer).mockResolvedValueOnce({ id: 1n, email: buyer.email }).mockResolvedValueOnce({ id: 1n, email: buyer.email });
    prismaMock.user_profiles.upsert.mockResolvedValueOnce({});
    const profile = await request(app).patch("/api/v1/users/1/profile").set("Authorization", `Bearer ${tokenFor(1n)}`).send({ full_name: "Changed Name" });
    prismaMock.users.findUnique.mockResolvedValueOnce(buyer).mockResolvedValueOnce({ id: 1n, email: buyer.email });
    const get = await request(app).get("/api/v1/users/1").set("Authorization", `Bearer ${tokenFor(1n)}`);
    prismaMock.users.findUnique.mockResolvedValueOnce(admin).mockResolvedValueOnce({ id: 1n, email: buyer.email });
    prismaMock.users.delete.mockResolvedValueOnce({ id: 1n });
    const deleted = await request(app).delete("/api/v1/users/1").set("Authorization", `Bearer ${tokenFor(2n)}`);
    expect([update.status, profile.status, get.status, deleted.status]).toEqual([200, 200, 200, 200]);
  });
  it("rejects a refresh token used as an access token", async () => {
    prismaMock.users.findUnique.mockResolvedValueOnce(buyer);
    const response = await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${refreshTokenFor(1n)}`);
    expect(response.status).toBe(401);
  });

  it("returns JSON 400 for malformed JSON and JSON 404 for unknown routes", async () => {
    const malformed = await request(app).post("/api/v1/auth/login").set("Content-Type", "application/json").send("{bad json");
    const unknown = await request(app).get("/api/v1/does-not-exist");
    expect([malformed.status, unknown.status]).toEqual([400, 404]);
    expect(unknown.body).toMatchObject({ success: false, code: "NOT_FOUND" });
  });

  it("maps Prisma unique constraint violations to 409", async () => {
    prismaMock.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test" }),
    );
    const response = await request(app).post("/api/v1/auth/register").send({ email: "race@example.com", password: "Password123!", fullName: "Race User" });
    expect(response.status).toBe(409);
  });

  it("restricts the cart to buyers", async () => {
    prismaMock.users.findUnique.mockResolvedValueOnce(admin);
    const response = await request(app).get("/api/v1/cart").set("Authorization", `Bearer ${tokenFor(2n)}`);
    expect(response.status).toBe(403);
  });
});
