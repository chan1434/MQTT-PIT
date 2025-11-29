<?php
// API endpoint to fetch all registered RFID cards
// Returns list of registered RFIDs with their status
// Implements APCu caching for improved performance

// Enable output buffering for better compression
ob_start('ob_gzhandler');

header('Content-Type: application/json');
header('Cache-Control: no-cache, must-revalidate');

require_once '../config/database.php';

// Cache configuration
define('CACHE_KEY', 'rfid_registered_list');
define('CACHE_TTL', 30); // Cache for 30 seconds

// Check for cache-busting and incremental options
$skipCache = isset($_GET['nocache']) && $_GET['nocache'] === '1';
$updatedSinceRaw = isset($_GET['updated_since']) ? trim($_GET['updated_since']) : null;
$updatedSince = null;

if ($updatedSinceRaw !== null && $updatedSinceRaw !== '') {
    $parsed = strtotime($updatedSinceRaw);
    if ($parsed !== false) {
        $updatedSince = date('Y-m-d H:i:s', $parsed);
    }
}

$canUseCache = !$skipCache && $updatedSince === null && function_exists('apcu_fetch') && function_exists('apcu_store');

if ($canUseCache) {
    $cached = apcu_fetch(CACHE_KEY, $success);
    
    if ($success && is_array($cached) && isset($cached['body'])) {
        header('X-Cache: HIT');
        header('X-Cache-TTL: ' . CACHE_TTL);
        if (!empty($cached['etag'])) {
            header('ETag: ' . $cached['etag']);
        }
        if (!empty($cached['last_modified'])) {
            header('Last-Modified: ' . $cached['last_modified']);
        }

        $clientEtag = trim($_SERVER['HTTP_IF_NONE_MATCH'] ?? '');
        $clientModified = $_SERVER['HTTP_IF_MODIFIED_SINCE'] ?? '';

        if ($clientEtag !== '' && !empty($cached['etag']) && $clientEtag === $cached['etag']) {
            http_response_code(304);
            exit();
        }

        if (!empty($cached['last_modified']) && $clientModified !== '') {
            $clientTime = strtotime($clientModified);
            $serverTime = strtotime($cached['last_modified']);
            if ($clientTime !== false && $serverTime !== false && $clientTime >= $serverTime) {
                http_response_code(304);
                exit();
            }
        }

        echo $cached['body'];
        exit();
    }
}

// Cache miss or APCu not available - fetch from database
header('X-Cache: MISS');

// Connect to database
$conn = getDBConnection();
if (!$conn) {
    echo json_encode([
        'success' => false,
        'message' => 'Database connection failed',
        'registered' => []
    ]);
    exit();
}

try {
    // Fetch registered RFIDs (optionally filtered)
    $whereClause = $updatedSince ? 'WHERE updated_at > :updated_since' : '';
    $stmt = $conn->prepare("SELECT id, rfid_data, rfid_status, created_at, updated_at FROM rfid_reg $whereClause ORDER BY id ASC");
    if ($updatedSince) {
        $stmt->bindValue(':updated_since', $updatedSince);
    }
    $stmt->execute();
    $registered = $stmt->fetchAll();
    
    $lastUpdatedAt = null;
    foreach ($registered as &$rfid) {
        $rfid['rfid_status'] = (bool)$rfid['rfid_status'];
        $rfid['status_text'] = $rfid['rfid_status'] ? '1' : '0';
        
        if (!empty($rfid['updated_at']) && ($lastUpdatedAt === null || $rfid['updated_at'] > $lastUpdatedAt)) {
            $lastUpdatedAt = $rfid['updated_at'];
        }
    }
    unset($rfid);
    
    $lastModifiedHeader = null;
    if ($lastUpdatedAt) {
        $timestamp = strtotime($lastUpdatedAt);
        if ($timestamp !== false) {
            $lastModifiedHeader = gmdate('D, d M Y H:i:s', $timestamp) . ' GMT';
            header('Last-Modified: ' . $lastModifiedHeader);
        }
    }
    
    $etagPayload = $lastUpdatedAt . ':' . count($registered);
    $etag = '"' . sha1($etagPayload) . '"';
    header('ETag: ' . $etag);
    
    $responseArray = [
        'success' => true,
        'count' => count($registered),
        'registered' => $registered,
        'cached' => false,
        'last_modified' => $lastUpdatedAt,
        'etag' => trim($etag, '"'),
        'filtered_since' => $updatedSince,
    ];
    
    $response = json_encode($responseArray);
    
    if ($canUseCache) {
        $stored = apcu_store(CACHE_KEY, [
            'body' => $response,
            'etag' => $etag,
            'last_modified' => $lastModifiedHeader,
        ], CACHE_TTL);
        if (!$stored) {
            error_log("APCu: Failed to store cache for key: " . CACHE_KEY);
        }
    }
    
    if ($updatedSince === null) {
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
    
    echo $response;
    
} catch (PDOException $e) {
    error_log("Database Error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Database error occurred',
        'registered' => []
    ]);
}

// Flush output buffer
ob_end_flush();
?>

