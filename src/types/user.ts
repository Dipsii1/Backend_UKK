import type { Prisma } from "../generated/prisma/client.js";

export type User = Prisma.usersGetPayload<{
  select: {
    id: true;
    public_id: true;
    email: true;
    is_active: true;
    created_at: true;
    updated_at: true;
    role: { select: { name: true } };
    userProfiles: true;
  };
}>;

export type UpdateUser = {
  username?: string;
  email?: string;
  role_id?: bigint;
};