<?php
// API endpoint to fetch recent RFID logs
// Returns logs in descending order (most recent first)

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';
require_once '../config/timezone.php';

// Get optional limit parameter (default: 50 logs)
$limit = isset($_GET['limit']) ? min((int)$_GET['limit'], 500) : 50;

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
    // Fetch logs from rfid_logs table
    $stmt = $conn->prepare("SELECT id, time_log, rfid_data, rfid_status FROM rfid_logs ORDER BY time_log DESC LIMIT :limit");
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $logs = $stmt->fetchAll();

    $rfidValues = array_unique(array_map(static function ($log) {
        return $log['rfid_data'];
    }, $logs));

    $rfidStatusMap = [];

    if (!empty($rfidValues)) {
        $placeholders = implode(',', array_fill(0, count($rfidValues), '?'));
        $lookupStmt = $conn->prepare("SELECT rfid_data, rfid_status FROM rfid_reg WHERE rfid_data IN ($placeholders)");
        $lookupStmt->execute(array_values($rfidValues));

        while ($row = $lookupStmt->fetch()) {
            $rfidStatusMap[$row['rfid_data']] = (bool)$row['rfid_status'];
        }
    }

    // Format timestamps and status text
    foreach ($logs as &$log) {
        $datetime = new DateTimeImmutable($log['time_log'], manila_timezone());
        $log['time_log_formatted'] = $datetime->format('Y-m-d h:i:s A');
        $log['date'] = $datetime->format('Y-m-d');
        $log['time_12hr'] = $datetime->format('h:i:s A');
        $log['rfid_status'] = (bool)$log['rfid_status'];

        $rfidExists = array_key_exists($log['rfid_data'], $rfidStatusMap);
        if ($rfidExists) {
            $log['found'] = true;
            $log['status_text'] = $log['rfid_status'] ? '1' : '0';
        } else {
            $log['found'] = false;
            $log['status_text'] = 'RFID NOT FOUND';
        }
    }
    
    echo json_encode([
        'success' => true,
        'count' => count($logs),
        'logs' => $logs
    ]);
    
} catch (PDOException $e) {
    error_log("Database Error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Database error occurred',
        'logs' => []
    ]);
}
?>

