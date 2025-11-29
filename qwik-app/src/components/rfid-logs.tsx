import { $, component$, useComputed$, useSignal } from "@builder.io/qwik";

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

export interface RFIDLogsProps {
  logs: LogEntry[];
  loading: boolean;
}

const ROW_HEIGHT = 64;
const VISIBLE_ROWS = 8;
const OVERSCAN_ROWS = 4;

export const RFIDLogs = component$<RFIDLogsProps>(({ logs, loading }) => {
  const scrollOffset = useSignal(0);

  const onScroll = $((event: Event) => {
    const target = event.target as HTMLElement;
    scrollOffset.value = target.scrollTop;
  });

  const virtualSlice = useComputed$(() => {
    const total = logs.length;
    const start = Math.max(
      0,
      Math.floor(scrollOffset.value / ROW_HEIGHT) - OVERSCAN_ROWS,
    );
    const visibleWindow = VISIBLE_ROWS + OVERSCAN_ROWS * 2;
    const end = Math.min(total, start + visibleWindow);

    return {
      beforeHeight: start * ROW_HEIGHT,
      afterHeight: Math.max(0, (total - end) * ROW_HEIGHT),
      items: logs.slice(start, end),
    };
  });

  return (
    <div class="bg-white rounded-lg shadow-md p-6">
      <h2 class="text-2xl font-bold mb-4 text-gray-800">Recent RFID Logs</h2>

      {loading ? (
        <div class="space-y-3">
          {[0, 1, 2, 3, 4].map((placeholder) => (
            <div
              key={`log-skeleton-${placeholder}`}
              class="h-12 rounded bg-gray-100 animate-pulse"
            ></div>
          ))}
        </div>
      ) : logs.length === 0 ? (
        <p class="text-gray-500 text-center py-4">No logs available yet.</p>
      ) : (
        <div class="overflow-x-auto">
          <div class="max-h-96 overflow-y-auto" onScroll$={onScroll}>
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50 sticky top-0 z-10">
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
                {virtualSlice.value.beforeHeight > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={3}
                      style={`height: ${virtualSlice.value.beforeHeight}px; padding: 0; border: 0;`}
                    ></td>
                  </tr>
                )}
                {virtualSlice.value.items.map((log) => (
                  <tr
                    key={log.id}
                    class="hover:bg-gray-50"
                    style={`height: ${ROW_HEIGHT}px;`}
                  >
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
                {virtualSlice.value.afterHeight > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={3}
                      style={`height: ${virtualSlice.value.afterHeight}px; padding: 0; border: 0;`}
                    ></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
});

