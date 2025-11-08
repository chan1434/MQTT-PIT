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

// RFID Pin Configuration
#define RST_PIN 2    // Reset pin
#define SS_PIN 5     // SDA/SS pin

// WiFi Networks Configuration
const char* wifi_networks[][2] = {
  {"Cloud Control Network", "ccv7network"},
  // Add more networks here if needed
  // {"SSID2", "Password2"},
};
const int num_networks = sizeof(wifi_networks) / sizeof(wifi_networks[0]);

// MQTT Configuration
const int mqtt_port = 1883;
const char* mqtt_topic = "RFID_LOGIN";
const char* mqtt_client_id = "ESP32_RFID_Scanner";

// PHP Backend Configuration
const uint16_t api_port = 81;
const char* api_path = "/php-backend/api/check_rfid.php";

// Initialize objects
MFRC522 mfrc522(SS_PIN, RST_PIN);
WiFiClient espClient;
PubSubClient mqtt_client(espClient);

// Variables
unsigned long lastReconnectAttempt = 0;
bool wifi_connected = false;
IPAddress gateway_ip;
String gateway_host = "";

// Function declarations
void connectToWiFi();
void connectToMQTT();
String readRFID();
void checkRFIDWithServer(String rfid_uid);
void publishMQTT(String message);
String urlEncode(const String& input);
void updateNetworkTargets();

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== ESP32 RFID Scanner Starting ===");
  
  // Initialize SPI bus
  SPI.begin();
  
  // Initialize MFRC522
  mfrc522.PCD_Init();
  delay(100);
  mfrc522.PCD_DumpVersionToSerial();
  Serial.println("RFID Reader initialized!");
  
  // Connect to WiFi
  connectToWiFi();
  
  Serial.println("=== Setup Complete ===");
  Serial.println("Ready to scan RFID cards...\n");
}

void loop() {
  // Maintain WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    wifi_connected = false;
    Serial.println("WiFi disconnected! Reconnecting...");
    connectToWiFi();
  } else {
    wifi_connected = true;
  }
  
  // Maintain MQTT connection
  if (!mqtt_client.connected()) {
    unsigned long now = millis();
    if (now - lastReconnectAttempt > 5000) {
      lastReconnectAttempt = now;
      connectToMQTT();
    }
  } else {
    mqtt_client.loop();
  }
  
  // Check for RFID card
  if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
    String rfid_uid = readRFID();
    
    if (rfid_uid.length() > 0) {
      Serial.println("\n---------------------------------");
      Serial.print("RFID Detected: ");
      Serial.println(rfid_uid);
      
      // Check RFID with server
      checkRFIDWithServer(rfid_uid);
    }
    
    // Halt PICC and stop encryption
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    
    delay(2000); // Prevent multiple reads
  }
  
  delay(100);
}

void connectToWiFi() {
  Serial.println("\n=== Connecting to WiFi ===");
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  
  // Try each configured network
  for (int i = 0; i < num_networks; i++) {
    Serial.print("Attempting: ");
    Serial.println(wifi_networks[i][0]);
    
    WiFi.begin(wifi_networks[i][0], wifi_networks[i][1]);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
      delay(500);
      Serial.print(".");
      attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
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
    } else {
      Serial.println(" Failed!");
    }
  }
  
  Serial.println("Could not connect to any WiFi network!");
  wifi_connected = false;
}

void connectToMQTT() {
  if (!wifi_connected) {
    return;
  }
  
  if (gateway_host.length() == 0) {
    Serial.println("Skipping MQTT connect: gateway IP not available");
    return;
  }

  Serial.print("Connecting to MQTT broker... ");
  
  if (mqtt_client.connect(mqtt_client_id)) {
    Serial.println("Connected!");
  } else {
    Serial.print("Failed, rc=");
    Serial.println(mqtt_client.state());
  }
}

