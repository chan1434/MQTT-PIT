<?php
/**
 * Compression Test Script
 * Access: http://localhost/php-backend/api/test_compression.php
 * 
 * This script helps verify that gzip compression is working correctly.
 * It displays compression status and statistics.
 */

header('Content-Type: application/json');

// Generate a large JSON response to test compression
$test_data = [
    'compression_test' => true,
    'timestamp' => date('Y-m-d H:i:s'),
    'server_info' => [
        'php_version' => PHP_VERSION,
        'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
        'compression_enabled' => in_array('ob_gzhandler', ob_list_handlers()) || 
                                isset($_SERVER['HTTP_ACCEPT_ENCODING']) && 
                                strpos($_SERVER['HTTP_ACCEPT_ENCODING'], 'gzip') !== false,
    ],
    'headers' => [
        'content_encoding' => 'Check response headers for "Content-Encoding: gzip"',
        'vary' => 'Check for "Vary: Accept-Encoding"',
        'content_length' => 'Compressed size in bytes',
    ],
    'large_data' => array_fill(0, 100, [
        'id' => rand(1, 1000),
        'rfid_data' => sprintf('%02X:%02X:%02X:%02X', rand(0, 255), rand(0, 255), rand(0, 255), rand(0, 255)),
        'rfid_status' => (bool)rand(0, 1),
        'timestamp' => date('Y-m-d H:i:s', time() - rand(0, 86400)),
        'message' => 'This is a test message to increase the response size for better compression demonstration. Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    ]),
    'instructions' => [
        '1' => 'Open browser developer tools (F12)',
        '2' => 'Go to Network tab',
        '3' => 'Reload this page',
        '4' => 'Click on this request',
        '5' => 'Check Response Headers for "Content-Encoding: gzip"',
        '6' => 'Compare "Content-Length" (compressed) with "Size" (uncompressed)',
    ],
    'expected_results' => [
        'uncompressed_size' => '~30-40 KB',
        'compressed_size' => '~3-6 KB',
        'compression_ratio' => '85-90%',
        'transfer_time' => 'Significantly faster',
    ],
    'troubleshooting' => [
        'no_compression' => [
            'symptom' => 'No "Content-Encoding: gzip" header',
            'solutions' => [
                'Check if mod_deflate is enabled in Apache',
                'Verify .htaccess file exists in php-backend/',
                'Restart Apache after configuration changes',
                'Check Apache error logs for configuration errors',
            ],
        ],
        'partial_compression' => [
            'symptom' => 'Some responses compressed, others not',
            'solutions' => [
                'Ensure Content-Type is set correctly',
                'Check file size is above minimum threshold (usually 1KB)',
                'Verify Accept-Encoding header is sent by client',
            ],
        ],
    ],
];

// Calculate uncompressed size
$uncompressed = json_encode($test_data, JSON_PRETTY_PRINT);
$uncompressed_size = strlen($uncompressed);

// Add size information to response
$test_data['actual_sizes'] = [
    'uncompressed_bytes' => $uncompressed_size,
    'uncompressed_kb' => round($uncompressed_size / 1024, 2),
    'note' => 'Compressed size will be shown in browser Network tab',
];

// Add compression detection
$accepts_gzip = isset($_SERVER['HTTP_ACCEPT_ENCODING']) && 
                strpos($_SERVER['HTTP_ACCEPT_ENCODING'], 'gzip') !== false;

$test_data['client_info'] = [
    'accepts_gzip' => $accepts_gzip,
    'accept_encoding_header' => $_SERVER['HTTP_ACCEPT_ENCODING'] ?? 'Not sent',
    'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown',
];

// Output JSON response
echo json_encode($test_data, JSON_PRETTY_PRINT);

// Add a comment at the end with size info (will be compressed too)
echo "\n\n/* Uncompressed size: " . $uncompressed_size . " bytes (" . 
     round($uncompressed_size / 1024, 2) . " KB) */\n";
echo "/* Check Network tab in DevTools to see compressed size */\n";

