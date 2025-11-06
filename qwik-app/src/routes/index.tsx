import { component$, useSignal, useTask$, $ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { RFIDStatus, type RFIDData } from "~/components/rfid-status";
import { RFIDLogs, type LogEntry } from "~/components/rfid-logs";

// API Configuration - Update with your local IP if needed
const API_BASE_URL = "http://localhost/php-backend/api";

export default component$(() => {
  const registered = useSignal<RFIDData[]>([]);
  const logs = useSignal<LogEntry[]>([]);
  const loadingRegistered = useSignal(true);
  const loadingLogs = useSignal(true);
  const lastUpdate = useSignal<string>("");
  const isOnline = useSignal(true);
  const errorMessage = useSignal<string>("");
  const showStatusAsNumbers = useSignal(false); // Toggle for status display format

  // Initial fetch and polling every 2 seconds
  useTask$(async ({ track, cleanup }) => {
    track(() => {}); // Track nothing to run only once
    
    // Fetch function - defined inside useTask$ for proper Qwik context
    const fetchData = async () => {
      // Fetch registered RFIDs
      try {
        const response = await fetch(`${API_BASE_URL}/get_registered.php`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          registered.value = data.registered;
          isOnline.value = true;
          errorMessage.value = "";
        } else {
          errorMessage.value = data.message || "Failed to fetch registered RFIDs";
        }
      } catch (error) {
        console.error("Error fetching registered RFIDs:", error);
        isOnline.value = false;
        errorMessage.value = "Failed to connect to backend. Is XAMPP running?";
      } finally {
        loadingRegistered.value = false;
      }

      // Fetch RFID logs
      try {
        const response = await fetch(`${API_BASE_URL}/get_logs.php?limit=50`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          logs.value = data.logs;
          lastUpdate.value = new Date().toLocaleString();
          isOnline.value = true;
          errorMessage.value = "";
        } else {
          errorMessage.value = data.message || "Failed to fetch logs";
        }
      } catch (error) {
        console.error("Error fetching logs:", error);
        isOnline.value = false;
        errorMessage.value = "Failed to connect to backend. Is XAMPP running?";
      } finally {
        loadingLogs.value = false;
      }
    };
    
    // Initial fetch
    await fetchData();
    
    // Set up polling interval
    const intervalId = setInterval(async () => {
      await fetchData();
    }, 2000); // 2 seconds
    
    // Cleanup on component unmount
    cleanup(() => clearInterval(intervalId));
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
                {/* Status Display Toggle */}
                <div class="flex items-center space-x-2 bg-blue-700/50 rounded-lg px-3 py-1">
                  <span class="text-xs text-blue-100">Status:</span>
                  <button
                    onClick$={$(() => {
                      showStatusAsNumbers.value = !showStatusAsNumbers.value;
                    })}
                    class={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      showStatusAsNumbers.value ? "bg-green-400" : "bg-gray-300"
                    }`}
                    aria-label="Toggle status display format"
                  >
                    <span
                      class={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        showStatusAsNumbers.value ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <span class="text-xs text-blue-100 font-medium">
                    {showStatusAsNumbers.value ? "1/0" : "Text"}
                  </span>
                </div>
                
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
              </div>
              {lastUpdate.value && (
                <p class="text-xs text-blue-200 mt-1">
                  Last update: {lastUpdate.value}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {errorMessage.value && (
        <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
          <div class="container mx-auto px-4">
            <p class="font-bold">Connection Error</p>
            <p>{errorMessage.value}</p>
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
          showAsNumbers={showStatusAsNumbers.value}
        />

        {/* RFID Logs Table */}
        <RFIDLogs 
          logs={logs.value} 
          loading={loadingLogs.value}
          showAsNumbers={showStatusAsNumbers.value}
        />
      </main>

      {/* Footer */}
      <footer class="bg-gray-800 text-white py-6 mt-12">
        <div class="container mx-auto px-4 text-center">
          <p class="text-sm">
            RFID MQTT IoT System &copy; 2025 - Group 1
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
