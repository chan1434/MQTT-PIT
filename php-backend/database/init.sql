
CREATE DATABASE IF NOT EXISTS it414_db_ajjcr;
USE it414_db_ajjcr;

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
('63:70:DA:39', 1), 
('A2:CD:AB:AB', 0) 
ON DUPLICATE KEY UPDATE rfid_status = VALUES(rfid_status); 

-- Display tables
SHOW TABLES;
SELECT 'Database setup complete!' AS Status;

