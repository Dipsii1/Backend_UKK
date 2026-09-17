import cookieParser from "cookie-parser";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import authRouter from "./routes/auth.route.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Server running at http://localhost:${env.PORT}`);
});
