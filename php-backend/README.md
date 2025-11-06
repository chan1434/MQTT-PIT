# PHP Backend API Documentation

## Overview

This PHP backend provides RESTful API endpoints for the RFID-MQTT IoT system. It handles RFID verification, logging, and data retrieval for the web dashboard.

## Installation

1. Copy this folder to XAMPP's htdocs:
   ```
   D:\xampp\htdocs\php-backend\
   ```

2. Import database: `database/init.sql`

3. Verify configuration in `config/database.php`

## API Endpoints

### 1. Check RFID

**Endpoint**: `/api/check_rfid.php`

**Method**: GET or POST

**Parameters**:
- `rfid_data` (required): RFID card UID

**Example Request**:
```
GET /php-backend/api/check_rfid.php?rfid_data=1A2B3C4D
```

**Response**:
```json
{
  "status": 1,
  "found": true,
  "message": "Access Granted",
  "rfid_data": "1A2B3C4D",
  "timestamp": "2025-11-06 12:34:56"
}
```

**Status Codes**:
- `status: 1` - Access granted (RFID found and active)
- `status: 0` - Access denied (RFID inactive or not found)

**Side Effects**:
- Logs entry to `rfid_logs` table

---

### 2. Get Registered RFIDs

**Endpoint**: `/api/get_registered.php`

**Method**: GET

**Parameters**: None

**Example Request**:
```
GET /php-backend/api/get_registered.php
```

**Response**:
```json
{
  "success": true,
  "count": 4,
  "registered": [
    {
      "id": 1,
      "rfid_data": "1A2B3C4D",
      "rfid_status": true,
      "status_text": "Active",
      "created_at": "2025-11-06 12:00:00",
      "updated_at": "2025-11-06 12:00:00"
    }
  ]
}
```

---

### 3. Get RFID Logs

**Endpoint**: `/api/get_logs.php`

**Method**: GET

**Parameters**:
- `limit` (optional): Number of logs to return (default: 50, max: 500)

**Example Request**:
```
GET /php-backend/api/get_logs.php?limit=100
```

**Response**:
```json
{
  "success": true,
  "count": 10,
  "logs": [
    {
      "id": 10,
      "time_log": "2025-11-06 12:45:00",
      "time_log_formatted": "2025-11-06 12:45:00 PM",
      "date": "2025-11-06",
      "time_12hr": "12:45:00 PM",
      "rfid_data": "1A2B3C4D",
      "rfid_status": true
    }
  ]
}
```

---

## Database Schema

### Table: rfid_reg
Stores registered RFID cards

| Column       | Type         | Description           |
|--------------|--------------|----------------------|
| id           | INT          | Primary key          |
| rfid_data    | VARCHAR(50)  | RFID card UID        |
| rfid_status  | BOOLEAN      | Access permission    |
| created_at   | TIMESTAMP    | Creation time        |
| updated_at   | TIMESTAMP    | Last update          |

### Table: rfid_logs
Stores all RFID scan attempts

| Column       | Type         | Description           |
|--------------|--------------|----------------------|
| id           | INT          | Primary key          |
| time_log     | DATETIME     | Scan timestamp       |
| rfid_data    | VARCHAR(50)  | RFID card UID        |
| rfid_status  | BOOLEAN      | Access result        |

---

## Configuration

### Database Settings

Edit `config/database.php`:

```php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_NAME', 'it414_db_GROUP1');
```

### CORS Settings

CORS is enabled for all origins by default (development only).

For production, restrict origins in `.htaccess` or PHP files:

```php
header('Access-Control-Allow-Origin: https://yourdomain.com');
```

---

## Error Handling

All endpoints return JSON with error information:

```json
{
  "success": false,
  "message": "Database connection failed",
  "data": []
}
```

Common errors:
- Database connection failed
- Invalid parameters
- SQL errors (logged to Apache error log)

---

## Security Notes

⚠️ **Current Setup**: Development only

For production:
1. Add API authentication (JWT tokens)
2. Use prepared statements (already implemented)
3. Enable HTTPS only
4. Rate limiting
5. Input validation
6. Restrict CORS origins
7. Use strong database passwords

---

## Testing

### Via Browser:
```
http://localhost/php-backend/api/get_registered.php
http://localhost/php-backend/api/get_logs.php
http://localhost/php-backend/api/check_rfid.php?rfid_data=1A2B3C4D
```

### Via cURL:
```bash
curl "http://localhost/php-backend/api/check_rfid.php?rfid_data=1A2B3C4D"
```

### Via ESP32:
See `src/main.cpp` for implementation example

---

## Troubleshooting

**404 Not Found**:
- Verify folder is in `D:\xampp\htdocs\`
- Check Apache is running
- Verify .htaccess is present

**Database Connection Error**:
- Start MySQL in XAMPP
- Check credentials in `config/database.php`
- Verify database exists: `SHOW DATABASES;`

**Empty Response**:
- Check PHP error log: `D:\xampp\apache\logs\error.log`
- Enable error reporting in php.ini
- Check database has data

**CORS Errors**:
- Verify .htaccess has CORS headers
- Check browser console for specific error
- Test with CORS disabled extension (dev only)

---

## Maintenance

### Add New RFID Card:
```sql
INSERT INTO rfid_reg (rfid_data, rfid_status) 
VALUES ('NEW_RFID_UID', 1);
```

### View Recent Logs:
```sql
SELECT * FROM rfid_logs 
ORDER BY time_log DESC 
LIMIT 10;
```

### Clear Old Logs:
```sql
DELETE FROM rfid_logs 
WHERE time_log < DATE_SUB(NOW(), INTERVAL 30 DAY);
```

### Update Card Status:
```sql
UPDATE rfid_reg 
SET rfid_status = 0 
WHERE rfid_data = '1A2B3C4D';
```

---

## Version History

- v1.0 (2025-11-06): Initial release
  - RFID verification endpoint
  - Logs retrieval endpoint
  - Registered RFIDs endpoint
  - MySQL database integration
  - CORS support

---

## License

Educational use - IT414 Project

