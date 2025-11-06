<?php
// API endpoint to fetch recent RFID logs
// Returns logs in descending order (most recent first)

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

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
    
    // Format timestamps for 12-hour format with AM/PM
    foreach ($logs as &$log) {
        $datetime = new DateTime($log['time_log']);
        $log['time_log_formatted'] = $datetime->format('Y-m-d h:i:s A');
        $log['date'] = $datetime->format('Y-m-d');
        $log['time_12hr'] = $datetime->format('h:i:s A');
        $log['rfid_status'] = (bool)$log['rfid_status'];
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

