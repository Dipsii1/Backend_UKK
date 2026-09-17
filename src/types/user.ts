import type { users } from "../generated/prisma/client.js";

export type User = users & {
  role: { name: string };
};

export type UpdateUser = {
  username?: string;
  email?: string;
  role_id?: bigint;
};