String readRFID() {
  String content = "";
  
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (i > 0) {
      content += ":";
    }

    byte value = mfrc522.uid.uidByte[i];

    if (value < 0x10) {
      content += "0";
    }

    content += String(value, HEX);
  }
  
  content.toUpperCase();
  return content;
}

String urlEncode(const String& input) {
  const char* hex = "0123456789ABCDEF";
  String encoded;
  encoded.reserve(input.length() * 3);

  for (size_t i = 0; i < input.length(); i++) {
    char c = input.charAt(i);

    bool is_unreserved =
      (c >= 'A' && c <= 'Z') ||
      (c >= 'a' && c <= 'z') ||
      (c >= '0' && c <= '9') ||
      c == '-' || c == '_' || c == '.' || c == '~';

    if (is_unreserved) {
      encoded += c;
    } else {
      byte b = static_cast<byte>(c);
      encoded += '%';
      encoded += hex[(b >> 4) & 0x0F];
      encoded += hex[b & 0x0F];
    }
  }

  return encoded;
}

void updateNetworkTargets() {
  IPAddress new_gateway = WiFi.gatewayIP();

  if (new_gateway == IPAddress(0, 0, 0, 0)) {
    Serial.println("Gateway IP unavailable; network targets not updated");
    gateway_host = "";
    return;
  }

  gateway_ip = new_gateway;
  gateway_host = gateway_ip.toString();

  Serial.print("Gateway IP: ");
  Serial.println(gateway_host);

  mqtt_client.setServer(gateway_ip, mqtt_port);
  Serial.print("Configured MQTT target: ");
  Serial.print(gateway_host);
  Serial.print(":");
  Serial.println(mqtt_port);

  Serial.print("Configured API endpoint base: http://");
  Serial.print(gateway_host);
  Serial.print(":");
  Serial.print(api_port);
  Serial.println(api_path);
}

void checkRFIDWithServer(String rfid_uid) {
  if (!wifi_connected) {
    Serial.println("Cannot check RFID: WiFi not connected");
    return;
  }

  if (gateway_host.length() == 0) {
    Serial.println("Cannot check RFID: gateway IP not available");
    return;
  }
  
  HTTPClient http;
  String encoded_rfid = urlEncode(rfid_uid);
  String url = "http://" + gateway_host + ":" + String(api_port) + String(api_path) + "?rfid_data=" + encoded_rfid;
  
  Serial.print("Checking with server: ");
  Serial.println(url);
  
  http.begin(url);
  http.setTimeout(5000);
  
  int httpCode = http.GET();
  
  if (httpCode > 0) {
    Serial.print("HTTP Response Code: ");
    Serial.println(httpCode);
    
    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();
      Serial.print("Response: ");
      Serial.println(payload);
      
      // Parse JSON response
      JsonDocument doc;
      DeserializationError error = deserializeJson(doc, payload);
      
      if (!error) {
        int status = doc["status"];
        bool found = doc["found"];
        const char* message = doc["message"];
        
        Serial.print("Status: ");
        Serial.println(status);
        Serial.print("Found: ");
        Serial.println(found ? "Yes" : "No");
        Serial.print("Message: ");
        Serial.println(message);
        
        // Publish to MQTT
        String mqtt_message = String(status);
        publishMQTT(mqtt_message);
        
      } else {
        Serial.print("JSON Parse Error: ");
        Serial.println(error.c_str());
      }
    }
  } else {
    Serial.print("HTTP Request Failed: ");
    Serial.println(http.errorToString(httpCode));
  }
  
  http.end();
  Serial.println("---------------------------------\n");
}

void publishMQTT(String message) {
  if (mqtt_client.connected()) {
    bool published = mqtt_client.publish(mqtt_topic, message.c_str());
    
    if (published) {
      Serial.print("MQTT Published: ");
      Serial.print(mqtt_topic);
      Serial.print(" -> ");
      Serial.println(message);
    } else {
      Serial.println("MQTT Publish Failed!");
    }
  } else {
    Serial.println("Cannot publish: MQTT not connected");
  }
}
