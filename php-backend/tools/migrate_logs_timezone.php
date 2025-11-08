<?php

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/timezone.php';

$options = getopt('', ['source::', 'apply', 'limit::']);

$sourceTzName = $options['source'] ?? 'UTC';
$applyChanges = array_key_exists('apply', $options);
$limit = isset($options['limit']) ? max(1, (int)$options['limit']) : null;

try {
    $sourceTz = new DateTimeZone($sourceTzName);
} catch (Exception $e) {
    fwrite(STDERR, "Invalid source timezone: {$sourceTzName}\n");
    exit(1);
}

$targetTz = manila_timezone();

$pdo = getDBConnection();
if (!$pdo) {
    fwrite(STDERR, "Failed to connect to the database.\n");
    exit(1);
}

$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$query = 'SELECT id, time_log FROM rfid_logs ORDER BY id';
if ($limit !== null) {
    $query .= ' LIMIT :limit';
}

$stmt = $pdo->prepare($query);

if ($limit !== null) {
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
}

$stmt->execute();

$updates = [];

while ($row = $stmt->fetch()) {
    if (empty($row['time_log'])) {
        continue;
    }

    try {
        $original = new DateTimeImmutable($row['time_log'], $sourceTz);
    } catch (Exception $e) {
        fwrite(STDERR, "Skipping log {$row['id']}: invalid datetime '{$row['time_log']}'.\n");
        continue;
    }

    $converted = $original->setTimezone($targetTz);
    $convertedFormatted = $converted->format('Y-m-d H:i:s');

    if ($convertedFormatted === $row['time_log']) {
        continue;
    }

    $updates[] = [
        'id' => (int)$row['id'],
        'from' => $row['time_log'],
        'to' => $convertedFormatted,
    ];
}

if (empty($updates)) {
    echo "No log entries require timezone conversion.\n";
    exit(0);
}

echo "Prepared " . count($updates) . " updates from {$sourceTzName} to Asia/Manila." . PHP_EOL;

foreach ($updates as $update) {
    echo "#{$update['id']}: {$update['from']} -> {$update['to']}" . PHP_EOL;
}

if (!$applyChanges) {
    echo PHP_EOL . "Dry run complete. Re-run with --apply to persist changes." . PHP_EOL;
    exit(0);
}

$pdo->beginTransaction();

$updateStmt = $pdo->prepare('UPDATE rfid_logs SET time_log = :time_log WHERE id = :id');

try {
    foreach ($updates as $update) {
        $updateStmt->execute([
            'time_log' => $update['to'],
            'id' => $update['id'],
        ]);
    }

    $pdo->commit();
    echo PHP_EOL . "Applied " . count($updates) . " updates." . PHP_EOL;
} catch (Exception $e) {
    $pdo->rollBack();
    fwrite(STDERR, "Failed to apply updates: {$e->getMessage()}\n");
    exit(1);
}

echo "Timezone migration complete." . PHP_EOL;


