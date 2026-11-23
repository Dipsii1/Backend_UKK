const healthData = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["ok", "degraded"], example: "ok" },
    database: { type: "string", enum: ["up", "down"], example: "up" },
    uptime: { type: "integer", description: "Uptime proses dalam detik", example: 3600 },
    timestamp: { type: "string", format: "date-time" },
  },
};

const body = (success: boolean, code: string, status: number, message: string, dataKey: "data" | "errors") => ({
  description: message,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          success: { type: "boolean", example: success },
          code: { type: "string", example: code },
          status: { type: "integer", example: status },
          message: { type: "string", example: message },
          [dataKey]: healthData,
        },
      },
    },
  },
});

export const healthPaths = {
  "/health": {
    get: {
      tags: ["Health"],
      summary: "Cek kesehatan layanan dan koneksi database",
      description: "Endpoint publik untuk uptime monitor / load balancer. Mengembalikan 503 bila database tidak dapat dijangkau.",
      responses: {
        "200": body(true, "OK", 200, "Layanan berjalan normal", "data"),
        "503": body(false, "SERVICE_UNAVAILABLE", 503, "Database tidak dapat dijangkau", "errors"),
      },
    },
  },
};
