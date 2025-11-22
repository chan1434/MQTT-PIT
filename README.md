# RFID-MQTT IoT Access Control System

A complete IoT access control system using ESP32 microcontrollers, RFID scanner, MQTT messaging, MySQL database, PHP backend, and a real-time Qwik web interface.

## 🎯 Project Overview

This system enables RFID-based access control with real-time monitoring capabilities:
- **ESP32 #1**: Reads RFID cards, validates against database, publishes status via MQTT
- **ESP32 #2**: Subscribes to MQTT, controls relay/LED based on access status
- **Web Dashboard**: Real-time monitoring of RFID scans and registered cards
- **Database**: Stores registered RFIDs and access logs with timestamps

## 📦 Requirements

### Hardware
1. 2x ESP32 Development Boards
2. 1x MFRC-522 RFID Scanner Module
3. 1x Breadboard
4. 1x Single Channel Relay Module
5. 1x LED
6. Connecting Wires

### Software
1. [PlatformIO](https://platformio.org/) - ESP32 firmware development
2. [XAMPP](https://www.apachefriends.org/) - PHP & MySQL (installed at `D:\xampp`)
3. [Mosquitto MQTT Broker](https://mosquitto.org/) - Message broker
4. [MQTTX](https://mqttx.app/) - MQTT client for testing
5. [Node.js](https://nodejs.org/) v18+ - Qwik development

## 🔌 Hardware Wiring

### ESP32 #1 - RFID Scanner

| MFRC522 Pin | ESP32 Pin | Description |
|-------------|-----------|-------------|
| 3.3V        | 3.3V      | Power       |
| RST         | GPIO 2    | Reset       |
| GND         | GND       | Ground      |
| MISO        | GPIO 19   | SPI MISO    |
| MOSI        | GPIO 23   | SPI MOSI    |
| SCK         | GPIO 18   | SPI Clock   |
| SDA/SS      | GPIO 5    | Chip Select |

### ESP32 #2 - Relay Controller

| Relay Pin | ESP32 Pin | Description |
|-----------|-----------|-------------|
| VCC       | 5V        | Power       |
| GND       | GND       | Ground      |
| IN        | GPIO 26   | Control     |
| COM       | 3.3V      | Common      |
| NO        | LED (+)   | Normally Open |
| -         | GND       | LED (-)     |

**Note**: The relay's Normally Open (NO) pin connects to the LED's positive (longer) leg. The LED's negative (shorter) leg connects to GND.

## 🚀 Installation & Setup

### 1. Database Setup

1. Start XAMPP and ensure Apache and MySQL are running
2. Open phpMyAdmin at `http://localhost/phpmyadmin`
3. Import the database:
   ```bash
   # Execute the SQL script
   mysql -u root < php-backend/database/init.sql
   ```
   Or manually import `php-backend/database/init.sql` via phpMyAdmin

4. Verify the database `it414_db_ajjcr` was created with tables:
   - `rfid_reg` - Registered RFID cards
   - `rfid_logs` - Access attempt logs

### 2. PHP Backend Setup

1. Copy the `php-backend` folder to XAMPP's htdocs:
   ```bash
   cp -r php-backend D:/xampp/htdocs/
   ```

2. Verify PHP files are accessible:
   - Test: `http://localhost/php-backend/api/get_registered.php`
   - You should see JSON output with registered RFIDs

### 3. MQTT Broker Setup

1. Install and start Mosquitto MQTT Broker:
   ```bash
   # Windows - Start as service
   net start mosquitto
   
   # Or run manually
   mosquitto -v
   ```

2. Default configuration: `localhost:1883` (no authentication)

3. Test with MQTTX:
   - Connect to `mqtt://localhost:1883`
   - Subscribe to topic: `RFID_LOGIN`
   - You should see "1" or "0" messages when RFID cards are scanned

### 4. ESP32 Firmware Upload

#### ESP32 #1 - RFID Scanner

1. Update the API endpoint in `src/main.cpp`:
   ```cpp
   // Replace with your computer's local IP address
   const char* api_endpoint = "http://192.168.1.100/php-backend/api/check_rfid.php";
   ```

2. Build and upload:
   ```bash
   cd RFID_MQTT
   pio run -e esp32_rfid -t upload
   pio device monitor -e esp32_rfid
   ```

#### ESP32 #2 - Relay Controller

1. Build and upload:
   ```bash
   pio run -e esp32_relay -t upload
   pio device monitor -e esp32_relay
   ```

### 5. Qwik Web Interface

1. Install dependencies:
   ```bash
   cd qwik-app
   npm install
   ```

2. Update API endpoint in `src/routes/index.tsx` if needed:
   ```typescript
   const API_BASE_URL = "http://localhost/php-backend/api";
   ```

3. Generate SSL certificates for HTTPS:
   ```bash
   npm run generate-certs
   ```
   Note: Certificates are auto-generated when you run `npm run dev`

4. Start development server:
   ```bash
   npm run dev
   ```
   The server automatically uses HTTPS if certificates are available

5. Access the dashboard:
   - HTTPS: `https://localhost:5174` (default with certificates)
   - HTTP: `http://localhost:5173` (fallback if certificates not found)

## 🧪 Testing

### Basic Functionality Test

1. **Database Check**:
   - Open phpMyAdmin
   - Verify `rfid_reg` has sample RFIDs (1A2B3C4D, 5E6F7G8H, etc.)
   - Check `rfid_logs` table exists

2. **MQTT Broker Check**:
   - Open MQTTX
   - Connect to `mqtt://localhost:1883`
   - Subscribe to `RFID_LOGIN`

3. **ESP32 #1 RFID Scanner**:
   - Open Serial Monitor (115200 baud)
   - Scan an RFID card
   - Should see: HTTP request, JSON response, MQTT publish
   - Check MQTTX receives "1" or "0"

4. **ESP32 #2 Relay Controller**:
   - Open Serial Monitor (115200 baud)
   - Should see MQTT connection and subscription
   - When ESP32 #1 scans a card, ESP32 #2 should receive message
   - LED should turn ON (message "1") or OFF (message "0")

5. **Web Dashboard**:
   - Open `https://localhost:5174`
   - Accept the security warning (self-signed certificate)
   - Should display registered RFIDs
   - Scan RFID card with ESP32 #1
   - Dashboard should update within 2 seconds
   - New log entry should appear in table

### Cross-Group Testing

Since all ESP32s listening to the MQTT broker on the same network can receive messages:

1. Ensure your ESP32s are on "Cloud Control Network" WiFi
2. Other groups scanning RFIDs should trigger your ESP32 #2 relay
3. This confirms proper MQTT pub/sub communication

## 📱 Web Interface Features

- **HTTPS-Only**: Secure connection enforced by default
- **Real-time Updates**: Auto-refreshes every 2 seconds
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Offline Capable**: Service worker caches app for offline use
- **Auto SSL Certificates**: Self-signed certificates generated automatically
- **Status Indicators**: Color-coded badges (green=granted, red=denied)
- **12-hour Time Format**: Easy-to-read timestamps with AM/PM
- **Mobile-Friendly Table**: Horizontal scroll on small screens

## 🛠️ Troubleshooting

### ESP32 Won't Connect to WiFi
- Check SSID and password in code
- Ensure WiFi network is 2.4GHz (ESP32 doesn't support 5GHz)
- Try adding your home WiFi to the networks array

### ESP32 Can't Reach PHP Backend
- Use your computer's local IP instead of "localhost"
- Check Windows Firewall isn't blocking connections
- Ensure XAMPP Apache is running on port 80

### MQTT Not Working
- Verify Mosquitto service is running: `netstat -an | findstr 1883`
- Check ESP32 can reach broker (same network)
- Test with MQTTX first before testing ESP32s

### Database Connection Failed
- Verify MySQL is running in XAMPP Control Panel
- Check database credentials in `php-backend/config/database.php`
- Ensure database and tables were created successfully

### Web Dashboard Not Updating
- Check browser console for errors (F12)
- Verify API endpoints return JSON (visit URLs directly in HTTP, not HTTPS)
- Ensure CORS headers are enabled in PHP
- Note: Dashboard uses HTTPS, but fetches from HTTP backend (localhost)
- Confirm you're using HTTPS: `https://localhost:5174`

### SSL Certificate Issues
- Run `npm run generate-certs` to regenerate certificates
- Ensure Git for Windows is installed (includes OpenSSL)
- Or install mkcert for trusted certificates
- Check `qwik-app/certs/` folder contains .pem files

### Relay Not Switching
- Check relay wiring (VCC to 5V, not 3.3V)
- Verify GPIO 26 is configured correctly
- Test relay manually: `digitalWrite(26, HIGH);` in loop()
- Measure voltage on IN pin (should toggle between 0V and 3.3V)

## 📂 Project Structure

```
RFID_MQTT/
├── php-backend/
│   ├── config/
│   │   └── database.php          # MySQL connection
│   ├── api/
│   │   ├── check_rfid.php        # RFID verification
│   │   ├── get_logs.php          # Fetch logs
│   │   └── get_registered.php    # Fetch registered RFIDs
│   └── database/
│       └── init.sql               # Database schema
├── src/
│   ├── main.cpp                   # ESP32 #1 - RFID Scanner
│   └── main_relay.cpp             # ESP32 #2 - Relay Controller
├── qwik-app/
│   ├── src/
│   │   ├── components/
│   │   │   ├── rfid-status.tsx   # Registered RFIDs component
│   │   │   └── rfid-logs.tsx     # Logs table component
│   │   └── routes/
│   │       └── index.tsx          # Main dashboard
│   └── scripts/
│       └── generate-certs.js      # SSL cert generator
├── platformio.ini                 # PlatformIO configuration
└── README.md                      # This file
```

## 🔐 Security Notes

⚠️ **Important**: This is a development/educational project with minimal security:

- **HTTPS Required**: Web interface enforces HTTPS with self-signed certificates
- Database has no password (default XAMPP)
- MQTT has no authentication
- SSL certificates are self-signed (for development only)
- API has no rate limiting or authentication
- ESP32 uses HTTP to backend (acceptable on local network)

For production use, implement:
- Strong database passwords
- MQTT authentication (username/password or certificates)
- Valid SSL certificates (Let's Encrypt) instead of self-signed
- API authentication (JWT tokens)
- Input validation and sanitization
- SQL injection prevention (already using prepared statements)
- HTTPS for ESP32 communication (requires WiFiClientSecure)

## 📊 Database Schema

### Table: rfid_reg
| Column       | Type         | Description           |
|--------------|--------------|----------------------|
| id           | INT (PK)     | Auto-increment       |
| rfid_data    | VARCHAR(50)  | RFID card UID        |
| rfid_status  | BOOLEAN      | Access permission    |
| created_at   | TIMESTAMP    | Creation time        |
| updated_at   | TIMESTAMP    | Last update time     |

### Table: rfid_logs
| Column       | Type         | Description           |
|--------------|--------------|----------------------|
| id           | INT (PK)     | Auto-increment       |
| time_log     | DATETIME     | Scan timestamp       |
| rfid_data    | VARCHAR(50)  | RFID card UID        |
| rfid_status  | BOOLEAN      | Access result        |

## 🎓 Educational Notes

This project demonstrates:
- **IoT Communication**: HTTP REST API calls from ESP32
- **Real-time Messaging**: MQTT publish/subscribe pattern
- **Database Integration**: MySQL with PHP backend
- **Modern Web Development**: Qwik framework with SSR
- **Hardware Control**: GPIO output for relay control
- **SPI Communication**: RFID reader interface
- **Cross-device Communication**: Multiple ESP32s on same network

## 📝 License

This project is for educational purposes as part of IT414 coursework.

## 👥 Credits

**Group 1**
- Project: RFID-MQTT IoT Access Control System
- Course: IT414
- Year: 2025

## 🆘 Support

If you encounter issues:
1. Check the Troubleshooting section
2. Verify all services are running (XAMPP, Mosquitto)
3. Check Serial Monitor output for ESP32 error messages
4. Review browser console for web interface errors
5. Test each component individually before integration

---

**Happy Building! 🚀**

