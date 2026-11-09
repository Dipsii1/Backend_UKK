import cookieParser from "cookie-parser";
import express from "express";
import { pathToFileURL } from "node:url";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { setupSwagger } from "./config/swagger.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { requestLogger } from "./middlewares/logger.middleware.js";
import authRouter from "./routes/auth.route.js";
import userRouter from "./routes/user.route.js";
import eventRouter from "./routes/event.route.js";

const app = express();

app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/events", eventRouter);

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