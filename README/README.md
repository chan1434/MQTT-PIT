System Overview:
The project is a full IoT access-control stack: two ESP32s handle RFID capture and relay control, a PHP/MySQL backend validates cards and logs attempts, a Mosquitto broker synchronizes edge devices, and a Qwik dashboard provides HTTPS-only monitoring plus remote toggles. The primary README enumerates hardware wiring, software prereqs, and dashboard capabilities (HTTPS, real-time updates, offline caching, badge indicators). Together they show the intended classroom/lab deployment model (XAMPP at `D:\xampp`, MQTT on localhost, certificates auto-generated before `npm run dev`) and the expectation that every scan appears on the dashboard and toggles the relay within seconds.

ESP32 Firmware Analysis:
`src/main.cpp` (RFID scanner) configures SPI/MFRC522, iterates through multiple Wi-Fi profiles, and manages MQTT with exponential backoff. Every detected UID is encoded into a URL-safe buffer, verified against the PHP API, and the result is published to `RFID_LOGIN` with the retained flag so late subscribers immediately see the latest auth state. Telemetry prints free heap, RSSI, and MQTT status each minute, and URL/string buffers are stack-allocated to avoid heap fragmentation. `src/main_relay.cpp` mirrors the Wi-Fi/MQTT lifecycle but focuses on pin 26, toggling the relay/LED whenever retained or live messages hit the subscribed topic, and it logs its own runtime health for diagnostics. 

line 17-158: src/main.cpp
#include <Arduino.h>
...
  reportRuntimeStats(now);
  delay(LOOP_IDLE_DELAY_MS);
}
```

line 336-478: src/main.cpp
void reportRuntimeStats(unsigned long now) {
...
    Serial.println("Cannot publish: MQTT not connected");
  }
}
```

line 17-280: src/main_relay.cpp
#include <Arduino.h>
...
  Serial.println("--------------------------------");
}
```

PHP Backend & APIs:
The PHP layer is intentionally lean but performance-conscious. `config/database.php` centralizes PDO creation with persistent connections, native prepared statements, buffered queries, and strict SQL modes. `api/check_rfid.php` validates the UID, logs the attempt, and pushes a JSON payload to the realtime bridge before responding. `api/get_registered.php` layers APCu caching, ETags, and conditional requests, while `api/get_logs.php` uses a single JOIN to avoid N+1 lookups, emits both cursors and ETags, and formats timestamps once per log. `api/update_registered.php` gives the dashboard a JSON POST endpoint for toggling cards and clears the APCu cache. `config/realtime.php` can fire asynchronous curl jobs on Windows/Linux, falling back to synchronous HTTPS posts. `api/health.php` summarizes DB latency, OPcache/APCu hit rates, memory, and load, and `.htaccess` enforces gzip, CORS, Keep-Alive, short API cache headers, and some basic security best practices.

line 1-45: php-backend/config/database.php
<?php
// Database configuration for XAMPP MySQL
...
        return false;
    }
}
```

line 1-112: php-backend/api/check_rfid.php
<?php
// API endpoint to check RFID card and log activity
...
ob_end_flush();
?>
```

line 6-174: php-backend/api/get_registered.php
// Enable output buffering for better compression
...
ob_end_flush();
?>
```

line 6-150: php-backend/api/get_logs.php
ob_start('ob_gzhandler');
...
ob_end_flush();
?>
```

line 1-130: php-backend/api/update_registered.php
<?php
// API endpoint to update a registered RFID card's status
...
?>
```

line 1-112: php-backend/config/realtime.php
<?php
define('REALTIME_BRIDGE_URL', getenv('REALTIME_BRIDGE_URL') ?: 'https://localhost:9443/broadcast');
...
```

line 1-110: php-backend/api/health.php
<?php
header('Content-Type: application/json');
...
echo json_encode($response, JSON_PRETTY_PRINT);
```

