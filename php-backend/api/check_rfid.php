<?php
// API endpoint to check RFID card and log activity
// Expected from ESP32: GET/POST parameter 'rfid_data'

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';
require_once '../config/timezone.php';
require_once '../config/realtime.php';

// Function to format response
function sendResponse($status, $found, $message, $rfid_data = '', $status_text = null) {
    $now = manila_now();

    echo json_encode([
        'status' => $status,
        'found' => $found,
        'message' => $message,
        'rfid_data' => $rfid_data,
        'status_text' => $status_text,
        'timestamp' => $now->format('Y-m-d H:i:s')
    ]);
    exit();
}

// Get RFID data from request
$rfid_data = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rfid_data = isset($_POST['rfid_data']) ? trim($_POST['rfid_data']) : '';
} else if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rfid_data = isset($_GET['rfid_data']) ? trim($_GET['rfid_data']) : '';
}

// Validate RFID data
if (empty($rfid_data)) {
    sendResponse(0, false, 'No RFID data provided');
}

// Connect to database
$conn = getDBConnection();
if (!$conn) {
    sendResponse(0, false, 'Database connection failed');
}

try {
    // Check if RFID exists in rfid_reg table
    $stmt = $conn->prepare("SELECT rfid_data, rfid_status FROM rfid_reg WHERE rfid_data = :rfid_data");
    $stmt->execute(['rfid_data' => $rfid_data]);
    $result = $stmt->fetch();
    
    $status = 0;
    $found = false;
    $status_text = 'RFID NOT FOUND';
    
    if ($result) {
        // RFID found in database
        $found = true;
        $status = (int)$result['rfid_status'];
        $status_text = (string)$status;
    }
    
    // Log the activity to rfid_logs
    $now = manila_now();
    $current_time = $now->format('Y-m-d H:i:s');
    $log_stmt = $conn->prepare("INSERT INTO rfid_logs (time_log, rfid_data, rfid_status) VALUES (:time_log, :rfid_data, :rfid_status)");
    $log_stmt->execute([
        'time_log' => $current_time,
        'rfid_data' => $rfid_data,
        'rfid_status' => $status
    ]);

    $log_id = (int)$conn->lastInsertId();
    $datetime = new DateTimeImmutable($current_time, manila_timezone());

    $log_payload = [
        'id' => $log_id,
        'time_log' => $current_time,
        'time_log_formatted' => $datetime->format('Y-m-d h:i:s A'),
        'date' => $datetime->format('Y-m-d'),
        'time_12hr' => $datetime->format('h:i:s A'),
        'rfid_data' => $rfid_data,
        'rfid_status' => (bool)$status,
        'status_text' => $status_text,
        'status' => $status,
        'found' => $found,
        'message' => $status_text,
    ];

    notifyRealtimeBridge([
        'type' => 'rfid-log',
        'data' => $log_payload,
    ]);
    
    // Send response
    sendResponse($status, $found, $status_text, $rfid_data, $status_text);
    
} catch (PDOException $e) {
    error_log("Database Error: " . $e->getMessage());
    sendResponse(0, false, 'Database error occurred');
}
?>

