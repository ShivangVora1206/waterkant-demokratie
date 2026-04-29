import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3001),
  dataDir: process.env.DATA_DIR || path.resolve(process.cwd(), "../data"),
  adminUsername: process.env.ADMIN_USERNAME || "admin",
  adminPassword: process.env.ADMIN_PASSWORD || "change-me",
  jwtSecret: process.env.JWT_SECRET || "dev-only-secret-change-me"
};
