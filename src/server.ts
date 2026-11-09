import { app, prisma } from "./app.js";
import { env } from "./config/env.js";

prisma.$connect().then(() => {
  app.listen(env.PORT, () => {
    console.log(`Server running at http://localhost:${env.PORT}`);
  });
});
