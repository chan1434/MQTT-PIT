import
  {
  component$,
  useSignal,
  useVisibleTask$,
  $,
  useResource$,
  Resource,
} from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import type { RFIDStatusProps, RFIDData } from "~/components/rfid-status";
import type { RFIDLogsProps, LogEntry } from "~/components/rfid-logs";

// API Configuration - Update with your local IP if needed
const API_BASE_URL = "http://192.168.43.17:81/php-backend/api";
const MAX_LOG_ENTRIES = 50;
const FALLBACK_POLL_INTERVAL = 2_000; // 2 seconds fallback polling for real-time updates

const LIVE_UPDATES_URL = ( import.meta.env.PUBLIC_LIVE_UPDATES_URL as string | undefined ) || "";
const LIVE_UPDATES_PORT = Number( import.meta.env.PUBLIC_LIVE_UPDATES_PORT || "9443" );
const LIVE_UPDATES_PATH = ( () =>
{
  const rawPath = ( import.meta.env.PUBLIC_LIVE_UPDATES_PATH as string | undefined ) || "/";
  return rawPath.startsWith( "/" ) ? rawPath : `/${ rawPath }`;
} )();

const normalizeLogEntry = ( incoming: Record<string, unknown> ): LogEntry =>
{
  const rawId = incoming.id ?? Date.now();
  const timeLogRaw =
    ( incoming.time_log as string | undefined ) ||
    ( incoming.timestamp as string | undefined ) ||
    new Date().toISOString();
  const time = new Date( timeLogRaw );

  const timeLogFormatted =
    ( incoming.time_log_formatted as string | undefined ) || time.toLocaleString();

  const date = ( incoming.date as string | undefined ) || time.toISOString().slice( 0, 10 );
  const time12 =
    ( incoming.time_12hr as string | undefined ) ||
    time.toLocaleTimeString( [], { hour: "2-digit", minute: "2-digit", second: "2-digit" } );

  const rfidStatus = Boolean( incoming.rfid_status );
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
    id: Number( rawId ),
    time_log: time.toISOString(),
    time_log_formatted: timeLogFormatted,
    date,
    time_12hr: time12,
    rfid_data: String( incoming.rfid_data ?? "UNKNOWN" ),
    rfid_status: rfidStatus,
    status_text: statusText,
    found: foundValue ?? statusText !== "RFID NOT FOUND",
  };
};

