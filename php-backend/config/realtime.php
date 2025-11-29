<?php

define('REALTIME_BRIDGE_URL', getenv('REALTIME_BRIDGE_URL') ?: 'https://localhost:9443/broadcast');
define('REALTIME_BRIDGE_ENABLED', getenv('REALTIME_BRIDGE_ENABLED') !== '0');
define('REALTIME_BRIDGE_CA', getenv('REALTIME_BRIDGE_CA') ?: '');

function notifyRealtimeBridge(array $payload): bool
{
    if (!REALTIME_BRIDGE_ENABLED || empty(REALTIME_BRIDGE_URL)) {
        return false;
    }

    $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        error_log('Realtime bridge: failed to encode payload to JSON');
        return false;
    }

    if (triggerAsyncBridgeRequest(REALTIME_BRIDGE_URL, $json)) {
        return true;
    }

    return performSynchronousBridgeRequest(REALTIME_BRIDGE_URL, $json);
}

function triggerAsyncBridgeRequest(string $url, string $json): bool
{
    if (!function_exists('exec')) {
        return false;
    }

    $command = buildAsyncCurlCommand($url, $json);
    if ($command === null) {
        return false;
    }

    try {
        exec($command);
        return true;
    } catch (\Throwable $e) {
        error_log('Realtime bridge async exec failed: ' . $e->getMessage());
        return false;
    }
}

function buildAsyncCurlCommand(string $url, string $json): ?string
{
    $escapedJson = escapeshellarg($json);
    $escapedUrl = escapeshellarg($url);

    if (stripos(PHP_OS_FAMILY, 'Windows') === 0) {
        return sprintf(
            'start "" /B curl -s -S -o NUL -X POST -H "Content-Type: application/json" --data %s %s',
            $escapedJson,
            $escapedUrl
        );
    }

    return sprintf(
        'curl -s -S -o /dev/null -X POST -H "Content-Type: application/json" --data %s %s > /dev/null 2>&1 &',
        $escapedJson,
        $escapedUrl
    );
}

function performSynchronousBridgeRequest(string $url, string $json): bool
{
    $ch = curl_init($url);
    if ($ch === false) {
        error_log('Realtime bridge: failed to initialize cURL');
        return false;
    }

    $options = [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $json,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($json),
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 2,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ];

    if (!empty(REALTIME_BRIDGE_CA)) {
        $options[CURLOPT_CAINFO] = REALTIME_BRIDGE_CA;
    }

    curl_setopt_array($ch, $options);

    $response = curl_exec($ch);

    if ($response === false) {
        error_log('Realtime bridge (sync): ' . curl_error($ch));
        curl_close($ch);
        return false;
    }

    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status >= 200 && $status < 300) {
        return true;
    }

    error_log('Realtime bridge (sync): unexpected status ' . $status . ' with response ' . $response);
    return false;
}

