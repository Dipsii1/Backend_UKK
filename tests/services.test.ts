import { describe, expect, it, vi } from "vitest";
import { EventService } from "../src/services/event.service.js";
import { UserService } from "../src/services/user.service.js";
import { AuthService } from "../src/services/auth.service.js";
import { NotFoundError, UnauthorizedError } from "../src/utils/app-error.js";

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
});
