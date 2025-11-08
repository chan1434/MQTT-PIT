import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { RFIDStatus, type RFIDData } from "~/components/rfid-status";
import { RFIDLogs, type LogEntry } from "~/components/rfid-logs";

// API Configuration - Update with your local IP if needed
const API_BASE_URL = "http://localhost:81/php-backend/api";
const MAX_LOG_ENTRIES = 50;
const FALLBACK_POLL_INTERVAL = 30_000; // 30 seconds fallback polling

const LIVE_UPDATES_URL = (import.meta.env.PUBLIC_LIVE_UPDATES_URL as string | undefined) || "";
const LIVE_UPDATES_PORT = Number(import.meta.env.PUBLIC_LIVE_UPDATES_PORT || "9443");
const LIVE_UPDATES_PATH = (() => {
  const rawPath = (import.meta.env.PUBLIC_LIVE_UPDATES_PATH as string | undefined) || "/";
  return rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
})();

export default component$(() => {
  const registered = useSignal<RFIDData[]>([]);
  const logs = useSignal<LogEntry[]>([]);
  const loadingRegistered = useSignal(true);
  const loadingLogs = useSignal(true);
  const lastUpdate = useSignal<string>("");
  const isOnline = useSignal(true);
  const errorMessage = useSignal<string>("");
  const liveUpdatesStatus = useSignal<"connecting" | "connected" | "disconnected" | "error">(
    "connecting"
  );
  const liveUpdatesError = useSignal<string>("");
  const togglingId = useSignal<number | null>(null);
  const actionMessage = useSignal<string>("");

  const fetchData = $(async () => {
    // Fetch registered RFIDs
    try {
      const response = await fetch(`${API_BASE_URL}/get_registered.php`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        registered.value = (data.registered as RFIDData[]).map((item) => ({
          ...item,
          rfid_status: Boolean(item.rfid_status),
          status_text:
            typeof item.status_text === "string"
              ? item.status_text
              : item.rfid_status
              ? "1"
              : "0",
        }));
        isOnline.value = true;
        errorMessage.value = "";
      } else {
        errorMessage.value = data.message || "Failed to fetch registered RFIDs";
      }
    } catch (error) {
      console.error("Error fetching registered RFIDs:", error);
      isOnline.value = false;
      errorMessage.value = "Failed to connect to backend. Is XAMPP running?";
      actionMessage.value = "";
    } finally {
      loadingRegistered.value = false;
    }

    // Fetch RFID logs
    try {
      const response = await fetch(`${API_BASE_URL}/get_logs.php?limit=${MAX_LOG_ENTRIES}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        logs.value = (data.logs as LogEntry[]).map((log) => ({
          ...log,
          rfid_status: Boolean(log.rfid_status),
          status_text:
            typeof log.status_text === "string"
              ? log.status_text
              : log.rfid_status
              ? "1"
              : "0",
          found: Boolean(log.found ?? true),
        }));
        lastUpdate.value = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
        isOnline.value = true;
        errorMessage.value = "";
        actionMessage.value = "";
      } else {
        errorMessage.value = data.message || "Failed to fetch logs";
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      isOnline.value = false;
      errorMessage.value = "Failed to connect to backend. Is XAMPP running?";
      actionMessage.value = "";
    } finally {
      loadingLogs.value = false;
    }
  });

  useVisibleTask$(({ cleanup }) => {
    const runInitialFetch = async () => {
      await fetchData();
    };

    runInitialFetch();

    const intervalId = window.setInterval(() => {
      if (liveUpdatesStatus.value !== "connected") {
        void fetchData();
      }
    }, FALLBACK_POLL_INTERVAL);

    cleanup(() => {
      window.clearInterval(intervalId);
    });
  });

  useVisibleTask$(({ cleanup }) => {
    if (typeof window === "undefined") {
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let manualClose = false;
    let attempts = 0;

    const buildWebSocketUrl = () => {
      if (LIVE_UPDATES_URL) {
        return LIVE_UPDATES_URL;
      }

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const hostname = window.location.hostname || "localhost";
      return `${protocol}://${hostname}:${LIVE_UPDATES_PORT}${LIVE_UPDATES_PATH}`;
    };

    const normalizeLogEntry = (incoming: Record<string, unknown>): LogEntry => {
      const rawId = incoming.id ?? Date.now();
      const timeLogRaw =
        (incoming.time_log as string | undefined) ||
        (incoming.timestamp as string | undefined) ||
        new Date().toISOString();
      const time = new Date(timeLogRaw);

      const timeLogFormatted =
        (incoming.time_log_formatted as string | undefined) ||
        time.toLocaleString();

      const date = (incoming.date as string | undefined) || time.toISOString().slice(0, 10);
      const time12 =
        (incoming.time_12hr as string | undefined) ||
        time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      const rfidStatus = Boolean(incoming.rfid_status);
      const incomingStatusText = incoming.status_text as string | undefined;
      const foundValue = incoming.found as boolean | undefined;

      const statusText = incomingStatusText
        ? incomingStatusText
        : foundValue === false
        ? "RFID NOT FOUND"
        : rfidStatus
        ? "1"
        : "0";

      return {
        id: Number(rawId),
        time_log: time.toISOString(),
        time_log_formatted: timeLogFormatted,
        date,
        time_12hr: time12,
        rfid_data: String(incoming.rfid_data ?? "UNKNOWN"),
        rfid_status: rfidStatus,
        status_text: statusText,
        found: foundValue ?? statusText !== "RFID NOT FOUND",
      };
    };

    const scheduleReconnect = () => {
      if (manualClose) {
        return;
      }

      liveUpdatesStatus.value = "disconnected";
      const delay = Math.min(10_000, 1_000 * Math.pow(2, attempts));
      reconnectTimer = window.setTimeout(connect, delay);
    };

    const connect = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }

      attempts += 1;
      liveUpdatesStatus.value = "connecting";
      liveUpdatesError.value = "";

      const targetUrl = buildWebSocketUrl();

      try {
        ws = new WebSocket(targetUrl);
      } catch (error) {
        console.error("Failed to construct WebSocket", error);
        liveUpdatesStatus.value = "error";
        liveUpdatesError.value = "Unable to open live updates connection.";
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        attempts = 0;
        liveUpdatesStatus.value = "connected";
        liveUpdatesError.value = "";
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          if (payload?.type === "rfid-log" && payload.data) {
            const entry = normalizeLogEntry(payload.data as Record<string, unknown>);

            logs.value = [
              entry,
              ...logs.value.filter((log) => log.id !== entry.id),
            ].slice(0, MAX_LOG_ENTRIES);

            lastUpdate.value = new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" });
            loadingLogs.value = false;
            isOnline.value = true;
            errorMessage.value = "";
          }
        } catch (error) {
          console.error("Failed to parse WebSocket payload", error);
        }
      };

      ws.onerror = (event) => {
        console.error("WebSocket error", event);
        liveUpdatesStatus.value = "error";
        liveUpdatesError.value = "Live updates connection encountered an error.";
      };

      ws.onclose = () => {
        if (!manualClose) {
          scheduleReconnect();
        }
      };
    };

    connect();

    cleanup(() => {
      manualClose = true;
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      ws = null;
    });
  });