export default component$( () =>
{
  const registered = useSignal<RFIDData[]>( [] );
  const logs = useSignal<LogEntry[]>( [] );
  const loadingRegistered = useSignal( true );
  const loadingLogs = useSignal( true );
  const lastUpdate = useSignal<string>( "" );
  const isOnline = useSignal( true );
  const errorMessage = useSignal<string>( "" );
  const liveUpdatesStatus = useSignal<"connecting" | "connected" | "disconnected" | "error">(
    "connecting"
  );
  const liveUpdatesError = useSignal<string>( "" );
  const togglingId = useSignal<number | null>( null );
  const actionMessage = useSignal<string>( "" );
  const registeredCursor = useSignal<string>( "" );
  const registeredEtag = useSignal<string>( "" );
  const logsEtag = useSignal<string>( "" );

  const fetchRegisteredData = $( async ( forceFull: boolean ) =>
  {
    try
    {
      const url = new URL( `${ API_BASE_URL }/get_registered.php` );
      if ( !forceFull && registeredCursor.value )
      {
        url.searchParams.set( "updated_since", registeredCursor.value );
      }

      const headers: HeadersInit = {};
      if ( !forceFull && registeredEtag.value )
      {
        headers[ "If-None-Match" ] = registeredEtag.value;
      }

      const response = await fetch( url.toString(), { headers } );

      if ( response.status === 304 )
      {
        isOnline.value = true;
        errorMessage.value = "";
        return;
      }

      if ( !response.ok )
      {
        throw new Error( `HTTP error! status: ${ response.status }` );
      }

      const data = await response.json();
      const nextEtag = response.headers.get( "ETag" );
      if ( nextEtag )
      {
        registeredEtag.value = nextEtag;
      }

      if ( typeof data.last_modified === "string" )
      {
        registeredCursor.value = data.last_modified;
      }

      const normalized = ( data.registered as RFIDData[] ).map( ( item ) => ( {
        ...item,
        rfid_status: Boolean( item.rfid_status ),
        status_text:
          typeof item.status_text === "string"
            ? item.status_text
            : item.rfid_status
            ? "1"
            : "0",
      } ) );

      if ( !forceFull && data.filtered_since && registered.value.length > 0 )
      {
        const registry = new Map( registered.value.map( ( entry ) => [ entry.id, entry ] ) );
        normalized.forEach( ( entry ) => registry.set( entry.id, entry ) );
        registered.value = Array.from( registry.values() ).sort( ( a, b ) => a.id - b.id );
      } else
      {
        registered.value = normalized;
      }

      isOnline.value = true;
      errorMessage.value = "";
    } catch ( error )
    {
      console.error( "Error fetching registered RFIDs:", error );
      if ( forceFull )
      {
        registeredCursor.value = "";
        registeredEtag.value = "";
      }
      isOnline.value = false;
      errorMessage.value = "Failed to connect to backend. Is XAMPP running?";
      actionMessage.value = "";
    } finally
    {
      loadingRegistered.value = false;
    }
  } );

  const fetchLogsData = $( async ( forceFull: boolean ) =>
  {
    try
    {
      const currentLatestId = forceFull ? 0 : logs.value[ 0 ]?.id ?? 0;
      const url = new URL( `${ API_BASE_URL }/get_logs.php` );
      url.searchParams.set( "limit", String( MAX_LOG_ENTRIES ) );
      if ( !forceFull && currentLatestId > 0 )
      {
        url.searchParams.set( "after_id", String( currentLatestId ) );
      }

      const headers: HeadersInit = {};
      if ( ( forceFull || currentLatestId === 0 ) && logsEtag.value )
      {
        headers[ "If-None-Match" ] = logsEtag.value;
      }

      const response = await fetch( url.toString(), { headers } );

      if ( response.status === 304 )
      {
        return;
      }

      if ( !response.ok )
      {
        throw new Error( `HTTP error! status: ${ response.status }` );
      }

      const data = await response.json();
      const nextEtag = response.headers.get( "ETag" );
      if ( nextEtag && ( forceFull || currentLatestId === 0 ) )
      {
        logsEtag.value = nextEtag;
      }

      const incomingLogs = Array.isArray( data.logs )
        ? ( data.logs as unknown as Record<string, unknown>[] ).map( ( entry ) =>
          normalizeLogEntry( entry ),
          )
        : [];

      if ( !forceFull && currentLatestId > 0 && logs.value.length > 0 )
      {
        const merged = [ ...incomingLogs, ...logs.value ];
        const deduped: LogEntry[] = [];
        const seen = new Set<number>();
        for ( const log of merged )
        {
          if ( seen.has( log.id ) )
          {
            continue;
          }
          seen.add( log.id );
          deduped.push( log );
        }
        logs.value = deduped.slice( 0, MAX_LOG_ENTRIES );
      } else
      {
        logs.value = incomingLogs.slice( 0, MAX_LOG_ENTRIES );
      }

      if ( incomingLogs.length > 0 )
      {
        lastUpdate.value = new Date().toLocaleString( "en-PH", { timeZone: "Asia/Manila" } );
      }

      isOnline.value = true;
      errorMessage.value = "";
      actionMessage.value = "";
    } catch ( error )
    {
      console.error( "Error fetching logs:", error );
      if ( forceFull )
      {
        logsEtag.value = "";
      }
      isOnline.value = false;
      errorMessage.value = "Failed to connect to backend. Is XAMPP running?";
      actionMessage.value = "";
    } finally
    {
      loadingLogs.value = false;
    }
  } );

  const fetchData = $( async ( options: { forceFull?: boolean } = {} ) =>
  {
    const forceFull = options.forceFull ?? false;
    await Promise.all( [ fetchRegisteredData( forceFull ), fetchLogsData( forceFull ) ] );
  } );

  useVisibleTask$( ( { cleanup } ) =>
  {
    const runInitialFetch = async () =>
    {
      await fetchData( { forceFull: true } );
    };

    runInitialFetch();

    // Always poll as backup, even when WebSocket is connected
    // This ensures data is always fresh even if WebSocket misses messages
    const intervalId = window.setInterval( () =>
    {
      void fetchData();
    }, FALLBACK_POLL_INTERVAL );

    cleanup( () =>
    {
      window.clearInterval( intervalId );
    } );
  } );

  useVisibleTask$( ( { cleanup } ) =>
  {
    if ( typeof window === "undefined" )
    {
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    let connectionTimeout: number | undefined;
    let manualClose = false;
    let attempts = 0;
    const messageCache = new Set<string>();  // Message deduplication

    const pushLogEntry = ( entry: LogEntry ) =>
    {
      logs.value = [
        entry,
        ...logs.value.filter( ( log ) => log.id !== entry.id ),
      ].slice( 0, MAX_LOG_ENTRIES );

      lastUpdate.value = new Date().toLocaleString( "en-PH", { timeZone: "Asia/Manila" } );
      loadingLogs.value = false;
      isOnline.value = true;
      errorMessage.value = "";
    };

    const buildWebSocketUrl = () =>
    {
      if ( LIVE_UPDATES_URL )
      {
        return LIVE_UPDATES_URL;
      }

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      const hostname = window.location.hostname || "localhost";
      return `${ protocol }://${ hostname }:${ LIVE_UPDATES_PORT }${ LIVE_UPDATES_PATH }`;
    };

    const scheduleReconnect = () =>
    {
      if ( manualClose )
      {
        return;
      }

      liveUpdatesStatus.value = "disconnected";
      // Exponential backoff with max 30 seconds
      // First retry: 2s, then 4s, 8s, 16s, then 30s max
      const delay = Math.min( 30_000, 1_000 * Math.pow( 2, attempts ) );

      // Don't spam reconnection attempts if server isn't running
      // After 5 failed attempts, only retry every 30 seconds
      if ( attempts > 5 )
      {
        console.log( `WebSocket reconnect attempt ${ attempts }. Will retry in ${ delay / 1000 }s.` );
      }

      reconnectTimer = window.setTimeout( connect, delay );
    };

    const connect = () =>
    {
      // Connection pooling - close existing connection before creating new one
      if ( ws )
      {
        if ( ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING )
        {
        ws.close();
        }
        ws = null;
      }

      attempts += 1;
      liveUpdatesStatus.value = "connecting";
      liveUpdatesError.value = "";

      const targetUrl = buildWebSocketUrl();

      // Clear any existing connection timeout
      if ( connectionTimeout )
      {
        window.clearTimeout( connectionTimeout );
        connectionTimeout = undefined;
      }

      try
      {
        ws = new WebSocket( targetUrl );
        
        // Set a connection timeout - if not connected within 5 seconds, consider it failed
        connectionTimeout = window.setTimeout( () =>
        {
          if ( ws && ws.readyState !== WebSocket.OPEN )
          {
            console.warn( "WebSocket connection timeout", targetUrl );
            liveUpdatesStatus.value = "error";
            liveUpdatesError.value = "Connection timeout. Using polling fallback.";
            if ( ws )
            {
              try
              {
              ws.close();
              } catch
              {
                // Ignore close errors
              }
              ws = null;
            }
            scheduleReconnect();
          }
        }, 5000 );

        ws.onopen = () =>
        {
          if ( connectionTimeout )
          {
            window.clearTimeout( connectionTimeout );
            connectionTimeout = undefined;
          }
          attempts = 0;
          liveUpdatesStatus.value = "connected";
          liveUpdatesError.value = "";
        };
        
        ws.onerror = () =>
        {
          if ( connectionTimeout )
          {
            window.clearTimeout( connectionTimeout );
            connectionTimeout = undefined;
          }

          // Don't log full event object to avoid cluttering console
          // Only warn in console if it's the first attempt
          if ( attempts === 1 )
          {
            console.warn(
              "WebSocket server unavailable. " +
              "Make sure 'npm run dev' is running (starts both Vite and WebSocket server). " +
              "The app will continue using HTTP polling for updates.",
              targetUrl
            );
          }

          // Close the socket if it's in an error state
          if ( ws )
          {
            try
            {
              if ( ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING )
              {
                ws.close();
              }
            } catch
            {
              // Ignore close errors
            }
          }

          liveUpdatesStatus.value = "error";
          // Only show error message on first few attempts to avoid cluttering UI
          if ( attempts <= 3 )
          {
            liveUpdatesError.value = "Live updates unavailable. Using HTTP polling.";
          } else
          {
            liveUpdatesError.value = ""; // Clear error after initial attempts
          }

          // Schedule reconnect after error (with exponential backoff)
          if ( !manualClose )
          {
            scheduleReconnect();
          }
        };

        ws.onmessage = ( event ) =>
        {
          try
          {
            // Message deduplication
            const msgHash = btoa( event.data.slice( 0, 100 ) ).slice( 0, 16 );
            if ( messageCache.has( msgHash ) )
            {
              return;  // Skip duplicate message
            }
            messageCache.add( msgHash );
            setTimeout( () => messageCache.delete( msgHash ), 5000 );

            const payload = JSON.parse( event.data );

            if ( payload?.type === "batch" && Array.isArray( payload.data ) )
            {
              payload.data.forEach( ( item: Record<string, unknown> ) =>
              {
                if ( item?.type === "rfid-log" && item.data )
                {
                  const entry = normalizeLogEntry( item.data as Record<string, unknown> );
                  pushLogEntry( entry );
                }
              } );
              return;
            }

            if ( payload?.type === "rfid-log" && payload.data )
            {
              const entry = normalizeLogEntry( payload.data as Record<string, unknown> );
              pushLogEntry( entry );
            }
          } catch ( error )
          {
            console.error( "Failed to parse WebSocket payload", error );
          }
        };

        ws.onclose = ( event ) =>
        {
          if ( connectionTimeout )
          {
            window.clearTimeout( connectionTimeout );
            connectionTimeout = undefined;
          }

          // Don't log or show errors if we manually closed the connection
          if ( manualClose )
          {
            return;
          }

          // Check if this was an unexpected close (not a normal closure)
          const wasUnexpected = event.code !== 1000 && event.code !== 1001;

          // Only log on first unexpected close to avoid spam
          if ( wasUnexpected && attempts === 1 )
          {
            console.warn(
              `WebSocket connection closed unexpectedly (code: ${ event.code }, reason: ${ event.reason || 'none' }). ` +
              "The app will continue using HTTP polling for updates."
            );
          }

          // Update status if it's an unexpected termination
          if ( wasUnexpected && liveUpdatesStatus.value !== "error" )
          {
            liveUpdatesStatus.value = "disconnected";
            // Only show error message on first few attempts
            if ( attempts <= 3 )
            {
              liveUpdatesError.value = "Live updates disconnected. Using HTTP polling.";
            }
          }

          // Schedule reconnect for unexpected closes
          if ( wasUnexpected )
          {
            scheduleReconnect();
          } else if ( liveUpdatesStatus.value !== "error" )
          {
            // For normal closes (like server shutdown), also try to reconnect
            scheduleReconnect();
          }
        };
      } catch ( error )
      {
        if ( connectionTimeout )
        {
          window.clearTimeout( connectionTimeout );
          connectionTimeout = undefined;
        }

        console.error( "Failed to construct WebSocket", error );
        liveUpdatesStatus.value = "error";
        liveUpdatesError.value = "Unable to open live updates connection. Using polling fallback.";
        scheduleReconnect();
        return;
      }
    };

    connect();

    cleanup( () =>
    {
      manualClose = true;

      // Clear all timers
      if ( reconnectTimer )
      {
        window.clearTimeout( reconnectTimer );
        reconnectTimer = undefined;
      }
      if ( connectionTimeout )
      {
        window.clearTimeout( connectionTimeout );
        connectionTimeout = undefined;
      }

      // Close WebSocket connection
      if ( ws )
      {
        try
        {
          if ( ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING )
          {
        ws.close();
          }
        } catch
        {
          // Ignore close errors during cleanup
        }
        ws = null;
      }
    } );
  } );

  useVisibleTask$( () =>
  {
    if ( typeof window === "undefined" || typeof PerformanceObserver === "undefined" )
    {
      return;
    }

    const logMetric = ( entry: PerformanceEntry ) =>
    {
      const label = entry.name || entry.entryType;
      const value = "value" in entry ? ( entry as PerformanceEntry & { value: number } ).value : entry.duration;
      console.log( `[WebVitals] ${ label }: ${ value.toFixed( 2 ) }ms` );
    };

    const observers: PerformanceObserver[] = [];
    const observerConfigs: PerformanceObserverInit[] = [
      { type: "largest-contentful-paint", buffered: true },
      { type: "first-input", buffered: true },
      { type: "layout-shift", buffered: true },
    ];

    observerConfigs.forEach( ( config ) =>
    {
      try
      {
        const observer = new PerformanceObserver( ( entryList ) =>
        {
          for ( const entry of entryList.getEntries() )
          {
            logMetric( entry );
          }
        } );
        observer.observe( config );
        observers.push( observer );
      } catch ( error )
      {
        console.warn( `PerformanceObserver unsupported for ${ config.type }`, error );
      }
    } );

    return () =>
    {
      observers.forEach( ( observer ) => observer.disconnect() );
    };
  } );

  const toggleRegisteredStatus = $( async ( rfid: RFIDData, nextStatus: boolean ) =>
  {
  const desiredStatus = nextStatus ? 1 : 0;
    const previous = registered.value.map( ( entry ) => ( { ...entry } ) );

    registered.value = registered.value.map( ( entry ) =>
    entry.id === rfid.id
      ? {
          ...entry,
          rfid_status: Boolean( desiredStatus ),
          status_text: desiredStatus ? "1" : "0",
        }
      : entry
  );

  togglingId.value = rfid.id;

    try
    {
      const response = await fetch( `${ API_BASE_URL }/update_registered.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
        body: JSON.stringify( { id: rfid.id, status: desiredStatus } ),
      } );

      if ( !response.ok )
      {
        throw new Error( `HTTP ${ response.status }` );
    }

    const data = await response.json();

      if ( !data.success || !data.registered )
      {
        throw new Error( data.message || "Update failed" );
    }

    const updated = data.registered as RFIDData;
      registered.value = registered.value.map( ( entry ) =>
      entry.id === updated.id
        ? {
            ...entry,
            ...updated,
            rfid_status: Boolean( ( updated as RFIDData ).rfid_status ),
            status_text:
              typeof updated.status_text === "string"
                ? updated.status_text
                : updated.rfid_status
                ? "1"
                : "0",
          }
        : entry
    );

      actionMessage.value = `RFID ${ rfid.rfid_data } updated to ${ desiredStatus }`;
    errorMessage.value = "";
    } catch ( err )
    {
      console.error( "Failed to update RFID status", err );
    registered.value = previous;
      errorMessage.value = `Failed to update ${ rfid.rfid_data }. ${ ( err as Error ).message }`;
    actionMessage.value = "";
    } finally
    {
    togglingId.value = null;
  }
  } );

  const LazyRFIDStatus = component$<RFIDStatusProps>( ( props ) =>
  {
    const statusResource = useResource$( async () =>
    {
      const module = await import( "~/components/rfid-status" );
    return module.RFIDStatus;
    } );

  return (
    <Resource
        value={ statusResource }
        onPending={ () => (
        <div class="bg-white rounded-lg shadow-md p-6 mb-6 animate-pulse">
          <div class="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div class="space-y-3">
            <div class="h-4 bg-gray-100 rounded"></div>
            <div class="h-4 bg-gray-100 rounded"></div>
            <div class="h-4 bg-gray-100 rounded"></div>
          </div>
        </div>
        ) }
        onResolved={ ( Component ) => <Component { ...props } /> }
      />
    );
  } );

  const LazyRFIDLogs = component$<RFIDLogsProps>( ( props ) =>
  {
    const logsResource = useResource$( async () =>
    {
      const module = await import( "~/components/rfid-logs" );
    return module.RFIDLogs;
    } );

  return (
    <Resource
        value={ logsResource }
        onPending={ () => (
        <div class="bg-white rounded-lg shadow-md p-6 mb-6 animate-pulse">
          <div class="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div class="space-y-2">
              { [ 0, 1, 2 ].map( ( item ) => (
                <div key={ `log-pending-${ item }` } class="h-12 bg-gray-100 rounded"></div>
              ) ) }
            </div>
          </div>
        ) }
        onResolved={ ( Component ) => <Component { ...props } /> }
    />
  );
  } );

  return (
    <div class="min-h-screen bg-gray-100">
      {/* Header */ }
      <header class="bg-gradient-to-r from-blue-600 to-blue-800 text-white shadow-lg">
        <div class="container mx-auto px-4 py-6">
          <div class="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h1 class="text-3xl font-bold mb-2">RFID Access Control System</h1>
              <p class="text-blue-100">Real-time monitoring dashboard</p>
            </div>
            <div class="mt-4 md:mt-0 flex flex-col items-end">
              <div class="flex items-center space-x-4 mb-2">
                {/* Online Status */ }
                <div class="flex items-center space-x-2">
                  <span
                    class={ `w-3 h-3 rounded-full ${ isOnline.value ? "bg-green-400 animate-pulse" : "bg-red-400"
                      }` }
                  ></span>
                  <span class="text-sm">
                    { isOnline.value ? "Online" : "Offline" }
                  </span>
                </div>
                <div class="flex items-center space-x-2">
                  <span
                    class={ `w-3 h-3 rounded-full ${ liveUpdatesStatus.value === "connected"
                        ? "bg-emerald-400 animate-pulse"
                        : liveUpdatesStatus.value === "connecting"
                        ? "bg-yellow-400 animate-pulse"
                        : "bg-gray-300"
                      }` }
                  ></span>
                  <span class="text-sm">
                    Live updates: { liveUpdatesStatus.value === "connected"
                      ? "Connected"
                      : liveUpdatesStatus.value === "connecting"
                      ? "Connecting"
                      : liveUpdatesStatus.value === "error"
                      ? "Error"
                          : "Reconnecting" }
                  </span>
                </div>
              </div>
              { lastUpdate.value && (
                <p class="text-xs text-blue-200 mt-1">
                  Last update: { lastUpdate.value }
                </p>
              ) }
              { actionMessage.value && (
                <p class="text-xs text-emerald-200 mt-1">{ actionMessage.value }</p>
              ) }
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */ }
      { ( errorMessage.value || liveUpdatesError.value ) && (
        <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
          <div class="container mx-auto px-4">
            <p class="font-bold">Connection Error</p>
            { errorMessage.value && <p>{ errorMessage.value }</p> }
            { liveUpdatesError.value && <p>{ liveUpdatesError.value }</p> }
          </div>
        </div>
      ) }

      {/* Main Content */ }
      <main class="container mx-auto px-4 py-8">
        {/* Statistics Cards */ }
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
                <p class="text-3xl font-bold text-gray-800">{ registered.value.length }</p>
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
                  { registered.value.filter( ( r ) => r.rfid_status ).length }
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
                <p class="text-3xl font-bold text-gray-800">{ logs.value.length }</p>
              </div>
            </div>
          </div>
        </div>

        {/* RFID Status Cards */ }
        <LazyRFIDStatus
          registered={ registered.value }
          loading={ loadingRegistered.value }
          onToggle$={ toggleRegisteredStatus }
          togglingId={ togglingId.value }
        />

        {/* RFID Logs Table */ }
        <LazyRFIDLogs logs={ logs.value } loading={ loadingLogs.value } />
      </main>

      {/* Footer */ }
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
} );

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
