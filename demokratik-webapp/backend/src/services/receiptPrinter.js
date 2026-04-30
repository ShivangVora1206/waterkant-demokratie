import net from "node:net";
import { getDb } from "../db.js";

const DEFAULT_SETTINGS = {
  id: 1,
  enabled: false,
  host: "",
  port: 9100,
  paper_width: 42,
  cut_paper: true,
  receipt_title: "Suggested Todos",
  footer_text: "Thank you",
  barcode_message: "DEMOKRATIE"
};

function normalizeSettings(settings = {}) {
  return {
    id: 1,
    enabled: Boolean(settings.enabled),
    host: settings.host ? String(settings.host).trim() : "",
    port: Number(settings.port || DEFAULT_SETTINGS.port),
    paper_width: Number(settings.paper_width || DEFAULT_SETTINGS.paper_width),
    cut_paper: settings.cut_paper === undefined ? DEFAULT_SETTINGS.cut_paper : Boolean(settings.cut_paper),
    receipt_title: settings.receipt_title ? String(settings.receipt_title).trim() : DEFAULT_SETTINGS.receipt_title,
    footer_text: settings.footer_text ? String(settings.footer_text).trim() : DEFAULT_SETTINGS.footer_text,
    barcode_message: settings.barcode_message ? String(settings.barcode_message).trim() : DEFAULT_SETTINGS.barcode_message
  };
}

function wrapText(text, width) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [""];
  }

  const lines = [];
  let current = "";

  for (const word of words) {
    if (!current.length) {
      current = word;
      continue;
    }

    if ((current.length + 1 + word.length) <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current.length) {
    lines.push(current);
  }

  return lines;
}

function buildReceiptText({ settings, session, todos, kind = "todos" }) {
  const width = Math.max(24, Number(settings.paper_width) || DEFAULT_SETTINGS.paper_width);
  const parts = [];
  const separator = "=".repeat(Math.min(width, 42));
  const dashSeparator = "-".repeat(Math.min(width, 42));

  // Helper to create alignment markers
  const center = (text) => `[CENTER]${text}[/CENTER]`;
  const left = (text) => `[LEFT]${text}[/LEFT]`;

  parts.push("");
  parts.push(center(separator));
  parts.push(center("DEMOKRATIE SPÄTI"));
  parts.push(center("Platz der Demokratie 89"));
  parts.push(center("24-Stunden geöffnet"));
  parts.push(center(separator));
  parts.push("");

  parts.push(left("DEINE QUITTUNG"));
  const sessionDate = new Date(session.started_at);
  const dateStr = sessionDate.toLocaleDateString("de-DE");
  const timeStr = sessionDate.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  parts.push(left(`Datum: ${dateStr} | ${timeStr} Uhr`));
  parts.push("");

  parts.push(center(dashSeparator));
  parts.push(center("MITGEMACHT {CHECK}"));
  parts.push(center("NACHGEDACHT {CHECK}"));
  parts.push(center("WEITERMACHEN!"));
  parts.push(center(dashSeparator));
  parts.push("");

  if (kind === "test") {
    parts.push(center("Printer connection test"));
    parts.push(center("Configuration looks good."));
  } else {
    parts.push(left("DEINE 3 TODOS:"));
    parts.push("");
    if (!todos.length) {
      parts.push(left("Keine Todos ausgewählt."));
    } else {
      todos.forEach((todo, index) => {
        const timeframe = todo.timeframe ? String(todo.timeframe).trim() : "";
        const timeframeLabel = timeframe ? timeframe[0].toUpperCase() + timeframe.slice(1) : "";
        const category = todo.category ? String(todo.category).trim() : "";
        const header = `${index + 1}. ${timeframeLabel}${category ? ", " : ""}${category}:`;
        parts.push(left(header));
        wrapText(todo.title || "", width).forEach((line) => {
          parts.push(left(line));
        });
        parts.push("");
      });
    }
  }

  parts.push(center(dashSeparator));
  parts.push(center("Gültig: Die nächsten 30 Tage"));
  parts.push(center(dashSeparator));
  parts.push("");
  parts.push(center('"Demokratie passiert nicht'));
  parts.push(center('nur alle vier Jahre."'));
  parts.push("");

  parts.push(center(separator));
  parts.push(center("Danke für deinen Besuch im"));
  parts.push(center("DEMOKRATIE SPÄTI"));
  parts.push(center(separator));
  parts.push("");
  parts.push("[BARCODE]");
  parts.push(center(separator));
  parts.push("");

  return parts.join("\n");
}

function encodeCp858(text) {
  const map = {
    "Ä": 0x8e,
    "Ö": 0x99,
    "Ü": 0x9a,
    "ä": 0x84,
    "ö": 0x94,
    "ü": 0x81,
    "ß": 0xe1,
    "€": 0xd5
  };

  const bytes = [];
  for (const ch of String(text)) {
    if (map[ch] !== undefined) {
      bytes.push(map[ch]);
      continue;
    }

    const code = ch.codePointAt(0);
    if (code <= 0xff) {
      bytes.push(code);
    } else {
      bytes.push(0x3f);
    }
  }

  return Buffer.from(bytes);
}

function appendEncodedWithChecks(parts, text) {
  const segments = String(text).split("{CHECK}");
  segments.forEach((segment, index) => {
    if (segment) {
      parts.push(encodeCp858(segment));
    }
    if (index < segments.length - 1) {
      parts.push(Buffer.from([0x1b, 0x74, 0x00])); // ESC t 0 - CP437
      parts.push(Buffer.from([0xfb])); // CP437 checkmark
      parts.push(Buffer.from([0x1b, 0x74, 0x13])); // ESC t 19 - back to CP858
    }
  });
}

