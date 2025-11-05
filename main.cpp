#include <Arduino.h>
#include <WiFi.h>
#include <WiFiMulti.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <MFRC522.h>

// WiFi Configuration
WiFiMulti wifiMulti;
const char* WIFI_SSID = "Cloud Control Network";
const char* WIFI_PASSWORD = "ccv7network";

// MQTT Configuration
const char* MQTT_BROKER = "YOUR_MQTT_BROKER_IP";
const int MQTT_PORT = 1883;
const char* MQTT_TOPIC = "RFID_LOGIN";
const char* MQTT_CLIENT_ID = "ESP32_RFID_Scanner";

// PHP Endpoint Configuration
const char* PHP_ENDPOINT = "https://YOUR_SERVER_IP/rfid_handler.php";

// MFRC522 Pin Configuration
#define RST_PIN 2
#define SS_PIN 5

// RFID Scanner
MFRC522 mfrc522(SS_PIN, RST_PIN);

// WiFi and MQTT Clients
WiFiClientSecure wifiClientSecure;
HTTPClient http;
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);

// State variables
unsigned long lastCardRead = 0;
const unsigned long CARD_READ_INTERVAL = 2000;
String lastCardUID = "";

// Function prototypes
void connectWiFi();
void connectMQTT();
void publishMQTT(const char* message);
void sendToPHP(const String& rfidData);
String getCardUID();

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Initialize SPI
  SPI.begin();
  
  // Initialize MFRC522
  mfrc522.PCD_Init();
  delay(100);
  
  Serial.println("RFID Scanner Initialized");
  Serial.print("MFRC522 Version: ");
  mfrc522.PCD_DumpVersionToSerial();
  
  // Configure WiFi
  wifiMulti.addAP(WIFI_SSID, WIFI_PASSWORD);
  
  // For HTTPS
  wifiClientSecure.setInsecure();
  
  // Connect WiFi
  connectWiFi();
  
  // Connect MQTT
  connectMQTT();
  
  Serial.println("System Ready");
}

void loop() {
  // Maintain WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }
  
  // Maintain MQTT connection
  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop();
  
  // Check for RFID card
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }
  
  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }
  
  // Debounce: prevent reading same card multiple times
  unsigned long currentTime = millis();
  if (currentTime - lastCardRead < CARD_READ_INTERVAL) {
    return;
  }
  
  String cardUID = getCardUID();
  
  // Skip if same card
  if (cardUID == lastCardUID) {
    return;
  }
  
  lastCardUID = cardUID;
  lastCardRead = currentTime;
  
  Serial.print("Card detected: ");
  Serial.println(cardUID);
  
  // Send to PHP endpoint
  sendToPHP(cardUID);
  
  // Halt PICC
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();
}

void connectWiFi() {
  Serial.println("Connecting to WiFi...");
  
  int attempts = 0;
  wl_status_t status = WL_DISCONNECTED;
  
  while (status != WL_CONNECTED && attempts < 20) {
    status = wifiMulti.run();
    
    switch (status) {
      case WL_CONNECTED:
        Serial.println("WiFi Connected!");
        Serial.print("IP Address: ");
        Serial.println(WiFi.localIP());
        break;
      case WL_CONNECT_FAILED:
        Serial.println("WiFi Connection Failed");
        break;
      case WL_CONNECTION_LOST:
        Serial.println("WiFi Connection Lost");
        break;
      case WL_DISCONNECTED:
        Serial.println("WiFi Disconnected");
        break;
      case WL_NO_SSID_AVAIL:
        Serial.println("WiFi SSID Not Available");
        break;
      default:
        Serial.print("WiFi Status: ");
        Serial.println(status);
        break;
    }
    
    if (status != WL_CONNECTED) {
      delay(1000);
      attempts++;
    }
  }
  
  if (status != WL_CONNECTED) {
    Serial.println("Failed to connect to WiFi after 20 attempts");
  }
}

void connectMQTT() {
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT broker...");
    
    if (mqttClient.connect(MQTT_CLIENT_ID)) {
      Serial.println("MQTT Connected!");
    } else {
      Serial.print("MQTT Connection Failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" Retrying in 5 seconds...");
      delay(5000);
    }
  }
}

void publishMQTT(const char* message) {
  if (mqttClient.connected()) {
    if (mqttClient.publish(MQTT_TOPIC, message)) {
      Serial.print("MQTT Published: ");
      Serial.println(message);
    } else {
      Serial.println("MQTT Publish Failed");
    }
  } else {
    Serial.println("MQTT Not Connected");
    connectMQTT();
  }
}

void sendToPHP(const String& rfidData) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi Not Connected");
    return;
  }
  
  http.begin(wifiClientSecure, PHP_ENDPOINT);
  http.addHeader("Content-Type", "application/x-www-form-urlencoded");
  
  String postData = "rfid_data=" + rfidData;
  
  int httpResponseCode = http.POST(postData);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("PHP Response Code: ");
    Serial.println(httpResponseCode);
    Serial.print("PHP Response: ");
    Serial.println(response);
    
    // Parse JSON response
    int statusIndex = response.indexOf("\"status\":");
    if (statusIndex != -1) {
      int statusValue = response.substring(statusIndex + 9, statusIndex + 10).toInt();
      
      // Publish to MQTT
      if (statusValue == 1) {
        publishMQTT("1");
      } else {
        publishMQTT("0");
      }
    } else {
      // If RFID not found, publish "0"
      publishMQTT("0");
    }
  } else {
    Serial.print("HTTP Error: ");
    Serial.println(httpResponseCode);
    publishMQTT("0");
  }
  
  http.end();
}

String getCardUID() {
  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) {
      uid += "0";
    }
    uid += String(mfrc522.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

