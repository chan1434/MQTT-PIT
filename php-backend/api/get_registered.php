<?php
// API endpoint to fetch all registered RFID cards
// Returns list of registered RFIDs with their status

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

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
    // Fetch all registered RFIDs
    $stmt = $conn->prepare("SELECT id, rfid_data, rfid_status, created_at, updated_at FROM rfid_reg ORDER BY id ASC");
    $stmt->execute();
    $registered = $stmt->fetchAll();
    
    // Format response
    foreach ($registered as &$rfid) {
        $rfid['rfid_status'] = (bool)$rfid['rfid_status'];
        $rfid['status_text'] = $rfid['rfid_status'] ? 'Active' : 'Inactive';
    }
    
    echo json_encode([
        'success' => true,
        'count' => count($registered),
        'registered' => $registered
    ]);
    
} catch (PDOException $e) {
    error_log("Database Error: " . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Database error occurred',
        'registered' => []
    ]);
}
?>

