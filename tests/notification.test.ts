import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationService } from "../src/modules/notification/notification.service.js";
import { NotFoundError } from "../src/utils/app-error.js";
import { sendExpoPush } from "../src/utils/expo-push.js";
import { emitToAll, emitToRole } from "../src/lib/socket.js";

vi.mock("../src/lib/socket.js", () => ({ emitToAll: vi.fn(), emitToRole: vi.fn(), emitToUser: vi.fn() }));

const mockFetch = (data: unknown[]) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data }), { status: 200 }));

afterEach(() => vi.restoreAllMocks());

describe("sendExpoPush", () => {
  it("counts delivered pushes and returns unregistered device tokens", async () => {
    const fetchSpy = mockFetch([{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }, { status: "error", details: { error: "MessageRateExceeded" } }]);

    const result = await sendExpoPush(["ExponentPushToken[a]", "ExponentPushToken[b]", "ExponentPushToken[c]"], { title: "Halo" });

    expect(result).toEqual({ sent: 1, invalidTokens: ["ExponentPushToken[b]"] });
    expect(JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)[0]).toMatchObject({ to: "ExponentPushToken[a]", title: "Halo" });
  });

  it("does not throw when Expo is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(sendExpoPush(["ExponentPushToken[a]"], { title: "Halo" })).resolves.toEqual({ sent: 0, invalidTokens: [] });
  });
});

describe("NotificationService", () => {
  const repo = () => ({
    broadcast: vi.fn().mockResolvedValue([1n, 2n]),
    findPushTokens: vi.fn().mockResolvedValue(["ExponentPushToken[a]", "ExponentPushToken[b]"]),
    deletePushTokens: vi.fn(),
    findByIdAndUser: vi.fn(),
    markRead: vi.fn(),
    deletePushToken: vi.fn(),
  });

  it("broadcasts to a role over websocket and push, then prunes dead tokens", async () => {
    mockFetch([{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }]);
    const repository = repo();
    const service = new NotificationService(repository as never);

    const result = await service.broadcast(9n, { title: "Promo", message: "Diskon 50%", role: "buyer" });

    expect(result).toEqual({ recipients: 2, push_sent: 1 });
    expect(repository.broadcast).toHaveBeenCalledWith(9n, { title: "Promo", message: "Diskon 50%", role: "buyer" });
    expect(emitToRole).toHaveBeenCalledWith("buyer", "notification:new", expect.objectContaining({ title: "Promo", type: "system" }));
    expect(emitToAll).not.toHaveBeenCalled();
    expect(repository.findPushTokens).toHaveBeenCalledWith([1n, 2n]);
    expect(repository.deletePushTokens).toHaveBeenCalledWith(["ExponentPushToken[b]"]);
  });

  it("emits to every connected client when the target role is all", async () => {
    mockFetch([]);
    const repository = { ...repo(), findPushTokens: vi.fn().mockResolvedValue([]) };

    await new NotificationService(repository as never).broadcast(9n, { title: "Maintenance", role: "all" });

    expect(emitToAll).toHaveBeenCalledWith("notification:new", expect.objectContaining({ title: "Maintenance" }));
    expect(repository.deletePushTokens).not.toHaveBeenCalled();
  });

  it("only marks the caller's own notification as read", async () => {
    const repository = repo();
    const service = new NotificationService(repository as never);

    await expect(service.markRead(1n, 5n)).rejects.toBeInstanceOf(NotFoundError);
    expect(repository.findByIdAndUser).toHaveBeenCalledWith(5n, 1n);
    expect(repository.markRead).not.toHaveBeenCalled();
  });

  it("rejects removing a push token the user does not own", async () => {
    const repository = { ...repo(), deletePushToken: vi.fn().mockResolvedValue(0) };

    await expect(new NotificationService(repository as never).removePushToken(1n, "ExponentPushToken[x]")).rejects.toBeInstanceOf(NotFoundError);
  });
});
