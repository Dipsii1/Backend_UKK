import { HealthRepository } from "./health.repository.js";

export class HealthService {
  constructor(private readonly healthRepo: HealthRepository = new HealthRepository()) {}

  async check() {
    let database: "up" | "down" = "up";
    try {
      await this.healthRepo.ping();
    } catch {
      database = "down";
    }

    return {
      status: database === "up" ? ("ok" as const) : ("degraded" as const),
      database,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
