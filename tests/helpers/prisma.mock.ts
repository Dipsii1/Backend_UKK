import { mockDeep, mockReset } from "vitest-mock-extended";
import { afterEach } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client.js";

export const prismaMock = mockDeep<PrismaClient>();

export const resetPrismaMock = (): void => {
  mockReset(prismaMock);
};

afterEach(resetPrismaMock);
