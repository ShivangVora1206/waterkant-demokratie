import express from "express";
import cors from "cors";
import path from "node:path";
import publicRoutes from "./routes/public.js";
import adminRoutes from "./routes/admin.js";
import { getPaths } from "./db.js";

export function createApp() {
  const app = express();
  const { imageDir } = getPaths();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/media", express.static(path.resolve(imageDir)));
  app.use("/api", publicRoutes);
  app.use("/api/admin", adminRoutes);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
