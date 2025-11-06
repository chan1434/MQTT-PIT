<?php
// Database configuration for XAMPP MySQL
// XAMPP Path: D:\xampp

// Database credentials
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'it414_db_GROUP1');
define('DB_CHARSET', 'utf8mb4');

// Create database connection
function getDBConnection() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];
        
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (PDOException $e) {
        // Log error and return false
        error_log("Database Connection Error: " . $e->getMessage());
        return false;
    }
}

// Test connection function
function testConnection() {
    $conn = getDBConnection();
    if ($conn) {
        return true;
    }
    return false;
}
?>

