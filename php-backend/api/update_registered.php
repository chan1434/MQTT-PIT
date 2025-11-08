<?php
// API endpoint to update a registered RFID card's status

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Method not allowed'
    ]);
    exit();
}

require_once '../config/database.php';

$rawInput = file_get_contents('php://input');
$data = [];

if (!empty($rawInput)) {
    $decoded = json_decode($rawInput, true);
    if (json_last_error() === JSON_ERROR_NONE) {
        $data = $decoded;
    }
}

if (empty($data)) {
    $data = $_POST;
}

$rfidId = isset($data['id']) ? (int)$data['id'] : null;
$rfidData = isset($data['rfid_data']) ? strtoupper(trim($data['rfid_data'])) : null;
$statusProvided = array_key_exists('status', $data);

if (!$statusProvided) {
    echo json_encode([
        'success' => false,
        'message' => 'Missing required parameter: status'
    ]);
    exit();
}

$status = (int)$data['status'] ? 1 : 0;

if ($rfidId === null && ($rfidData === null || $rfidData === '')) {
    echo json_encode([
        'success' => false,
        'message' => 'Provide either id or rfid_data'
    ]);
    exit();
}

try {
    $conn = getDBConnection();
    if (!$conn) {
        throw new RuntimeException('Database connection failed');
    }

    if ($rfidId !== null) {
        $selectStmt = $conn->prepare('SELECT id, rfid_data, rfid_status, created_at, updated_at FROM rfid_reg WHERE id = :id');
        $selectStmt->execute(['id' => $rfidId]);
    } else {
        $selectStmt = $conn->prepare('SELECT id, rfid_data, rfid_status, created_at, updated_at FROM rfid_reg WHERE rfid_data = :rfid_data');
        $selectStmt->execute(['rfid_data' => $rfidData]);
    }

    $existing = $selectStmt->fetch();

    if (!$existing) {
        echo json_encode([
            'success' => false,
            'message' => 'RFID not found'
        ]);
        exit();
    }

    $updateStmt = $conn->prepare('UPDATE rfid_reg SET rfid_status = :status WHERE id = :id');
    $updateStmt->execute([
        'status' => $status,
        'id' => (int)$existing['id'],
    ]);

    $refreshStmt = $conn->prepare('SELECT id, rfid_data, rfid_status, created_at, updated_at FROM rfid_reg WHERE id = :id');
    $refreshStmt->execute(['id' => (int)$existing['id']]);
    $updated = $refreshStmt->fetch();

    if (!$updated) {
        throw new RuntimeException('Failed to fetch updated record');
    }

    $responseItem = [
        'id' => (int)$updated['id'],
        'rfid_data' => $updated['rfid_data'],
        'rfid_status' => (bool)$updated['rfid_status'],
        'status_text' => $updated['rfid_status'] ? '1' : '0',
        'created_at' => $updated['created_at'],
        'updated_at' => $updated['updated_at'],
    ];

    echo json_encode([
        'success' => true,
        'message' => 'RFID status updated',
        'registered' => $responseItem,
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    error_log('Update RFID Error: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => 'Failed to update RFID status'
    ]);
    exit();
}


