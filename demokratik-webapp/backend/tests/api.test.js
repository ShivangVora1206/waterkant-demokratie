import path from "node:path";
import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

const testDataDir = path.resolve(process.cwd(), "test-data");
process.env.DATA_DIR = testDataDir;
process.env.JWT_SECRET = "test-secret";

const { initDb, closeDb, getDb } = await import("../src/db.js");
const { createApp } = await import("../src/app.js");

const app = createApp();

test.before(async () => {
  fs.rmSync(testDataDir, { recursive: true, force: true });
  await initDb();

  const db = getDb();
  const [imageId] = await db("images").insert({
    image_uid: "test-image-uid",
    filename: "test-image.jpg",
    title: "Test Image",
    order_index: 1
  });
  await db("questions").insert({
    image_id: imageId,
    prompt: "What do you see?",
    order_index: 1,
    required: true,
    type: "text"
  });

  await db("todos").insert([
    { title: "Read a chapter", details: "Read any chapter for 15 minutes", is_active: true },
    { title: "Take a walk", details: "Walk outside for 20 minutes", is_active: true },
    { title: "Hydrate", details: "Drink two glasses of water", is_active: true },
    { title: "Journal", details: "Write three reflections", is_active: true }
  ]);
});

test.after(async () => {
  await closeDb();
  fs.rmSync(testDataDir, { recursive: true, force: true });
});

test("creates session and stores response", async () => {
  const loginRes = await request(app).post("/api/admin/login").send({ username: "admin", password: "change-me" });
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.body.token);

  const printerGetRes = await request(app)
    .get("/api/admin/printer-settings")
    .set("Authorization", `Bearer ${loginRes.body.token}`);
  assert.equal(printerGetRes.status, 200);
  assert.equal(printerGetRes.body.enabled, false);

  const printerPutRes = await request(app)
    .put("/api/admin/printer-settings")
    .set("Authorization", `Bearer ${loginRes.body.token}`)
    .send({
      enabled: false,
      host: "192.168.1.50",
      port: 9100,
      receipt_title: "Demo Todos",
      footer_text: "Thanks",
      paper_width: 42,
      cut_paper: true
    });
  assert.equal(printerPutRes.status, 200);
  assert.equal(printerPutRes.body.host, "192.168.1.50");

  const sessionRes = await request(app).post("/api/sessions").send({});
  assert.equal(sessionRes.status, 201);
  assert.ok(sessionRes.body.session_uid);

  const imagesRes = await request(app).get("/api/images");
  assert.equal(imagesRes.status, 200);
  assert.equal(imagesRes.body.length, 1);

  const questionsRes = await request(app).get(`/api/images/${imagesRes.body[0].id}/questions`);
  assert.equal(questionsRes.status, 200);
  assert.equal(questionsRes.body.length, 1);

  const saveRes = await request(app).post("/api/responses").send({
    session_uid: sessionRes.body.session_uid,
    image_id: imagesRes.body[0].id,
    question_id: questionsRes.body[0].id,
    answer: "A horizon"
  });
  assert.equal(saveRes.status, 201);

  const completeRes = await request(app).post(`/api/sessions/${sessionRes.body.session_uid}/complete`).send({});
  assert.equal(completeRes.status, 200);

  const summaryRes = await request(app).get(`/api/sessions/${sessionRes.body.session_uid}/summary`);
  assert.equal(summaryRes.status, 200);
  assert.equal(summaryRes.body.responses.length, 1);
  assert.equal(summaryRes.body.responses[0].answer, "A horizon");
  assert.equal(summaryRes.body.selected_todos.length, 3);

  const printRes = await request(app).post(`/api/sessions/${sessionRes.body.session_uid}/print-todos`).send({});
  assert.equal(printRes.status, 409);
});
