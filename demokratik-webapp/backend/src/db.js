import fs from "node:fs";
import path from "node:path";
import knex from "knex";
import knexConfig from "../knexfile.js";
import { config } from "./config.js";

const db = knex(knexConfig);

export function getDb() {
  return db;
}

export function getPaths() {
  const imageDir = path.join(config.dataDir, "images");
  const backupDir = path.join(config.dataDir, "backups");
  const dbPath = process.env.DB_PATH || path.join(config.dataDir, "db.sqlite");
  return { imageDir, backupDir, dbPath };
}

export async function initDb() {
  const { imageDir, backupDir } = getPaths();
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(imageDir, { recursive: true });
  fs.mkdirSync(backupDir, { recursive: true });

  await db.raw("PRAGMA foreign_keys = ON");
  await db.raw("PRAGMA journal_mode = WAL");
  await db.migrate.latest();

  const existingAdmin = await db("admin_users").first("id");
  if (!existingAdmin) {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.default.hash(config.adminPassword, 10);
    await db("admin_users").insert({
      username: config.adminUsername,
      password_hash: passwordHash
    });
  }
}

export async function closeDb() {
  await db.destroy();
}
