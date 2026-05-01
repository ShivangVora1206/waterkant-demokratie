import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stringify } from "csv-stringify/sync";
import { getDb, getPaths } from "../db.js";
import { config } from "../config.js";
import { requireAdmin } from "../middleware/auth.js";
import { getPrinterSettings, printTestReceipt, savePrinterSettings } from "../services/receiptPrinter.js";

const execFileAsync = promisify(execFile);
const router = express.Router();
const { imageDir, backupDir } = getPaths();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, imageDir),
  filename: (_req, file, cb) => {
    const imageUid = crypto.randomUUID();
    const ext = path.extname(file.originalname || "").toLowerCase() || ".bin";
    cb(null, `${imageUid}${ext}`);
  }
});

const upload = multer({ storage });
const uploadCsv = multer({ storage: multer.memoryStorage() });

router.post("/login", async (req, res) => {
  const db = getDb();
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const admin = await db("admin_users").where({ username }).first();
  if (!admin) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign({ sub: admin.id, username: admin.username }, config.jwtSecret, { expiresIn: "24h" });
  return res.json({ token });
});

router.use(requireAdmin);

router.get("/images", async (_req, res) => {
  const db = getDb();
  const images = await db("images").select("*").orderBy("order_index", "asc").orderBy("id", "asc");
  res.json(images);
});

router.post("/images", upload.single("image"), async (req, res) => {
  const db = getDb();
  if (!req.file) {
    return res.status(400).json({ error: "Image file required" });
  }

  const imageUid = path.basename(req.file.filename, path.extname(req.file.filename));
  const payload = {
    image_uid: imageUid,
    filename: req.file.filename,
    title: req.body.title || null,
    display_name: req.body.display_name || null,
    order_index: Number(req.body.order_index || 0)
  };

  const [id] = await db("images").insert(payload);
  const image = await db("images").where({ id }).first();
  return res.status(201).json(image);
});

router.put("/images/:id", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const patch = {
    title: req.body.title ?? null,
    display_name: req.body.display_name ?? null,
    order_index: Number(req.body.order_index ?? 0)
  };
  const updated = await db("images").where({ id }).update(patch);
  if (!updated) {
    return res.status(404).json({ error: "Image not found" });
  }
  const image = await db("images").where({ id }).first();
  return res.json(image);
});

router.delete("/images/:id", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const image = await db("images").where({ id }).first();
  if (!image) {
    return res.status(404).json({ error: "Image not found" });
  }

  await db("images").where({ id }).del();
  const filePath = path.join(imageDir, image.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  return res.json({ ok: true });
});

router.get("/questions", async (req, res) => {
  const db = getDb();
  let query = db("questions").select("*");
  if (req.query.image_id) {
    query = query.where({ image_id: Number(req.query.image_id) });
  }
  const questions = await query.orderBy("order_index", "asc").orderBy("id", "asc");
  return res.json(questions);
});

router.post("/questions", async (req, res) => {
  const db = getDb();
  const { image_id, prompt, order_index, required, type } = req.body;
  if (!image_id || !prompt) {
    return res.status(400).json({ error: "image_id and prompt required" });
  }
  const [id] = await db("questions").insert({
    image_id: Number(image_id),
    prompt,
    order_index: Number(order_index || 0),
    required: Boolean(required ?? true),
    type: type || "text"
  });
  const question = await db("questions").where({ id }).first();
  return res.status(201).json(question);
});

router.put("/questions/:id", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const updated = await db("questions").where({ id }).update({
    prompt: req.body.prompt,
    order_index: Number(req.body.order_index ?? 0),
    required: Boolean(req.body.required ?? true),
    type: req.body.type || "text"
  });
  if (!updated) {
    return res.status(404).json({ error: "Question not found" });
  }
  const question = await db("questions").where({ id }).first();
  return res.json(question);
});

router.delete("/questions/:id", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const deleted = await db("questions").where({ id }).del();
  if (!deleted) {
    return res.status(404).json({ error: "Question not found" });
  }
  return res.json({ ok: true });
});

router.get("/todos", async (_req, res) => {
  const db = getDb();
  const todos = await db("todos").select("*").orderBy("id", "desc");
  return res.json(todos);
});

router.post("/todos/import", uploadCsv.single("csv"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No CSV file uploaded." });
  }
  
  const raw = req.file.buffer.toString("utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const rows = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (i === 0 && lines[i].toLowerCase().startsWith("kategorie")) {
      continue;
    }
    const trimmed = lines[i].trim();
    const firstComma = trimmed.indexOf(",");
    const lastComma = trimmed.lastIndexOf(",");
    if (firstComma === -1 || lastComma === -1 || firstComma === lastComma) continue;
    const secondLastComma = trimmed.lastIndexOf(",", lastComma - 1);
    if (secondLastComma === -1) continue;

    const category = trimmed.slice(0, firstComma).trim();
    const todoText = trimmed.slice(firstComma + 1, secondLastComma).trim();
    const effort = trimmed.slice(secondLastComma + 1, lastComma).trim();
    const timeframe = trimmed.slice(lastComma + 1).trim();

    if (category && todoText) {
      rows.push({
        title: todoText,
        details: null,
        category: category,
        effort: effort || null,
        timeframe: timeframe || null,
        is_active: true
      });
    }
  }

  if (!rows.length) {
    return res.status(400).json({ error: "No valid todos parsed from CSV." });
  }

  const db = getDb();
  try {
    await db.transaction(async (trx) => {
      await trx("session_todos").del();
      await trx("todos").del();
      await trx("todos").insert(rows);
    });
    return res.json({ ok: true, count: rows.length });
  } catch (error) {
    return res.status(500).json({ error: "Database error during import" });
  }
});

