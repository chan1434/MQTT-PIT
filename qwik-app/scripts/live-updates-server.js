import https from "https";
import fs from "fs";
import path from "path";
import { WebSocketServer } from "ws";

const DEFAULT_PORT = Number(process.env.LIVE_UPDATES_PORT || 9443);
const HOST = process.env.LIVE_UPDATES_HOST || "0.0.0.0";
const CERT_DIR = process.env.LIVE_UPDATES_CERT_DIR
  ? path.resolve(process.env.LIVE_UPDATES_CERT_DIR)
  : path.resolve(process.cwd(), "certs");

const CERT_PATH = process.env.LIVE_UPDATES_CERT || path.join(CERT_DIR, "localhost-cert.pem");
const KEY_PATH = process.env.LIVE_UPDATES_KEY || path.join(CERT_DIR, "localhost-key.pem");

const MANILA_TIMEZONE = "Asia/Manila";
const MANILA_OFFSET = "+08:00";

const manilaFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: MANILA_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  fractionalSecondDigits: 3,
  hour12: false,
});

function formatManilaISO(date = new Date()) {
  const parts = manilaFormatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  const year = map.year;
  const month = map.month;
  const day = map.day;
  const hour = map.hour;
  const minute = map.minute;
  const second = map.second;
  const fraction = map.fractionalSecond ? `.${map.fractionalSecond}` : "";

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${fraction}${MANILA_OFFSET}`;
}

function loadTlsAssets() {
  try {
    const key = fs.readFileSync(KEY_PATH);
    const cert = fs.readFileSync(CERT_PATH);
    return { key, cert };
  } catch (error) {
    console.error("❌ Failed to read TLS certificates.");
    console.error(`   Expected key: ${KEY_PATH}`);
    console.error(`   Expected cert: ${CERT_PATH}`);
    console.error("   Run 'npm run generate-certs' from the qwik-app directory.");
    process.exit(1);
  }
}

const clients = new Set();

function broadcast(jsonPayload) {
  const data = JSON.stringify(jsonPayload);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  }
}

function createServer() {
  const tlsConfig = loadTlsAssets();

  return https.createServer(tlsConfig, async (req, res) => {
    const method = req.method || "GET";
    const url = req.url || "/";

    // Basic CORS headers for POST requests from PHP backend
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (method === "GET" && url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", clients: clients.size }));
      return;
    }

    if (method !== "POST" || url !== "/broadcast") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.socket.destroy();
      }
    });

    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const enrichedPayload = {
          type: payload.type || "rfid-log",
          data: payload.data ?? payload,
          receivedAt: formatManilaISO(),
        };

        broadcast(enrichedPayload);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, delivered: clients.size }));
      } catch (error) {
        console.error("Failed to parse broadcast payload", error);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: "Invalid JSON payload" }));
      }
    });
  });
}

const server = createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  clients.add(ws);
  console.log(`🔌 Client connected (${clients.size} total)`);

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`🔌 Client disconnected (${clients.size} remaining)`);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error", error);
  });

  ws.send(
    JSON.stringify({
      type: "welcome",
      data: {
        message: "Connected to RFID live updates",
        connectedAt: formatManilaISO(),
      },
    })
  );
});

server.listen(DEFAULT_PORT, HOST, () => {
  console.log("====================================");
  console.log(" RFID Live Updates Bridge");
  console.log("====================================");
  console.log(` 🔒 TLS key : ${KEY_PATH}`);
  console.log(` 🔒 TLS cert: ${CERT_PATH}`);
  console.log(` 🌐 Listening on https://${HOST}:${DEFAULT_PORT}`);
  console.log(" REST endpoint: POST /broadcast");
  console.log(" WebSocket:    wss://HOST:PORT");
  console.log("====================================");
});

server.on("error", (error) => {
  console.error("HTTP server error", error);
});

