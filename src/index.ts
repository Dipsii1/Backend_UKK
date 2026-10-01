import cookieParser from "cookie-parser";
import express from "express";
import { env } from "./config/env.js";
import { prisma } from "./config/database.js";
import { setupSwagger } from "./config/swagger.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { requestLogger } from "./middlewares/logger.middleware.js";
import authRouter from "./routes/auth.route.js";
import userRouter from "./routes/user.route.js";

const app = express();

app.use(requestLogger);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);

setupSwagger(app);
app.use(errorHandler);

prisma.$connect().then(() => {
  app.listen(env.PORT, () => {
    console.log(`Server running at http://localhost:${env.PORT}`);
  });
});
