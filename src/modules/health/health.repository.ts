import { prisma } from "../../lib/prisma.js";

export class HealthRepository {
  async ping(): Promise<void> {
    await prisma.$queryRaw`SELECT 1`;
  }
}
