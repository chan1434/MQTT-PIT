<?php
// Database configuration for XAMPP MySQL
// XAMPP Path: D:\xampp

// Database credentials
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'it414_db_ajjcr');
define('DB_CHARSET', 'utf8mb4');

// Create database connection with connection pooling and prepared statement caching
function getDBConnection() {
    try {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            // Error handling
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            
            // Performance optimizations
            PDO::ATTR_PERSISTENT         => true,  // Connection pooling (-50ms per request)
            PDO::ATTR_EMULATE_PREPARES   => false, // Native prepared statements
            PDO::MYSQL_ATTR_DIRECT_QUERY => false, // Use prepared statement cache
            
            // MySQL-specific optimizations
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4",
            PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
            
            // Timeout settings
            PDO::ATTR_TIMEOUT => 5,
        ];
        
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        
        // Additional performance settings
        $pdo->exec("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
        
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

