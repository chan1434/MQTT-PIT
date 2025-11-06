-- RFID MQTT IoT System Database Initialization
-- Database: it414_db_GROUP1

-- Create database
CREATE DATABASE IF NOT EXISTS it414_db_GROUP1;
USE it414_db_GROUP1;

-- Table for registered RFID cards
CREATE TABLE IF NOT EXISTS rfid_reg (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfid_data VARCHAR(50) NOT NULL UNIQUE,
    rfid_status BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for RFID scan logs
CREATE TABLE IF NOT EXISTS rfid_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    time_log DATETIME NOT NULL,
    rfid_data VARCHAR(50) NOT NULL,
    rfid_status BOOLEAN NOT NULL,
    INDEX idx_time_log (time_log DESC),
    INDEX idx_rfid_data (rfid_data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert sample RFID data for testing
INSERT INTO rfid_reg (rfid_data, rfid_status) VALUES
    ('1A2B3C4D', 1),
    ('5E6F7G8H', 1),
    ('9I0J1K2L', 0),
    ('3M4N5O6P', 1)
ON DUPLICATE KEY UPDATE rfid_data=rfid_data;

-- Display tables
SHOW TABLES;
SELECT 'Database setup complete!' AS Status;

