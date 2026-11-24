import swaggerUi from "swagger-ui-express";
import type { Express } from "express";
import { authPaths } from "./swagger/auth.paths.js";
import { usersPaths } from "./swagger/users.paths.js";
import { eventPaths } from "./swagger/event.paths.js";
import { organizerPaths } from "./swagger/organizer.paths.js";
import { adminPaths } from "./swagger/admin.paths.js";
import { cartPaths } from "./swagger/cart.paths.js";
import { healthPaths } from "./swagger/health.paths.js";
import { paymentPaths } from "./swagger/payment.paths.js";
import { ticketPaths } from "./swagger/ticket.paths.js";
import { notificationPaths } from "./swagger/notification.paths.js";
import { seatMapPaths } from "./swagger/seat-map.paths.js";
import { analyticsPaths } from "./swagger/analytics.paths.js";

const swaggerDocument = {
  openapi: "3.0.0",
  info: { title: "UKK API", version: "1.0.0" },
  servers: [{ url: "/api/v1" }],
  tags: [
    { name: "Health", description: "Status layanan dan koneksi database" },
    { name: "Auth", description: "Autentikasi & otorisasi" },
    { name: "Users", description: "Manajemen pengguna" },
    { name: "Events", description: "Manajemen event" },
    { name: "Organizer", description: "Festival, tiket, kuota, dan monitoring penjualan organizer" },
    { name: "Admin", description: "Approval event, manajemen pengguna dan organizer, serta monitoring sistem" },
    { name: "Cart", description: "Keranjang sementara, reservasi tiket, dan checkout" },
    { name: "Payments", description: "Pembayaran Midtrans Snap dan webhook notifikasi" },
    { name: "Tickets", description: "E-ticket milik buyer beserta QR" },
    { name: "Check-in", description: "Scan dan validasi QR e-ticket" },
    { name: "Seat maps", description: "Denah kursi organizer dan reservasi kursi buyer" },
  ],
  paths: { ...healthPaths, ...authPaths, ...usersPaths, ...eventPaths, ...organizerPaths, ...adminPaths, ...cartPaths, ...paymentPaths, ...ticketPaths, ...notificationPaths, ...seatMapPaths, ...analyticsPaths },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
};

export const setupSwagger = (app: Express) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
};
