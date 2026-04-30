import fs from "node:fs";
import path from "node:path";
import { initDb, getDb, closeDb } from "../src/db.js";

function parseCsvLine(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const firstComma = trimmed.indexOf(",");
  const lastComma = trimmed.lastIndexOf(",");
  if (firstComma === -1 || lastComma === -1 || firstComma === lastComma) {
    return null;
  }

  const secondLastComma = trimmed.lastIndexOf(",", lastComma - 1);
  if (secondLastComma === -1) {
    return null;
  }

  const category = trimmed.slice(0, firstComma).trim();
  const todoText = trimmed.slice(firstComma + 1, secondLastComma).trim();
  const effort = trimmed.slice(secondLastComma + 1, lastComma).trim();
  const timeframe = trimmed.slice(lastComma + 1).trim();

  if (!category || !todoText) {
    return null;
  }

  return { category, todoText, effort, timeframe };
}

async function main() {
  const defaultPath = path.resolve(process.cwd(), "..", "..", "assets", "demokratie-todos_WKExh_2026.csv");
  const inputPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultPath;

  if (!fs.existsSync(inputPath)) {
    console.error(`CSV not found: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const rows = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (i === 0 && lines[i].startsWith("kategorie")) {
      continue;
    }
    const parsed = parseCsvLine(lines[i]);
    if (!parsed) {
      continue;
    }
    rows.push({
      title: parsed.todoText,
      details: null,
      category: parsed.category,
      effort: parsed.effort || null,
      timeframe: parsed.timeframe || null,
      is_active: true
    });
  }

  if (!rows.length) {
    console.error("No todos parsed from CSV.");
    process.exit(1);
  }

  await initDb();
  const db = getDb();

  await db.transaction(async (trx) => {
    await trx("session_todos").del();
    await trx("todos").del();
    await trx("todos").insert(rows);
  });

  await closeDb();
  console.log(`Imported ${rows.length} todos from ${inputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
