<?php
// API endpoint to check RFID card and log activity
// Expected from ESP32: GET/POST parameter 'rfid_data'

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

// Function to format response
function sendResponse($status, $found, $message, $rfid_data = '') {
    echo json_encode([
        'status' => $status,
        'found' => $found,
        'message' => $message,
        'rfid_data' => $rfid_data,
        'timestamp' => date('Y-m-d H:i:s')
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
    $message = 'RFID NOT FOUND';
    
    if ($result) {
        // RFID found in database
        $found = true;
        $status = (int)$result['rfid_status'];
        $message = $status ? 'Access Granted' : 'Access Denied';
    }
    
    // Log the activity to rfid_logs
    $current_time = date('Y-m-d H:i:s');
    $log_stmt = $conn->prepare("INSERT INTO rfid_logs (time_log, rfid_data, rfid_status) VALUES (:time_log, :rfid_data, :rfid_status)");
    $log_stmt->execute([
        'time_log' => $current_time,
        'rfid_data' => $rfid_data,
        'rfid_status' => $status
    ]);
    
    // Send response
    sendResponse($status, $found, $message, $rfid_data);
    
} catch (PDOException $e) {
    error_log("Database Error: " . $e->getMessage());
    sendResponse(0, false, 'Database error occurred');
}
?>

