<?php

define('REALTIME_BRIDGE_URL', getenv('REALTIME_BRIDGE_URL') ?: 'https://localhost:9443/broadcast');
define('REALTIME_BRIDGE_ENABLED', getenv('REALTIME_BRIDGE_ENABLED') !== '0');

function notifyRealtimeBridge(array $payload): bool
{
    if (!REALTIME_BRIDGE_ENABLED || empty(REALTIME_BRIDGE_URL)) {
        return false;
    }

    $json = json_encode($payload);
    if ($json === false) {
        error_log('Realtime bridge: failed to encode payload to JSON');
        return false;
    }

    $ch = curl_init(REALTIME_BRIDGE_URL);
    if ($ch === false) {
        error_log('Realtime bridge: failed to initialize cURL');
        return false;
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $json,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($json),
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 2,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
    ]);

    $response = curl_exec($ch);

    if ($response === false) {
        error_log('Realtime bridge: ' . curl_error($ch));
        curl_close($ch);
        return false;
    }

    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($status >= 200 && $status < 300) {
        return true;
    }

    error_log('Realtime bridge: unexpected status ' . $status . ' with response ' . $response);
    return false;
}


