import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pathToFileURL } from "node:url";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { setupSwagger } from "./config/swagger.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { requestLogger } from "./middlewares/logger.middleware.js";
import authRouter from "./modules/auth/auth.route.js";
import userRouter from "./modules/user/user.route.js";
import eventRouter from "./modules/event/event.route.js";
import organizerRouter from "./modules/organizer/organizer.route.js";

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(requestLogger);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/events", eventRouter);
app.use("/api/v1/organizer", organizerRouter);

setupSwagger(app);
app.use(errorHandler);

export { app, prisma };

// Only start server when this file is the entry point (not when imported by tests)
const isEntryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntryPoint) {
  prisma.$connect().then(() => {
    app.listen(env.PORT, () => {
      console.log(`Server running at http://localhost:${env.PORT}`);
    });
  });
}
