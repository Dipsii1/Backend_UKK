import { NotificationRepository } from "./notification.repository.js";
import { NotFoundError } from "../../utils/app-error.js";
import { sendExpoPush } from "../../utils/expo-push.js";
import { emitToAll, emitToRole } from "../../lib/socket.js";
import type { BroadcastInput } from "./notification.types.js";

export class NotificationService {
  constructor(private readonly notificationRepo: NotificationRepository = new NotificationRepository()) {}

  async getMine(userId: bigint, page: number, limit: number) {
    const result = await this.notificationRepo.findByUser(userId, page, limit);
    return { ...result, page, limit, totalPages: Math.ceil(result.total / limit) };
  }

  async markRead(userId: bigint, id: bigint) {
    const notification = await this.notificationRepo.findByIdAndUser(id, userId);
    if (!notification) throw new NotFoundError("Notifikasi tidak ditemukan");
    if (notification.is_read) return notification;
    return this.notificationRepo.markRead(id);
  }

  async registerPushToken(userId: bigint, token: string) {
    await this.notificationRepo.upsertPushToken(userId, token);
  }

  async removePushToken(userId: bigint, token: string) {
    const removed = await this.notificationRepo.deletePushToken(userId, token);
    if (removed === 0) throw new NotFoundError("Push token tidak ditemukan");
  }

  async broadcast(adminId: bigint, input: BroadcastInput) {
    const userIds = await this.notificationRepo.broadcast(adminId, input);
    const payload = { title: input.title, message: input.message ?? null, type: input.type ?? "system", created_at: new Date() };

    // Realtime untuk aplikasi yang sedang terbuka; push untuk yang di background/tertutup.
    if (input.role === "all") emitToAll("notification:new", payload);
    else emitToRole(input.role, "notification:new", payload);

    const tokens = userIds.length > 0 ? await this.notificationRepo.findPushTokens(userIds) : [];
    const push = await sendExpoPush(tokens, {
      title: input.title,
      body: input.message,
      data: { type: payload.type },
    });
    if (push.invalidTokens.length > 0) await this.notificationRepo.deletePushTokens(push.invalidTokens);

    return { recipients: userIds.length, push_sent: push.sent };
  }
}
