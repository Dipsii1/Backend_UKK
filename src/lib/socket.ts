import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { verifyAccessToken } from "../middlewares/auth.middleware.js";
import { UserAuthRepository } from "../modules/auth/auth.repository.js";

// Satu instance Socket.IO; null saat test/import tanpa server sehingga emit menjadi no-op.
let io: Server | null = null;

const userRoom = (userId: bigint) => `user:${userId}`;
const roleRoom = (role: string) => `role:${role}`;

// Socket.IO memakai JSON.stringify yang gagal pada BigInt.
const plain = (data: unknown) =>
  JSON.parse(JSON.stringify(data, (_key, value) => (typeof value === "bigint" ? value.toString() : value)));

export const initSocket = (server: HttpServer) => {
  io = new Server(server, { cors: { origin: env.CORS_ORIGIN, credentials: true } });

  // Handshake wajib membawa access token: io(url, { auth: { token } }).
  // shortcut: token hanya dicek saat connect (bukan saat expired/akun dinonaktifkan), upgrade dengan disconnect paksa bila perlu.
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== "string") throw new Error("missing token");
      const userId = verifyAccessToken(token);
      const user = await new UserAuthRepository().findAuthUserById(userId);
      if (!user || !user.is_active || !user.email_verified) throw new Error("inactive user");
      await socket.join([userRoom(userId), roleRoom(user.role.name)]);
      next();
    } catch {
      next(new Error("Autentikasi socket gagal"));
    }
  });

  return io;
};

export const emitToUser = (userId: bigint, event: string, data: unknown) => {
  io?.to(userRoom(userId)).emit(event, plain(data));
};

export const emitToRole = (role: string, event: string, data: unknown) => {
  io?.to(roleRoom(role)).emit(event, plain(data));
};

export const emitToAll = (event: string, data: unknown) => {
  io?.emit(event, plain(data));
};
