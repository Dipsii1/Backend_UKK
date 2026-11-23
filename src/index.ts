import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pathToFileURL } from "node:url";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { setupSwagger } from "./config/swagger.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { requestLogger } from "./middlewares/logger.middleware.js";
import { rateLimit } from "./middlewares/security.middleware.js";
import authRouter from "./modules/auth/auth.route.js";
import userRouter from "./modules/user/user.route.js";
import eventRouter from "./modules/event/event.route.js";
import organizerRouter from "./modules/organizer/organizer.route.js";
import adminRouter from "./modules/admin/admin.route.js";
import cartRouter from "./modules/cart/cart.route.js";
import healthRouter from "./modules/health/health.route.js";
import paymentRouter from "./modules/payment/payment.route.js";
import ticketRouter from "./modules/ticket/ticket.route.js";
import checkInRouter from "./modules/check-in/check-in.route.js";
import notificationRouter from "./modules/notification/notification.route.js";
import { initSocket } from "./lib/socket.js";
import { CartRepository } from "./modules/cart/cart.repository.js";
import { CartService, cartRules } from "./modules/cart/cart.service.js";
import seatMapRouter from "./modules/seat-map/seat-map.route.js";
import { SeatMapRepository } from "./modules/seat-map/seat-map.repository.js";
import { SeatMapService } from "./modules/seat-map/seat-map.service.js";

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.disable("x-powered-by");
// Aktifkan hanya bila di belakang reverse proxy; jika tidak, X-Forwarded-For bisa dipalsukan.
if (env.TRUST_PROXY) app.set("trust proxy", 1);
app.use(requestLogger);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());
app.use("/api", rateLimit(15 * 60 * 1000, 300));

app.use("/api/v1/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/events", eventRouter);
app.use("/api/v1/organizer", organizerRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/payments", paymentRouter);
app.use("/api/v1/me/tickets", ticketRouter);
app.use("/api/v1/check-in", checkInRouter);
app.use("/api/v1/notifications", notificationRouter);
app.use("/api/v1", seatMapRouter);

setupSwagger(app);
app.use(notFoundHandler);
app.use(errorHandler);

export { app, prisma };

// Only start server when this file is the entry point (not when imported by tests)
const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  prisma.$connect().then(() => {
    const server = app.listen(env.PORT, () => {
      console.log(`Server running at http://localhost:${env.PORT}`);
    });
    initSocket(server);

    // shortcut: interval per proses, cukup untuk satu instance; pindah ke satu worker/cron bila server di-scale horizontal.
    const cartService = new CartService(new CartRepository(cartRules));
    const seatMapService = new SeatMapService(new SeatMapRepository());
    setInterval(() => {
      cartService.expireStaleOrders().catch((error) => console.error("Gagal melepas order kadaluarsa:", error));
      seatMapService.expireStaleReservations().catch((error) => console.error("Gagal melepas hold kursi:", error));
    }, 60_000);
  });
}
