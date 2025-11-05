import { component$, useSignal, useVisibleTask$ } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import type { RFIDStatus } from '../types';

export const useStatusData = routeLoader$(async () => {
  try {
    const API_URL = import.meta.env.PUBLIC_API_URL || 'https://localhost/php/api';
    const response = await fetch(`${API_URL}/status.php`);
    if (!response.ok) throw new Error('Failed to fetch status');
    return await response.json() as RFIDStatus[];
  } catch (error) {
    console.error('Error fetching status:', error);
    return [] as RFIDStatus[];
  }
});

export default component$(() => {
  const statusData = useStatusData();
  const rfids = useSignal<RFIDStatus[]>(statusData.value);
  const isRefreshing = useSignal(false);
  const lastUpdate = useSignal<Date>(new Date());
  const isOnline = useSignal(true);

  useVisibleTask$(({ track, cleanup }) => {
    track(() => rfids.value);
    
    const refreshInterval = setInterval(async () => {
      isRefreshing.value = true;
      
      try {
        const API_URL = import.meta.env.PUBLIC_API_URL || 'https://localhost/php/api';
        const response = await fetch(`${API_URL}/status.php`, {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        if (response.ok) {
          const data = await response.json() as RFIDStatus[];
          rfids.value = data;
          lastUpdate.value = new Date();
          isOnline.value = true;
        }
      } catch (error) {
        console.error('Error refreshing status:', error);
        isOnline.value = navigator.onLine;
      } finally {
        isRefreshing.value = false;
      }
    }, 5000);
    
    cleanup(() => clearInterval(refreshInterval));
  });

  return (
    <div class="status-page">
      <div class="page-header">
        <h2>RFID Status</h2>
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
      
      {rfids.value.length === 0 ? (
        <div class="empty-state">
          <p>No registered RFIDs found</p>
        </div>
      ) : (
        <div class="status-grid">
          {rfids.value.map((rfid) => (
            <div key={rfid.rfid_data} class={`status-card ${rfid.rfid_status ? 'active' : 'inactive'}`}>
              <div class="status-header">
                <span class="rfid-id">{rfid.rfid_data}</span>
                <span class={`status-badge ${rfid.rfid_status ? 'enabled' : 'disabled'}`}>
                  {rfid.rfid_status ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
