import swaggerUi from "swagger-ui-express";
import type { Express } from "express";
import { authPaths } from "./swagger/auth.paths.js";
import { usersPaths } from "./swagger/users.paths.js";
import { eventPaths } from "./swagger/event.paths.js";
import { organizerPaths } from "./swagger/organizer.paths.js";
import { adminPaths } from "./swagger/admin.paths.js";

const swaggerDocument = {
  openapi: "3.0.0",
  info: { title: "UKK API", version: "1.0.0" },
  servers: [{ url: "/api/v1" }],
  tags: [
    { name: "Auth", description: "Autentikasi & otorisasi" },
    { name: "Users", description: "Manajemen pengguna" },
    { name: "Events", description: "Manajemen event" },
    { name: "Organizer", description: "Festival, tiket, kuota, dan monitoring penjualan organizer" },
    { name: "Admin", description: "Approval event, manajemen pengguna dan organizer, serta monitoring sistem" },
  ],
  paths: { ...authPaths, ...usersPaths, ...eventPaths, ...organizerPaths, ...adminPaths },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
};

export const setupSwagger = (app: Express) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};
