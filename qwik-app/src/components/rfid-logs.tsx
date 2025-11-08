import { component$ } from "@builder.io/qwik";

export interface LogEntry {
  id: number;
  time_log: string;
  time_log_formatted: string;
  date: string;
  time_12hr: string;
  rfid_data: string;
  rfid_status: boolean;
  status_text: string;
  found: boolean;
}

interface RFIDLogsProps {
  logs: LogEntry[];
  loading: boolean;
}

export const RFIDLogs = component$<RFIDLogsProps>(({ logs, loading }) => {
  return (
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-2xl font-bold mb-4 text-gray-800">Recent RFID Logs</h2>
      
      {loading ? (
        <div class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : logs.length === 0 ? (
        <p class="text-gray-500 text-center py-4">No logs available yet.</p>
      ) : (
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  RFID Data
                </th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              {logs.map((log) => (
                <tr key={log.id} class="hover:bg-gray-50">
                  <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    <div class="flex flex-col">
                      <span class="font-medium">{log.date}</span>
                      <span class="text-gray-500">{log.time_12hr}</span>
                    </div>
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-700">
                    {log.rfid_data}
                  </td>
                  <td class="px-4 py-3 whitespace-nowrap text-sm">
                    <span
                      class={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                        log.status_text === "1"
                          ? "bg-green-100 text-green-800"
                          : log.status_text === "0"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {log.status_text}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});

