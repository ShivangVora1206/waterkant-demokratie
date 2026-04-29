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

  const token = jwt.sign({ sub: admin.id, username: admin.username }, config.jwtSecret, { expiresIn: "8h" });
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
