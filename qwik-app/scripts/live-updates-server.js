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
const clientPool = new Map();  // Connection pooling by client ID
const priorityQueue = { high: [], low: [] };  // Message priority queue
let batchTimer = null;
const BATCH_INTERVAL_MS = Number(process.env.LIVE_UPDATES_BATCH_MS || 100);
const HEARTBEAT_INTERVAL_MS = Number(process.env.LIVE_UPDATES_HEARTBEAT || 30000);

function queueBroadcast(jsonPayload, priority = 'low') {
  // Determine priority based on message type
  const msgPriority = jsonPayload.type === 'rfid-log' ? 'high' : priority;
  priorityQueue[msgPriority].push(jsonPayload);
  
  if (!batchTimer) {
    batchTimer = setTimeout(flushBroadcastQueue, BATCH_INTERVAL_MS);
  }
}

function flushBroadcastQueue() {
  batchTimer = null;
  
  // Process high priority first, limit low priority
  const batch = [
    ...priorityQueue.high.splice(0),
    ...priorityQueue.low.splice(0, 10),  // Limit low-priority messages
  ];
  
  if (batch.length === 0) {
    return;
  }

  const payload =
    batch.length === 1
      ? batch[0]
      : {
          type: "batch",
          data: batch,
          count: batch.length,
        };

  const serialized = JSON.stringify(payload);
  
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(serialized);
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

        queueBroadcast(enrichedPayload);

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
const wss = new WebSocketServer({
  server,
  perMessageDeflate: {
    zlibDeflateOptions: {
      chunkSize: 1024,
      memLevel: 7,
      level: 6,
    },
    zlibInflateOptions: {
      chunkSize: 10 * 1024,
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
    serverMaxWindowBits: 10,
    concurrencyLimit: 10,
    threshold: 1024,
  },
});

const heartbeatInterval =
  HEARTBEAT_INTERVAL_MS > 0
    ? setInterval(() => {
        for (const ws of clients) {
          if (ws.isAlive === false) {
            clients.delete(ws);
            ws.terminate();
            continue;
          }
          ws.isAlive = false;
          ws.ping();
        }
      }, HEARTBEAT_INTERVAL_MS)
    : null;

wss.on("connection", (ws, req) => {
  // Connection pooling - get client ID from headers or generate one
  const clientId = req.headers['x-client-id'] || `client-${Date.now()}-${Math.random()}`;
  
  // If client already has a connection, close the old one
  if (clientPool.has(clientId)) {
    const oldWs = clientPool.get(clientId);
    if (oldWs.readyState === oldWs.OPEN) {
      oldWs.close(1000, 'Replaced by new connection');
      clients.delete(oldWs);
    }
  }
  
  clients.add(ws);
  clientPool.set(clientId, ws);
  ws.isAlive = true;
  ws.clientId = clientId;
  console.log(`🔌 Client connected: ${clientId} (${clients.size} total)`);

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", () => {
    ws.isAlive = true;
  });

  ws.on("close", () => {
    clients.delete(ws);
    clientPool.delete(clientId);
    console.log(`🔌 Client disconnected: ${clientId} (${clients.size} remaining)`);
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error for ${clientId}:`, error);
  });

  ws.send(
    JSON.stringify({
      type: "welcome",
      data: {
        message: "Connected to RFID live updates",
        connectedAt: formatManilaISO(),
        clientId: clientId,
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

if (heartbeatInterval) {
  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });
}

