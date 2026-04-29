import { config } from "./config.js";
import { initDb } from "./db.js";
import { createApp } from "./app.js";

async function bootstrap() {
  await initDb();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Backend listening on http://localhost:${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Startup failure", error);
  process.exit(1);
});