const toggleRegisteredStatus = $(async (rfid: RFIDData, nextStatus: boolean) => {
  const desiredStatus = nextStatus ? 1 : 0;
  const previous = registered.value.map((entry) => ({ ...entry }));

  registered.value = registered.value.map((entry) =>
    entry.id === rfid.id
      ? {
          ...entry,
          rfid_status: Boolean(desiredStatus),
          status_text: desiredStatus ? "1" : "0",
        }
      : entry
  );

  togglingId.value = rfid.id;

  try {
    const response = await fetch(`${API_BASE_URL}/update_registered.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: rfid.id, status: desiredStatus }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.registered) {
      throw new Error(data.message || "Update failed");
    }

    const updated = data.registered as RFIDData;
    registered.value = registered.value.map((entry) =>
      entry.id === updated.id
        ? {
            ...entry,
            ...updated,
            rfid_status: Boolean((updated as RFIDData).rfid_status),
            status_text:
              typeof updated.status_text === "string"
                ? updated.status_text
                : updated.rfid_status
                ? "1"
                : "0",
          }
        : entry
    );

    actionMessage.value = `RFID ${rfid.rfid_data} updated to ${desiredStatus}`;
    errorMessage.value = "";
  } catch (err) {
    console.error("Failed to update RFID status", err);
    registered.value = previous;
    errorMessage.value = `Failed to update ${rfid.rfid_data}. ${(err as Error).message}`;
    actionMessage.value = "";
  } finally {
    togglingId.value = null;
  }
});

  return (
    <div class="min-h-screen bg-gray-100">
      {/* Header */}
      <header class="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div class="container mx-auto px-4 py-6">
          <div class="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h1 class="text-3xl font-bold mb-2">RFID Access Control System</h1>
              <p class="text-blue-100">Real-time monitoring dashboard</p>
            </div>
            <div class="mt-4 md:mt-0 flex flex-col items-end">
              <div class="flex items-center space-x-4 mb-2">
                {/* Online Status */}
                <div class="flex items-center space-x-2">
                  <span
                    class={`w-3 h-3 rounded-full ${
                      isOnline.value ? "bg-green-400 animate-pulse" : "bg-red-400"
                    }`}
                  ></span>
                  <span class="text-sm">
                    {isOnline.value ? "Online" : "Offline"}
                  </span>
                </div>
                <div class="flex items-center space-x-2">
                  <span
                    class={`w-3 h-3 rounded-full ${
                      liveUpdatesStatus.value === "connected"
                        ? "bg-emerald-400 animate-pulse"
                        : liveUpdatesStatus.value === "connecting"
                        ? "bg-yellow-400 animate-pulse"
                        : "bg-gray-300"
                    }`}
                  ></span>
                  <span class="text-sm">
                    Live updates: {liveUpdatesStatus.value === "connected"
                      ? "Connected"
                      : liveUpdatesStatus.value === "connecting"
                      ? "Connecting"
                      : liveUpdatesStatus.value === "error"
                      ? "Error"
                      : "Reconnecting"}
                  </span>
                </div>
              </div>
              {lastUpdate.value && (
                <p class="text-xs text-blue-200 mt-1">
                  Last update: {lastUpdate.value}
                </p>
              )}
              {actionMessage.value && (
                <p class="text-xs text-emerald-200 mt-1">{actionMessage.value}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {(errorMessage.value || liveUpdatesError.value) && (
        <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
          <div class="container mx-auto px-4">
            <p class="font-bold">Connection Error</p>
            {errorMessage.value && <p>{errorMessage.value}</p>}
            {liveUpdatesError.value && <p>{liveUpdatesError.value}</p>}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main class="container mx-auto px-4 py-8">
        {/* Statistics Cards */}
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div class="bg-white rounded-lg shadow-md p-6">
            <div class="flex items-center">
              <div class="bg-blue-100 rounded-full p-3 mr-4">
                <svg
                  class="w-8 h-8 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
              </div>
              <div>
                <p class="text-gray-500 text-sm">Registered Cards</p>
                <p class="text-3xl font-bold text-gray-800">{registered.value.length}</p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-md p-6">
            <div class="flex items-center">
              <div class="bg-green-100 rounded-full p-3 mr-4">
                <svg
                  class="w-8 h-8 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p class="text-gray-500 text-sm">Active Cards</p>
                <p class="text-3xl font-bold text-gray-800">
                  {registered.value.filter((r) => r.rfid_status).length}
                </p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-lg shadow-md p-6">
            <div class="flex items-center">
              <div class="bg-purple-100 rounded-full p-3 mr-4">
                <svg
                  class="w-8 h-8 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <div>
                <p class="text-gray-500 text-sm">Total Scans</p>
                <p class="text-3xl font-bold text-gray-800">{logs.value.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* RFID Status Cards */}
        <RFIDStatus
          registered={registered.value}
          loading={loadingRegistered.value}
          onToggle$={toggleRegisteredStatus}
          togglingId={togglingId.value}
        />

        {/* RFID Logs Table */}
        <RFIDLogs logs={logs.value} loading={loadingLogs.value} />
      </main>

      {/* Footer */}
      <footer class="bg-gray-800 text-white py-6 mt-12">
        <div class="container mx-auto px-4 text-center">
          <p class="text-sm">
            RFID MQTT IoT System &copy; 2025 - AJJCR
          </p>
          <p class="text-xs text-gray-400 mt-2">
            Real-time monitoring powered by ESP32, MQTT, and Qwik
          </p>
        </div>
      </footer>
    </div>
  );
});

export const head: DocumentHead = {
  title: "RFID Access Control Dashboard",
  meta: [
    {
      name: "description",
      content: "Real-time RFID access control monitoring system",
    },
    {
      name: "viewport",
      content: "width=device-width, initial-scale=1.0",
    },
  ],
};
