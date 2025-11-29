/*
 * ESP32 #1 - RFID Scanner with MQTT Publisher
 * Hardware: ESP32 + MFRC522 RFID Reader
 * 
 * Wiring:
 * MFRC522    ESP32
 * SDA    --> GPIO 5 (D5)
 * SCK    --> GPIO 18 (D18)
 * MOSI   --> GPIO 23 (D23)
 * MISO   --> GPIO 19 (D19)
 * IRQ    --> Not connected
 * GND    --> GND
 * RST    --> GPIO 2 (D2)
 * 3.3V   --> 3.3V
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <cstring>
#include <esp_system.h>
#include <esp_wifi.h>

// RFID Pin Configuration
#define RST_PIN 2 // Reset pin
#define SS_PIN 5  // SDA/SS pin

// WiFi Networks Configuration
const char *wifi_networks[][2] = {
  {"Cloud Control Network", "ccv7network"},
  // Add more networks here if needed
  // {"SSID2", "Password2"},
};
const int num_networks = sizeof(wifi_networks) / sizeof(wifi_networks[0]);

// MQTT Configuration
// Set this to your MQTT broker IP address (where Mosquitto is running)
// Use your PC's IP: 192.168.43.17
const char *mqtt_broker_ip = "192.168.43.17"; // Change this to your MQTT broker IP
const int mqtt_port = 1883;
const char *mqtt_topic = "RFID_LOGIN";
const char *mqtt_client_id = "ESP32_RFID_Scanner";

// PHP Backend Configuration
// Set this to your PC's IP address (where Apache/PHP backend is running)
const char *api_server_ip = "192.168.43.17"; // Change this to your PC's IP
const uint16_t api_port = 81;
const char *api_path = "/php-backend/api/check_rfid.php";

// Runtime tuning constants
constexpr size_t RFID_UID_BUFFER_LEN = 32;
constexpr size_t ENCODED_UID_BUFFER_LEN = RFID_UID_BUFFER_LEN * 3;
constexpr size_t URL_BUFFER_LEN = 256;
constexpr unsigned long SCAN_COOLDOWN_MS = 1500;
constexpr unsigned long LOOP_IDLE_DELAY_MS = 5;
constexpr unsigned long TELEMETRY_INTERVAL_MS = 60000;
constexpr unsigned long MQTT_BACKOFF_MIN_MS = 1000;
constexpr unsigned long MQTT_BACKOFF_MAX_MS = 10000;

// Initialize objects
MFRC522 mfrc522(SS_PIN, RST_PIN);
WiFiClient espClient;
WiFiClient httpClient;
PubSubClient mqtt_client(espClient);

// Variables
unsigned long lastReconnectAttempt = 0;
unsigned long mqttBackoffDelay = MQTT_BACKOFF_MIN_MS;
unsigned long nextScanAllowed = 0;
unsigned long lastTelemetryReport = 0;
bool wifi_connected = false;
IPAddress gateway_ip;
IPAddress mqtt_broker;
IPAddress api_server;
char gateway_host[16] = {0};
bool gateway_ready = false;
bool mqtt_broker_ready = false;
bool api_server_ready = false;

// Function declarations
void connectToWiFi();
void connectToMQTT();
bool readRFID(char *buffer, size_t bufferLen);
void checkRFIDWithServer(const char *rfid_uid);
void publishMQTT(const char *message);
bool urlEncode(const char *input, char *output, size_t outputLen);
void updateNetworkTargets();
void reportRuntimeStats(unsigned long now);

void setup()
{
  Serial.begin(115200);
  Serial.println("\n\n=== ESP32 RFID Scanner Starting ===");
  
  // Initialize SPI bus with optimized settings
  SPI.begin();
  SPI.setFrequency(10000000); // 10MHz for MFRC522 (optimal)
  SPI.setDataMode(SPI_MODE0);
  
  // Initialize MFRC522
  mfrc522.PCD_Init();
  delay(100);
  mfrc522.PCD_DumpVersionToSerial();
  Serial.println("RFID Reader initialized!");
  
  // Connect to WiFi
  connectToWiFi();
  
  // Configure WiFi power management for balanced performance
  WiFi.setSleep(WIFI_PS_MIN_MODEM); // Balanced: saves power but maintains responsiveness
  esp_wifi_set_ps(WIFI_PS_MIN_MODEM);
  Serial.println("WiFi power management: Balanced mode");
  
  Serial.println("=== Setup Complete ===");
  Serial.println("Ready to scan RFID cards...\n");
}

void loop()
{
  const unsigned long now = millis();

  // Maintain WiFi connection
  if (WiFi.status() != WL_CONNECTED)
  {
    if (wifi_connected)
    {
      Serial.println("WiFi disconnected! Reconnecting...");
    }
    wifi_connected = false;
    connectToWiFi();
  }
  else
  {
    wifi_connected = true;
  }

  // Maintain MQTT connection with exponential backoff
  if (mqtt_client.connected())
  {
    mqtt_client.loop();
    mqttBackoffDelay = MQTT_BACKOFF_MIN_MS;
  }
  else if (wifi_connected)
  {
    if (now - lastReconnectAttempt >= mqttBackoffDelay)
    {
      lastReconnectAttempt = now;
      connectToMQTT();
      unsigned long nextDelay = mqttBackoffDelay * 2;
      mqttBackoffDelay = nextDelay > MQTT_BACKOFF_MAX_MS ? MQTT_BACKOFF_MAX_MS : nextDelay;
    }
  }

  // Check for RFID card without blocking delays
  if (now >= nextScanAllowed && mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial())
  {
    char rfid_uid[RFID_UID_BUFFER_LEN] = {0};
    
    if (readRFID(rfid_uid, sizeof(rfid_uid)))
    {
      Serial.println("\n---------------------------------");
      Serial.print("RFID Detected: ");
      Serial.println(rfid_uid);
      checkRFIDWithServer(rfid_uid);
    }
    else
    {
      Serial.println("RFID buffer insufficient; skipping read");
    }
    
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    nextScanAllowed = now + SCAN_COOLDOWN_MS;
  }

  reportRuntimeStats(now);
  delay(LOOP_IDLE_DELAY_MS);
}

void connectToWiFi()
{
  Serial.println("\n=== Connecting to WiFi ===");
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  gateway_ready = false;
  gateway_host[0] = '\0';
  
  // Try each configured network
  for (int i = 0; i < num_networks; i++)
  {
    Serial.print("Attempting: ");
    Serial.println(wifi_networks[i][0]);
    
    WiFi.begin(wifi_networks[i][0], wifi_networks[i][1]);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20)
    {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED)
    {
      Serial.println("\nWiFi Connected!");
      Serial.print("SSID: ");
      Serial.println(WiFi.SSID());
      Serial.print("IP Address: ");
      Serial.println(WiFi.localIP());
      Serial.print("Signal Strength: ");
      Serial.print(WiFi.RSSI());
      Serial.println(" dBm");
      wifi_connected = true;
      updateNetworkTargets();
      return;
    }
    else
    {
      Serial.println(" Failed!");
    }
  }
  
  Serial.println("Could not connect to any WiFi network!");
  wifi_connected = false;
}

void connectToMQTT()
{
  if (!wifi_connected)
  {
    return;
  }

  if (!mqtt_broker_ready)
  {
    Serial.println("Skipping MQTT connect: MQTT broker IP not configured");
    return;
  }

  Serial.print("Connecting to MQTT broker... ");
  Serial.print(mqtt_broker_ip);
  Serial.print(":");
  Serial.print(mqtt_port);
  Serial.print(" ... ");

  if (mqtt_client.connect(mqtt_client_id))
  {
    Serial.println("Connected!");
    mqttBackoffDelay = MQTT_BACKOFF_MIN_MS;
  }
  else
  {
    Serial.print("Failed, rc=");
    Serial.println(mqtt_client.state());
  }
}

bool readRFID(char *buffer, size_t bufferLen)
{
  if (bufferLen == 0)
  {
    return false;
  }

  size_t offset = 0;

  for (byte i = 0; i < mfrc522.uid.size; i++)
  {
    if (i > 0)
    {
      if (offset + 1 >= bufferLen)
      {
        buffer[offset] = '\0';
        return false;
      }
      buffer[offset++] = ':';
    }

    if (offset + 2 >= bufferLen)
    {
      buffer[offset] = '\0';
      return false;
    }

    byte value = mfrc522.uid.uidByte[i];
    snprintf(&buffer[offset], bufferLen - offset, "%02X", value);
    offset += 2;
  }

  buffer[offset] = '\0';
  return true;
}

bool urlEncode(const char *input, char *output, size_t outputLen)
{
  if (!input || !output || outputLen == 0)
  {
    return false;
  }

  const char *hex = "0123456789ABCDEF";
  size_t outIndex = 0;

  for (size_t i = 0; input[i] != '\0'; i++)
  {
    const char c = input[i];
    const bool is_unreserved =
      (c >= 'A' && c <= 'Z') ||
      (c >= 'a' && c <= 'z') ||
      (c >= '0' && c <= '9') ||
      c == '-' || c == '_' || c == '.' || c == '~';

    if (is_unreserved)
    {
      if (outIndex + 1 >= outputLen)
      {
        return false;
      }
      output[outIndex++] = c;
    }
    else
    {
      if (outIndex + 3 >= outputLen)
      {
        return false;
      }
      uint8_t byteVal = static_cast<uint8_t>(c);
      output[outIndex++] = '%';
      output[outIndex++] = hex[(byteVal >> 4) & 0x0F];
      output[outIndex++] = hex[byteVal & 0x0F];
    }
  }

  if (outIndex >= outputLen)
  {
    return false;
  }

  output[outIndex] = '\0';
  return true;
}

void updateNetworkTargets()
{
  IPAddress new_gateway = WiFi.gatewayIP();

  if (new_gateway == IPAddress(0, 0, 0, 0))
  {
    Serial.println("Gateway IP unavailable; network targets not updated");
    gateway_ready = false;
    gateway_host[0] = '\0';
    return;
  }

  gateway_ip = new_gateway;
  snprintf(
    gateway_host,
    sizeof(gateway_host),
    "%u.%u.%u.%u",
    gateway_ip[0],
    gateway_ip[1],
    gateway_ip[2],
      gateway_ip[3]);
  gateway_ready = true;

  Serial.print("Gateway IP: ");
  Serial.println(gateway_host);

  // Parse MQTT broker IP from string
  if (mqtt_broker.fromString(mqtt_broker_ip))
  {
    mqtt_broker_ready = true;
    mqtt_client.setServer(mqtt_broker, mqtt_port);
    Serial.print("Configured MQTT broker: ");
    Serial.print(mqtt_broker_ip);
  Serial.print(":");
  Serial.println(mqtt_port);
  }
  else
  {
    mqtt_broker_ready = false;
    Serial.print("ERROR: Failed to parse MQTT broker IP: ");
    Serial.println(mqtt_broker_ip);
  }

  // Parse API server IP from string
  if (api_server.fromString(api_server_ip))
  {
    api_server_ready = true;
    Serial.print("Configured API server: ");
    Serial.print(api_server_ip);
  Serial.print(":");
  Serial.print(api_port);
  Serial.println(api_path);
}
  else
  {
    api_server_ready = false;
    Serial.print("ERROR: Failed to parse API server IP: ");
    Serial.println(api_server_ip);
  }
}

void reportRuntimeStats(unsigned long now)
{
  if (now - lastTelemetryReport < TELEMETRY_INTERVAL_MS)
  {
    return;
  }

  lastTelemetryReport = now;

  Serial.println("\n--- Runtime Telemetry ---");
  Serial.print("Free Heap: ");
  Serial.print(ESP.getFreeHeap());
  Serial.println(" bytes");

  Serial.print("WiFi RSSI: ");
  if (wifi_connected)
  {
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  }
  else
  {
    Serial.println("N/A");
  }

  Serial.print("MQTT Connected: ");
  Serial.println(mqtt_client.connected() ? "Yes" : "No");
  Serial.println("-------------------------");
}

void checkRFIDWithServer(const char *rfid_uid)
{
  if (!wifi_connected)
  {
    Serial.println("Cannot check RFID: WiFi not connected");
    return;
  }

  if (!api_server_ready)
  {
    Serial.println("Cannot check RFID: API server IP not configured");
    return;
  }
  
  HTTPClient http;
  http.setTimeout(2000);
  http.setConnectTimeout(2000);
  http.setReuse(true); // Connection pooling

  char encoded_rfid[ENCODED_UID_BUFFER_LEN] = {0};
  if (!urlEncode(rfid_uid, encoded_rfid, sizeof(encoded_rfid)))
  {
    Serial.println("Failed to encode RFID UID; request skipped");
    return;
  }

  char url[URL_BUFFER_LEN] = {0};
  char api_host[16] = {0};
  snprintf(
      api_host,
      sizeof(api_host),
      "%u.%u.%u.%u",
      api_server[0],
      api_server[1],
      api_server[2],
      api_server[3]);
  
  int written = snprintf(
    url,
    sizeof(url),
    "http://%s:%u%s?rfid_data=%s",
      api_host,
    api_port,
    api_path,
      encoded_rfid);

  if (written <= 0 || static_cast<size_t>(written) >= sizeof(url))
  {
    Serial.println("URL buffer overflow; request skipped");
    return;
  }
  
  Serial.print("Checking with server: ");
  Serial.println(url);
  
  if (!http.begin(httpClient, url))
  {
    Serial.println("HTTP begin failed");
    return;
  }
  
  int httpCode = http.GET();
  
  if (httpCode > 0)
  {
    Serial.print("HTTP Response Code: ");
    Serial.println(httpCode);
    
    if (httpCode == HTTP_CODE_OK)
    {
      // Use char buffer instead of String to prevent heap fragmentation
      char response_buffer[512] = {0};
      int len = http.getSize();
      
      if (len > 0 && len < static_cast<int>(sizeof(response_buffer)))
      {
        int bytesRead = http.getStream().readBytes(response_buffer, len);
        response_buffer[bytesRead] = '\0';
        
        Serial.print("Response: ");
        Serial.println(response_buffer);
        
        // Use StaticJsonDocument for pre-allocated memory
        // Note: StaticJsonDocument is deprecated in ArduinoJson v7, but JsonDocument
        // is not a template in v7.4.2, so we suppress the warning
        #pragma GCC diagnostic push
        #pragma GCC diagnostic ignored "-Wdeprecated-declarations"
        StaticJsonDocument<256> doc;
        #pragma GCC diagnostic pop
        DeserializationError error = deserializeJson(doc, response_buffer);
        
        if (!error)
        {
          int status = doc["status"];
          bool found = doc["found"];
          const char *message = doc["message"];
          
          Serial.print("Status: ");
          Serial.println(status);
          Serial.print("Found: ");
          Serial.println(found ? "Yes" : "No");
          Serial.print("Message: ");
          Serial.println(message);
          
          char mqtt_message[8] = {0};
          snprintf(mqtt_message, sizeof(mqtt_message), "%d", status);
          publishMQTT(mqtt_message);
        }
        else
        {
          Serial.print("JSON Parse Error: ");
          Serial.println(error.c_str());
        }
      }
      else
      {
        Serial.println("Response too large or invalid size");
      }
    }
  }
  else
  {
    Serial.print("HTTP Request Failed: ");
    Serial.println(http.errorToString(httpCode));
  }
  
  http.end();
  Serial.println("---------------------------------\n");
}

void publishMQTT(const char *message)
{
  if (mqtt_client.connected())
  {
    // Enable message retention so new clients get last state immediately
    bool published = mqtt_client.publish(mqtt_topic, message, true);
    
    if (published)
    {
      Serial.print("MQTT Published (retained): ");
      Serial.print(mqtt_topic);
      Serial.print(" -> ");
      Serial.println(message);
    }
    else
    {
      Serial.println("MQTT Publish Failed!");
    }
  }
  else
  {
    Serial.println("Cannot publish: MQTT not connected");
  }
}
