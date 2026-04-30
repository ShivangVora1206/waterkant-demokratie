import express from "express";
import crypto from "node:crypto";
import { getDb } from "../db.js";
import { printSessionTodosReceipt } from "../services/receiptPrinter.js";

const router = express.Router();

router.post("/sessions", async (req, res) => {
  const db = getDb();
  const sessionUid = crypto.randomUUID();
  const [id] = await db("sessions").insert({ session_uid: sessionUid });
  const session = await db("sessions").where({ id }).first();
  res.status(201).json({ session_uid: session.session_uid, started_at: session.started_at });
});

router.post("/sessions/:sessionUid/complete", async (req, res) => {
  const db = getDb();
  const { sessionUid } = req.params;
  const session = await db("sessions").where({ session_uid: sessionUid }).first("id");
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  await db("sessions").where({ id: session.id }).update({ ended_at: db.fn.now() });

  const existing = await db("session_todos").where({ session_id: session.id }).first("id");
  if (!existing) {
    const randomTodos = await db("todos")
      .select("id")
      .where({ is_active: true })
      .orderByRaw("RANDOM()")
      .limit(3);

    if (randomTodos.length) {
      await db("session_todos").insert(
        randomTodos.map((todo) => ({
          session_id: session.id,
          todo_id: todo.id
        }))
      );
    }
  }

  return res.json({ ok: true });
});

router.get("/images", async (req, res) => {
  const db = getDb();
  const images = await db("images")
    .select("id", "image_uid", "filename", "display_name", "title", "order_index")
    .orderBy("order_index", "asc")
    .orderBy("id", "asc");
  const withUrl = images.map((image) => ({
    ...image,
    media_url: `/media/${image.filename}`
  }));
  res.json(withUrl);
});

router.get("/images/:id/questions", async (req, res) => {
  const db = getDb();
  const imageId = Number(req.params.id);
  if (!Number.isInteger(imageId)) {
    return res.status(400).json({ error: "Invalid image id" });
  }

  const questions = await db("questions")
    .select("id", "prompt", "order_index", "type", "required")
    .where({ image_id: imageId })
    .orderBy("order_index", "asc")
    .orderBy("id", "asc");

  return res.json(questions);
});

router.post("/responses", async (req, res) => {
  const db = getDb();
  const { session_uid, image_id, question_id, answer } = req.body;
  if (!session_uid || !image_id || !question_id || typeof answer !== "string") {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const session = await db("sessions").where({ session_uid }).first("id");
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  await db("responses")
    .insert({
      session_id: session.id,
      image_id,
      question_id,
      answer
    })
    .onConflict(["session_id", "question_id"])
    .merge({ answer, created_at: db.fn.now() });

  return res.status(201).json({ ok: true });
});

router.get("/sessions/:sessionUid/summary", async (req, res) => {
  const db = getDb();
  const { sessionUid } = req.params;
  const session = await db("sessions").where({ session_uid: sessionUid }).first("id", "session_uid", "started_at", "ended_at");
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const rows = await db("responses as r")
    .leftJoin("questions as q", "q.id", "r.question_id")
    .leftJoin("images as i", "i.id", "r.image_id")
    .select(
      "i.id as image_id",
      "i.title as image_title",
      "i.display_name as image_display_name",
      "q.id as question_id",
      "q.prompt as question_prompt",
      "r.answer",
      "r.created_at"
    )
    .where("r.session_id", session.id)
    .orderBy("i.order_index", "asc")
    .orderBy("q.order_index", "asc")
    .orderBy("r.id", "asc");

  const selectedTodos = await db("session_todos as st")
    .leftJoin("todos as t", "t.id", "st.todo_id")
    .select("t.id", "t.title", "t.details", "t.category", "t.effort", "t.timeframe")
    .where("st.session_id", session.id)
    .orderBy("st.id", "asc");

  res.json({
    session,
    responses: rows,
    selected_todos: selectedTodos
  });
});

router.post("/sessions/:sessionUid/print-todos", async (req, res) => {
  const db = getDb();
  const { sessionUid } = req.params;
  const session = await db("sessions").where({ session_uid: sessionUid }).first("id", "session_uid", "started_at", "ended_at");
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  const selectedTodos = await db("session_todos as st")
    .leftJoin("todos as t", "t.id", "st.todo_id")
    .select("t.id", "t.title", "t.details", "t.category", "t.effort", "t.timeframe")
    .where("st.session_id", session.id)
    .orderBy("st.id", "asc");

  try {
    await printSessionTodosReceipt(session, selectedTodos);
    return res.json({ ok: true, printed_count: selectedTodos.length });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message || "Print failed" });
  }
});

export default router;
