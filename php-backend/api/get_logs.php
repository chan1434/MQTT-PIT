<?php
// API endpoint to fetch recent RFID logs
// Returns logs in descending order (most recent first)

// Enable output buffering for better compression
ob_start('ob_gzhandler');

header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');

require_once '../config/database.php';
require_once '../config/timezone.php';

// Pre-compute timezone once for performance
$tz = manila_timezone();

// Get optional limit parameter (default: 50 logs)
$limit = isset($_GET['limit']) ? min((int)$_GET['limit'], 500) : 50;
$limit = max(1, $limit);

// Cursor for incremental fetch
$afterId = isset($_GET['after_id']) ? max(0, (int)$_GET['after_id']) : 0;

// Connect to database
$conn = getDBConnection();
if (!$conn) {
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed',
        'logs' => []
    ]);
    exit();
}

try {
    // Optimized query with LEFT JOIN - eliminates N+1 problem
    // Using LEFT JOIN to include logs even if RFID is not registered
    // This single query replaces the previous 2-N queries
    $whereClause = $afterId > 0 ? 'WHERE l.id > :after_id' : '';

    $stmt = $conn->prepare("
        SELECT 
            l.id,
            l.time_log,
            l.rfid_data,
            l.rfid_status,
            r.rfid_status AS current_rfid_status,
            CASE 
                WHEN r.rfid_data IS NULL THEN 0
                ELSE 1
            END AS rfid_found
        FROM rfid_logs l
        LEFT JOIN rfid_reg r ON l.rfid_data = r.rfid_data
        $whereClause
        ORDER BY l.time_log DESC
        LIMIT :limit
    ");
    
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    if ($afterId > 0) {
        $stmt->bindValue(':after_id', $afterId, PDO::PARAM_INT);
    }
    $stmt->execute();
    $logs = $stmt->fetchAll();

    // Format timestamps and status text (using pre-computed timezone)
    foreach ($logs as &$log) {
        $datetime = new DateTimeImmutable($log['time_log'], $tz);
        $log['time_log_formatted'] = $datetime->format('Y-m-d h:i:s A');
        $log['date'] = $datetime->format('Y-m-d');
        $log['time_12hr'] = $datetime->format('h:i:s A');
        
        // Convert to boolean
        $log['rfid_status'] = (bool)$log['rfid_status'];
        $log['found'] = (bool)$log['rfid_found'];
        
        // Set status text based on whether RFID is found in registry
        if ($log['found']) {
            $log['status_text'] = $log['rfid_status'] ? '1' : '0';
        } else {
            $log['status_text'] = 'RFID NOT FOUND';
        }
        
        // Remove temporary fields from response
        unset($log['current_rfid_status']);
        unset($log['rfid_found']);
    }
    
    $latestLog = $logs[0]['time_log'] ?? null;
    $latestId = $logs[0]['id'] ?? $afterId;
    $lastModifiedHeader = null;

    if ($latestLog) {
        $timestamp = strtotime($latestLog);
        if ($timestamp !== false) {
            $lastModifiedHeader = gmdate('D, d M Y H:i:s', $timestamp) . ' GMT';
            header('Last-Modified: ' . $lastModifiedHeader);
        }
    }

    $etagPayload = $latestLog . ':' . $latestId . ':' . count($logs);
    $etag = '"' . sha1($etagPayload) . '"';
    header('ETag: ' . $etag);

    if ($afterId === 0 && $latestLog !== null) {
        $clientEtag = trim($_SERVER['HTTP_IF_NONE_MATCH'] ?? '');
        $clientModified = $_SERVER['HTTP_IF_MODIFIED_SINCE'] ?? '';

        if ($clientEtag !== '' && $clientEtag === $etag) {
            http_response_code(304);
            exit();
        }

        if ($lastModifiedHeader && $clientModified !== '') {
            $clientTime = strtotime($clientModified);
            $serverTime = strtotime($lastModifiedHeader);
            if ($clientTime !== false && $serverTime !== false && $clientTime >= $serverTime) {
                http_response_code(304);
                exit();
            }
        }
    }

    echo json_encode([
        'success' => true,
        'count' => count($logs),
        'logs' => $logs,
        'cursor' => [
            'latest_id' => $latestId,
            'requested_after_id' => $afterId,
        ],
        'last_modified' => $latestLog,
        'etag' => trim($etag, '"'),
    ]);
    
} catch (PDOException $e) {
    error_log("Database Error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Database error occurred',
        'logs' => []
    ]);
}

// Flush output buffer
ob_end_flush();
?>

