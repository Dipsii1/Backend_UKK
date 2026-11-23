import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import jwt from "jsonwebtoken";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import { initSocket } from "../src/lib/socket.js";

const findAuthUserById = vi.hoisted(() => vi.fn());
vi.mock("../src/modules/auth/auth.repository.js", () => ({
  UserAuthRepository: class {
    findAuthUserById = findAuthUserById;
  },
}));

let server: Server;
let base: string;

// Handshake Socket.IO via HTTP long-polling: buka sesi, kirim CONNECT ("40" + auth), baca balasannya.
const connect = async (auth: unknown) => {
  const open = await (await fetch(base)).text();
  const sid = JSON.parse(open.slice(1)).sid;
  await fetch(`${base}&sid=${sid}`, { method: "POST", body: `40${JSON.stringify(auth)}` });
  return (await fetch(`${base}&sid=${sid}`)).text();
};

const accessToken = (id: bigint) => jwt.sign({ sub: id.toString(), type: "access" }, env.JWT_SECRET, { expiresIn: "15m" });
const activeUser = { is_active: true, email_verified: true, role: { name: "buyer" } };

beforeAll(async () => {
  server = createServer();
  initSocket(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  base = `http://localhost:${(server.address() as AddressInfo).port}/socket.io/?EIO=4&transport=polling`;
});

afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

describe("Socket.IO handshake auth", () => {
  it("rejects a missing or invalid access token without touching the database", async () => {
    expect(await connect({})).toBe('44{"message":"Autentikasi socket gagal"}');
    expect(await connect({ token: "bad" })).toBe('44{"message":"Autentikasi socket gagal"}');
    expect(findAuthUserById).not.toHaveBeenCalled();
  });

  it("rejects a refresh token used as an access token", async () => {
    const refresh = jwt.sign({ sub: "1", type: "refresh" }, env.JWT_SECRET, { expiresIn: "7d" });

    expect(await connect({ token: refresh })).toBe('44{"message":"Autentikasi socket gagal"}');
  });

  it("rejects inactive or unverified users", async () => {
    findAuthUserById.mockResolvedValueOnce({ ...activeUser, is_active: false });
    expect(await connect({ token: accessToken(1n) })).toBe('44{"message":"Autentikasi socket gagal"}');

    findAuthUserById.mockResolvedValueOnce({ ...activeUser, email_verified: false });
    expect(await connect({ token: accessToken(1n) })).toBe('44{"message":"Autentikasi socket gagal"}');
  });

  it("connects an active, verified user", async () => {
    findAuthUserById.mockResolvedValueOnce(activeUser);

    expect(await connect({ token: accessToken(7n) })).toMatch(/^40\{"sid":/);
    expect(findAuthUserById).toHaveBeenCalledWith(7n);
  });
});