line 8-210: php-backend/.htaccess
# ==================== COMPRESSION ====================
...
# ==================== END OF CONFIGURATION ====================
```

Database & Broker Layer:
Schema creation (`init.sql`) provisions `rfid_reg` and `rfid_logs` with covering/composite indexes and seed data. Ongoing hygiene is captured in `database/mysql-maintenance.sql` (ANALYZE/OPTIMIZE, log pruning, stats queries) and `database/optimize_indexes.sql` (idempotent index creation). `mysql-config/my-optimization.ini` tunes query cache, InnoDB buffer pools, connection/thread caches, slow-query logging, and character sets for the XAMPP MySQL instance. On the messaging side, `mosquitto/mosquitto.conf` exposes port 1883 to all interfaces, keeps anonymous access for class demos, raises inflight/queued limits, enables persistence every 300s, and documents how to harden with passwords, ACLs, and TLS when leaving localhost.

line 1-35: php-backend/database/init.sql
CREATE DATABASE IF NOT EXISTS it414_db_ajjcr;
...
SELECT 'Database setup complete!' AS Status;
```

line 9-94: mysql-config/my-optimization.ini
[mysqld]
# ==================== QUERY CACHE ====================
...
# - SHOW ENGINE INNODB STATUS;            (Detailed InnoDB stats)
```

line 7-123: php-backend/database/mysql-maintenance.sql
USE it414_db_ajjcr;
...
-- ========================================
```

line 1-110: php-backend/database/optimize_indexes.sql
-- Database Optimization: Add Performance Indexes
...
GROUP BY table_name, index_name;
```

line 10-113: mosquitto/mosquitto.conf
# ==================== NETWORK ====================
...
# ========================================
```

Web Dashboard & Realtime Bridge:
`qwik-app/src/routes/index.tsx` orchestrates API calls, cursor-based incremental fetches, ETAG caching, websocket fallback/polling, local optimistic toggles, and graceful reconnection with deduped batches. `rfid-status.tsx` and `rfid-logs.tsx` render cards/logs with skeletons, toggle switches, and virtualized tables. `public/service-worker.js` adds a network-first caching strategy with offline responses and periodic sync. HTTPS is mandatory via `scripts/generate-certs.js` (auto OpenSSL/mkcert generation) and `vite.config.ts` (fails fast if certs are missing, always binds HTTPS on 5174). `scripts/live-updates-server.js` is the TLS WebSocket bridge that accepts POST `/broadcast`, batches RFID events with priority queues, enforces per-client connection pooling, heartbeats, and compressed websocket frames.

line 13-223: qwik-app/src/routes/index.tsx
// API Configuration - Update with your local IP if needed
...
  return (
```

line 248-477: qwik-app/src/routes/index.tsx
  useVisibleTask$(({ cleanup }) => {
...
});
```

line 1-103: qwik-app/src/components/rfid-status.tsx
import { component$, type PropFunction } from "@builder.io/qwik";
...
);
```

line 1-135: qwik-app/src/components/rfid-logs.tsx
import { $, component$, useComputed$, useSignal } from "@builder.io/qwik";
...
});
```

line 1-132: qwik-app/public/service-worker.js
// Service Worker for RFID-MQTT Dashboard
...
console.log('[ServiceWorker] Loaded');
```

line 1-192: qwik-app/scripts/generate-certs.js
/**
 * SSL Certificate Generator for HTTPS Development
...
process.exit(1);
```

line 1-143: qwik-app/vite.config.ts
/**
 * This is the base config for vite.
...
  };
});
```

line 1-260: qwik-app/scripts/live-updates-server.js
import https from "https";
...
  console.log("====================================");
```

End-to-End Flow & Risks:
A scan travels from MFRC522 → `checkRFIDWithServer` and MQTT publish (`src/main.cpp`), through PHP validation/logging (`api/check_rfid.php`) and APCu/DB layers, triggers the TLS websocket bridge (`scripts/live-updates-server.js`), and finally animates the Qwik dashboard’s signals/virtualized logs while the relay listener reacts to the retained payload. HTTPS is enforced for the UI while backend/ESP32 traffic stays HTTP; moving to production would require moving MQTT and the ESP32 HTTP client to TLS plus enabling Mosquitto ACLs/passwords. Remaining risks revolve around outstanding TODOs (virtual scrolling powered by `@tanstack/qwik-virtual`, async bridge calls, cursor pagination, DB partitioning) and the mixed-protocol stance; the documentation already highlights them as next steps.