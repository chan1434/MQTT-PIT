import { component$ } from "@builder.io/qwik";

export interface LogEntry {
  id: number;
  time_log: string;
  time_log_formatted: string;
  date: string;
  time_12hr: string;
  rfid_data: string;
  rfid_status: boolean;
}

interface RFIDLogsProps {
  logs: LogEntry[];
  loading: boolean;
  showAsNumbers?: boolean;
}

export const RFIDLogs = component$<RFIDLogsProps>(({ logs, loading, showAsNumbers = false }) => {
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
                  <td class="px-4 py-3 whitespace-nowrap">
                    <span
                      class={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                        log.rfid_status
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {showAsNumbers ? (
                        <span class="font-mono font-bold">
                          {log.rfid_status ? "1" : "0"}
                        </span>
                      ) : log.rfid_status ? (
                        <>
                          <svg
                            class="w-4 h-4 mr-1"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clip-rule="evenodd"
                            />
                          </svg>
                          Access Granted
                        </>
                      ) : (
                        <>
                          <svg
                            class="w-4 h-4 mr-1"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                              clip-rule="evenodd"
                            />
                          </svg>
                          Access Denied
                        </>
                      )}
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

