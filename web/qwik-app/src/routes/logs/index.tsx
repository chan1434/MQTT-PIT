import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import type { RFIDLog } from '../../types';

export const useLogsData = routeLoader$(async () => {
  try {
    const API_URL = import.meta.env.PUBLIC_API_URL || 'https://localhost/php/api';
    const response = await fetch(`${API_URL}/logs.php?limit=100`);
    if (!response.ok) throw new Error('Failed to fetch logs');
    const data = await response.json();
    return data.logs as RFIDLog[];
  } catch (error) {
    console.error('Error fetching logs:', error);
    return [] as RFIDLog[];
  }
});

export default component$(() => {
  const logsData = useLogsData();
  const logs = useSignal<RFIDLog[]>(logsData.value);
  const isRefreshing = useSignal(false);
  const lastUpdate = useSignal<Date>(new Date());
  const isOnline = useSignal(true);

  useVisibleTask$(({ track, cleanup }) => {
    track(() => logs.value);
    
    const refreshInterval = setInterval(async () => {
      isRefreshing.value = true;
      
      try {
        const API_URL = import.meta.env.PUBLIC_API_URL || 'https://localhost/php/api';
        const response = await fetch(`${API_URL}/logs.php?limit=100`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          logs.value = data.logs as RFIDLog[];
          lastUpdate.value = new Date();
          isOnline.value = true;
        }
      } catch (error) {
        console.error('Error refreshing logs:', error);
        isOnline.value = navigator.onLine;
      } finally {
        isRefreshing.value = false;
      }
    }, 5000);
    
    cleanup(() => clearInterval(refreshInterval));
  });

  return (
    <div class="logs-page">
      <div class="page-header">
        <h2>RFID Logs</h2>
        <div class="status-info">
          <span class={`refresh-indicator ${isRefreshing.value ? 'refreshing' : ''}`}>
            {isRefreshing.value ? 'Refreshing...' : 'Auto-refresh'}
          </span>
          {!isOnline.value && (
            <span class="offline-badge">Offline</span>
          )}
          <span class="last-update">
            Last update: {lastUpdate.value.toLocaleTimeString()}
          </span>
        </div>
      </div>
      
      {logs.value.length === 0 ? (
        <div class="empty-state">
          <p>No logs found</p>
        </div>
      ) : (
        <div class="logs-table-container">
          <table class="logs-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>RFID Data</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.value.map((log, index) => (
                <tr key={index}>
                  <td>{log.time_log}</td>
                  <td>{log.rfid_data}</td>
                  <td>
                    <span class={`status-badge ${log.rfid_status ? 'enabled' : 'disabled'}`}>
                      {log.rfid_status ? 'Active' : 'Inactive'}
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
