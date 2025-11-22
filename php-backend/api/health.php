<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

require_once '../config/database.php';
require_once '../config/timezone.php';

$response = [
    'status' => 'ok',
    'timestamp' => manila_now()->format('Y-m-d H:i:s'),
    'database' => [
        'connected' => false,
        'latency_ms' => 0,
    ],
    'php' => [
        'version' => PHP_VERSION,
        'memory_mb' => round(memory_get_usage(true) / 1024 / 1024, 2),
        'memory_peak_mb' => round(memory_get_peak_usage(true) / 1024 / 1024, 2),
    ],
    'performance' => [
        'opcache_hit_rate' => 0,
        'apcu_hit_rate' => 0,
        'avg_query_time_ms' => 0,
    ],
];

$dbStart = microtime(true);
$conn = getDBConnection();
$response['database']['latency_ms'] = round((microtime(true) - $dbStart) * 1000, 2);

if ($conn instanceof PDO) {
    $response['database']['connected'] = true;
    
    // Get database statistics
    try {
        $stmt = $conn->query("SELECT COUNT(*) as count FROM rfid_logs");
        $result = $stmt->fetch();
        $response['database']['total_logs'] = (int)$result['count'];
        
        $stmt = $conn->query("SELECT COUNT(*) as count FROM rfid_reg");
        $result = $stmt->fetch();
        $response['database']['total_registered'] = (int)$result['count'];
    } catch (PDOException $e) {
        // Silently fail if queries don't work
    }
} else {
    $response['status'] = 'error';
    http_response_code(500);
}

if (function_exists('opcache_get_status')) {
    $status = opcache_get_status(false);
    if ($status && isset($status['opcache_statistics'])) {
        $hits = $status['opcache_statistics']['hits'] ?? 0;
        $misses = $status['opcache_statistics']['misses'] ?? 0;
        $total = $hits + $misses;
        
        $response['opcache'] = [
            'enabled' => (bool)$status['opcache_enabled'],
            'memory_usage' => $status['memory_usage'] ?? null,
            'hits' => $hits,
            'misses' => $misses,
            'hit_rate' => $total > 0 ? round(($hits / $total) * 100, 2) : 0,
        ];
        
        $response['performance']['opcache_hit_rate'] = $response['opcache']['hit_rate'];
    }
}

if (function_exists('apcu_cache_info')) {
    $apcu = apcu_cache_info(true);
    if ($apcu) {
        $hits = $apcu['num_hits'] ?? 0;
        $misses = $apcu['num_misses'] ?? 0;
        $total = $hits + $misses;
        
        $response['apcu'] = [
            'entries' => $apcu['num_entries'] ?? 0,
            'hits' => $hits,
            'misses' => $misses,
            'hit_rate' => $total > 0 ? round(($hits / $total) * 100, 2) : 0,
            'memory_mb' => isset($apcu['mem_size']) ? round($apcu['mem_size'] / 1024 / 1024, 2) : null,
        ];
        
        $response['performance']['apcu_hit_rate'] = $response['apcu']['hit_rate'];
    }
}

// Average query time is the database latency for now
$response['performance']['avg_query_time_ms'] = $response['database']['latency_ms'];

// System load (if available)
if (function_exists('sys_getloadavg')) {
    $load = sys_getloadavg();
    $response['system'] = [
        'load_1min' => round($load[0], 2),
        'load_5min' => round($load[1], 2),
        'load_15min' => round($load[2], 2),
    ];
}

echo json_encode($response, JSON_PRETTY_PRINT);


