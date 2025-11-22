# Quick Setup Guide

## Step-by-Step Installation

### 1. Install Software (10 minutes)

#### XAMPP
1. Download from: https://www.apachefriends.org/
2. Install to `D:\xampp`
3. Start Apache and MySQL from XAMPP Control Panel

#### Mosquitto MQTT Broker
1. Download from: https://mosquitto.org/download/
2. Install with default settings
3. Start service: `net start mosquitto`

#### MQTTX Client
1. Download from: https://mqttx.app/
2. Install and open
3. Create connection: `mqtt://localhost:1883`

#### PlatformIO
1. Install VS Code: https://code.visualstudio.com/
2. Install PlatformIO extension from VS Code marketplace
3. Restart VS Code

#### Node.js
1. Download from: https://nodejs.org/ (LTS version)
2. Install with default settings
3. Verify: `node --version` in terminal

---

### 2. Setup Database (5 minutes)

1. Open browser: `http://localhost/phpmyadmin`
2. Click "Import" tab
3. Choose file: `php-backend/database/init.sql`
4. Click "Go"
5. Verify `it414_db_ajjcr` database appears in left sidebar

**Or via Command Line:**
```bash
cd php-backend/database
mysql -u root < init.sql
```

---

### 3. Setup PHP Backend (2 minutes)

1. Copy `php-backend` folder to XAMPP:
```bash
xcopy /E /I php-backend D:\xampp\htdocs\php-backend
```

2. Test in browser: `http://localhost/php-backend/api/get_registered.php`
   - Should see JSON output with 4 RFID cards

---

### 4. Configure ESP32 #1 (RFID Scanner) (5 minutes)

1. Find your computer's IP address:
```bash
ipconfig
# Look for IPv4 Address under your network adapter
# Example: 192.168.1.100
```

2. Open `src/main.cpp` in VS Code

3. Update line ~42:
```cpp
// Replace 192.168.1.100 with YOUR IP address
const char* api_endpoint = "http://192.168.1.100/php-backend/api/check_rfid.php";
```

4. Connect ESP32 #1 via USB

5. Upload firmware:
```bash
pio run -e esp32_rfid -t upload
```

6. Open Serial Monitor:
```bash
pio device monitor -e esp32_rfid
```

7. Verify "WiFi Connected" message appears

---

### 5. Configure ESP32 #2 (Relay Controller) (3 minutes)

1. Wire relay module to ESP32 #2:
   - VCC → 5V
   - GND → GND
   - IN → GPIO 26
   - COM → 3.3V
   - NO → LED (+)
   - LED (-) → GND

2. Connect ESP32 #2 via USB (use different USB port)

3. Upload firmware:
```bash
pio run -e esp32_relay -t upload
```

4. Open Serial Monitor:
```bash
pio device monitor -e esp32_relay
```

5. Verify "Subscribed to topic: RFID_LOGIN" message

---

### 6. Setup Web Dashboard (5 minutes)

1. Open terminal in `qwik-app` folder:
```bash
cd qwik-app
npm install
```

2. Generate SSL certificates:
```bash
npm run generate-certs
```
Note: This step is automatic when you run `npm run dev`

3. Start development server:
```bash
npm run dev
```
Certificates will be auto-generated if not present

4. Open browser: `https://localhost:5174`
Click "Advanced" → "Proceed to localhost" if you see a security warning

5. Verify dashboard loads and shows 4 registered cards

---

### 7. Test System (2 minutes)

1. Open MQTTX and subscribe to `RFID_LOGIN` topic

2. Scan RFID card near ESP32 #1 reader

3. Verify:
   - ✅ ESP32 #1 Serial: "RFID Detected"
   - ✅ MQTTX: Receives "1" or "0"
   - ✅ ESP32 #2 Serial: "MQTT Message Received"
   - ✅ LED turns ON or OFF
   - ✅ Web dashboard shows new log entry

---

## Quick Troubleshooting

### ESP32 won't upload
- Check USB cable (must support data, not just power)
- Try different USB port
- Press and hold BOOT button during upload

### WiFi won't connect
- Verify SSID is "Cloud Control Network"
- Password is "ccv7network"
- Check WiFi is 2.4GHz (ESP32 doesn't support 5GHz)

### PHP API returns error
- Check Apache is running (XAMPP Control Panel)
- Verify MySQL is running
- Clear browser cache

### MQTT not working
- Run: `net start mosquitto`
- Check port 1883 is open: `netstat -an | findstr 1883`

### Relay not switching
- Check wiring (VCC to 5V, not 3.3V)
- Verify GPIO 26 connection
- Try inverting logic in code (HIGH ↔ LOW)

### Web dashboard not updating
- Ensure you're using HTTPS: `https://localhost:5174`
- Update API_BASE_URL in `src/routes/index.tsx`
- Check browser console for errors (F12)
- Verify PHP endpoints work directly

### SSL certificate errors
- Run: `npm run generate-certs`
- Install Git for Windows (includes OpenSSL)
- Or install mkcert: `choco install mkcert`

---

## Default Credentials

| Service   | Username | Password | Port |
|-----------|----------|----------|------|
| MySQL     | root     | (empty)  | 3306 |
| MQTT      | (none)   | (none)   | 1883 |
| Apache    | -        | -        | 80   |

---

## Network Configuration

All devices must be on the same network:
- ESP32 #1 → "Cloud Control Network" WiFi
- ESP32 #2 → "Cloud Control Network" WiFi
- Computer → Same network
- MQTT Broker → Running on computer (localhost)

---

## File Locations

```
Project Root:
├── src/main.cpp              → ESP32 #1 code
├── src/main_relay.cpp        → ESP32 #2 code
├── platformio.ini            → PlatformIO config
├── php-backend/              → PHP API
│   ├── config/database.php   → MySQL connection
│   └── api/*.php             → API endpoints
└── qwik-app/                 → Web dashboard

XAMPP:
D:\xampp\htdocs\php-backend\  → PHP files location
```

---

## Next Steps

1. **Add More RFIDs**: Insert into `rfid_reg` table via phpMyAdmin
2. **Customize WiFi**: Update `wifi_networks` array in ESP32 code
3. **Change GPIO**: Update `RELAY_PIN` in `main_relay.cpp`
4. **Secure System**: Add authentication to APIs and MQTT
5. **Deploy**: Use production server with HTTPS and authentication

---

## Support

- See `TESTING_GUIDE.md` for detailed testing instructions
- See `README.md` for complete documentation
- Check Serial Monitor output for error messages
- Use browser DevTools (F12) to debug web issues

---

**Setup Time: ~30 minutes**

🚀 **You're ready to go!**

