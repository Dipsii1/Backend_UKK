import { describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { EventService } from "../src/services/event.service.js";
import { UserService } from "../src/services/user.service.js";
import { AuthService } from "../src/services/auth.service.js";
import { NotFoundError, UnauthorizedError } from "../src/utils/app-error.js";
import { ForbiddenError } from "../src/utils/app-error.js";

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
    const service = new UserService(repository as never);

    await service.update(1n, { email: "updated@example.com", role_id: 2n }, "buyer");

    expect(repository.update).toHaveBeenCalledWith(1n, { email: "updated@example.com" });
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
