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
  app.use(express.json({ limit: "20mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  const frontendDist = path.resolve(process.cwd(), "../frontend/dist");
  app.use(express.static(frontendDist));

  app.use("/media", express.static(path.resolve(imageDir)));
  app.use("/api", publicRoutes);
  app.use("/api/admin", adminRoutes);

  // Catch-all route to serve React's index.html for client-side routing
  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