router.post("/todos", async (req, res) => {
  const db = getDb();
  const { title, details, is_active, category, effort, timeframe } = req.body;
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: "title is required" });
  }

  const [id] = await db("todos").insert({
    title: String(title).trim(),
    details: details ? String(details) : null,
    is_active: Boolean(is_active ?? true),
    category: category ? String(category) : null,
    effort: effort ? String(effort) : null,
    timeframe: timeframe ? String(timeframe) : null
  });

  const todo = await db("todos").where({ id }).first();
  return res.status(201).json(todo);
});

router.put("/todos/:id", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const todo = await db("todos").where({ id }).first();
  if (!todo) {
    return res.status(404).json({ error: "Todo not found" });
  }

  const patch = {
    title: req.body.title !== undefined ? String(req.body.title).trim() : todo.title,
    details: req.body.details !== undefined ? (req.body.details ? String(req.body.details) : null) : todo.details,
    is_active: req.body.is_active !== undefined ? Boolean(req.body.is_active) : todo.is_active,
    category: req.body.category !== undefined ? (req.body.category ? String(req.body.category) : null) : todo.category,
    effort: req.body.effort !== undefined ? (req.body.effort ? String(req.body.effort) : null) : todo.effort,
    timeframe: req.body.timeframe !== undefined ? (req.body.timeframe ? String(req.body.timeframe) : null) : todo.timeframe
  };

  if (!patch.title) {
    return res.status(400).json({ error: "title is required" });
  }

  await db("todos").where({ id }).update(patch);
  const updatedTodo = await db("todos").where({ id }).first();
  return res.json(updatedTodo);
});

router.delete("/todos/:id", async (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const deleted = await db("todos").where({ id }).del();
  if (!deleted) {
    return res.status(404).json({ error: "Todo not found" });
  }
  return res.json({ ok: true });
});

router.get("/printer-settings", async (_req, res) => {
  const settings = await getPrinterSettings();
  return res.json(settings);
});

router.put("/printer-settings", async (req, res) => {
  if (req.body.enabled && !req.body.host) {
    return res.status(400).json({ error: "Printer host is required when enabled" });
  }

  const settings = await savePrinterSettings(req.body);
  return res.json(settings);
});

router.post("/printer-settings/test-print", async (_req, res) => {
  try {
    await printTestReceipt();
    return res.json({ ok: true });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Printer test failed" });
  }
});

router.get("/responses", async (req, res) => {
  const db = getDb();
  const rows = await db("responses as r")
    .leftJoin("sessions as s", "s.id", "r.session_id")
    .leftJoin("images as i", "i.id", "r.image_id")
    .leftJoin("questions as q", "q.id", "r.question_id")
    .select(
      "r.id",
      "s.session_uid",
      "s.started_at",
      "i.image_uid",
      "i.title as image_title",
      "q.prompt as question_prompt",
      "r.answer",
      "r.created_at"
    )
    .orderBy("r.id", "desc");

  if (req.query.format === "csv") {
    const csv = stringify(rows, { header: true });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=responses.csv");
    return res.send(csv);
  }

  return res.json(rows);
});

router.post("/backup", async (_req, res) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const archiveName = `backup-${timestamp}.tar.gz`;
  const archivePath = path.join(backupDir, archiveName);

  try {
    await execFileAsync("tar", ["-czf", archivePath, "-C", config.dataDir, "db.sqlite", "images"]);
    return res.status(201).json({ file: archiveName, download_url: `/api/admin/backups/${archiveName}` });
  } catch (error) {
    return res.status(500).json({ error: "Backup failed", detail: error.message });
  }
});

router.get("/backups/:name", async (req, res) => {
  const name = path.basename(req.params.name);
  const backupPath = path.join(backupDir, name);
  if (!fs.existsSync(backupPath)) {
    return res.status(404).json({ error: "Backup not found" });
  }
  return res.download(backupPath, name);
});

router.post("/change-password", async (req, res) => {
  const db = getDb();
  const { old_password, new_password } = req.body;
  const admin = await db("admin_users").where({ id: req.admin.sub }).first();
  const ok = await bcrypt.compare(old_password || "", admin.password_hash);
  if (!ok) {
    return res.status(401).json({ error: "Old password invalid" });
  }
  const passwordHash = await bcrypt.hash(new_password, 10);
  await db("admin_users").where({ id: admin.id }).update({ password_hash: passwordHash });
  return res.json({ ok: true });
});

export default router;