function sanitizeBarcodeMessage(message) {
  const trimmed = String(message || "").trim();
  if (!trimmed) {
    return "DEMOKRATIE";
  }
  return trimmed.replace(/[^\x20-\x7e]/g, "").slice(0, 64);
}

function appendBarcode(parts, message) {
  const payload = Buffer.from(sanitizeBarcodeMessage(message), "ascii");
  parts.push(Buffer.from([0x1b, 0x61, 0x01])); // ESC a 1 - Center align
  parts.push(Buffer.from([0x1d, 0x48, 0x00])); // GS H 0 - Disable HRI
  parts.push(Buffer.from([0x1d, 0x68, 0x50])); // GS h 80 - Barcode height
  parts.push(Buffer.from([0x1d, 0x77, 0x02])); // GS w 2 - Barcode width
  parts.push(Buffer.from([0x1d, 0x6b, 0x48, payload.length])); // GS k 72 n (Code93)
  parts.push(payload);
  parts.push(Buffer.from([0x0a]));
  parts.push(Buffer.from([0x1b, 0x61, 0x00])); // ESC a 0 - Left align
}

function buildEscPosPayload(text, cutPaper, barcodeMessage) {
  const lines = text.split("\n");
  const parts = [
    Buffer.from([0x1b, 0x40]),  // ESC @ - Reset
    Buffer.from([0x1b, 0x74, 0x13])  // ESC t 19 - Select CP858
  ];

  for (const line of lines) {
    if (line === "[BARCODE]") {
      appendBarcode(parts, barcodeMessage);
      continue;
    }
    if (line.startsWith("[CENTER]") && line.endsWith("[/CENTER]")) {
      const content = line.slice(8, -9);
      parts.push(Buffer.from([0x1b, 0x61, 0x01]));  // ESC a 1 - Center align
      appendEncodedWithChecks(parts, content);
      parts.push(Buffer.from([0x0a]));  // LF
      parts.push(Buffer.from([0x1b, 0x61, 0x00]));  // ESC a 0 - Left align (reset)
    } else if (line.startsWith("[LEFT]") && line.endsWith("[/LEFT]")) {
      const content = line.slice(6, -7);
      parts.push(Buffer.from([0x1b, 0x61, 0x00]));  // ESC a 0 - Left align
      appendEncodedWithChecks(parts, content);
      parts.push(Buffer.from([0x0a]));  // LF
    } else {
      appendEncodedWithChecks(parts, line);
      parts.push(Buffer.from([0x0a]));  // LF
    }
  }

  parts.push(Buffer.from("\n\n\n", "ascii"));

  if (cutPaper) {
    parts.push(Buffer.from([0x1d, 0x56, 0x00]));
  }

  return Buffer.concat(parts);
}

async function sendToPrinter(host, port, payload) {
  return await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: 7000 });
    let settled = false;

    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };

    const fail = (error) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      reject(error);
    };

    socket.once("connect", () => {
      socket.write(payload);
      socket.end();
    });
    socket.once("close", finish);
    socket.once("error", fail);
    socket.once("timeout", () => fail(new Error("Printer connection timed out")));
  });
}

export async function getPrinterSettings() {
  const db = getDb();
  const row = await db("printer_settings").where({ id: 1 }).first();
  return normalizeSettings(row || DEFAULT_SETTINGS);
}

export async function savePrinterSettings(patch) {
  const db = getDb();
  const current = await getPrinterSettings();
  const next = normalizeSettings({ ...current, ...patch });

  await db("printer_settings")
    .insert({ ...next, updated_at: db.fn.now() })
    .onConflict("id")
    .merge({
      enabled: next.enabled,
      host: next.host,
      port: next.port,
      paper_width: next.paper_width,
      cut_paper: next.cut_paper,
      receipt_title: next.receipt_title,
      footer_text: next.footer_text,
      barcode_message: next.barcode_message,
      updated_at: db.fn.now()
    });

  return next;
}

export async function printSessionTodosReceipt(session, todos) {
  const settings = await getPrinterSettings();
  if (!settings.enabled) {
    const error = new Error("Receipt printer is disabled");
    error.statusCode = 409;
    throw error;
  }
  if (!settings.host) {
    const error = new Error("Printer host is required");
    error.statusCode = 400;
    throw error;
  }

  const payload = buildEscPosPayload(
    buildReceiptText({ settings, session, todos, kind: "todos" }),
    settings.cut_paper,
    settings.barcode_message
  );
  await sendToPrinter(settings.host, settings.port, payload);
  return settings;
}

export async function printTestReceipt() {
  const settings = await getPrinterSettings();
  if (!settings.enabled) {
    const error = new Error("Receipt printer is disabled");
    error.statusCode = 409;
    throw error;
  }
  if (!settings.host) {
    const error = new Error("Printer host is required");
    error.statusCode = 400;
    throw error;
  }

  const session = { session_uid: "TEST-RECEIPT", started_at: new Date().toISOString(), ended_at: new Date().toISOString() };
  const payload = buildEscPosPayload(
    buildReceiptText({ settings, session, todos: [], kind: "test" }),
    settings.cut_paper,
    settings.barcode_message
  );
  await sendToPrinter(settings.host, settings.port, payload);
  return settings;
}