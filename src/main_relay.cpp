/*
 * ESP32 #2 - Relay Controller with MQTT Subscriber
 * Hardware: ESP32 + Single Channel Relay + LED
 * 
 * Wiring:
 * Relay Module    ESP32
 * VCC         --> 5V
 * GND         --> GND
 * IN          --> GPIO 26
 * 
 * Relay to LED:
 * COM         --> 3.3V (ESP32)
 * NO          --> LED (+) longer leg
 * LED (-)     --> GND (shorter leg)
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

// Relay Pin Configuration
#define RELAY_PIN 26

// WiFi Networks Configuration
const char* wifi_networks[][2] = {
  {"Cloud Control Network", "ccv7network"},
  // Add more networks here if needed
  // {"SSID2", "Password2"},
};
const int num_networks = sizeof(wifi_networks) / sizeof(wifi_networks[0]);

// MQTT Configuration
const char* mqtt_server = "127.0.0.1";  // localhost
const int mqtt_port = 1883;
const char* mqtt_topic = "RFID_LOGIN";
const char* mqtt_client_id = "ESP32_Relay_Controller";

// Initialize objects
WiFiClient espClient;
PubSubClient mqtt_client(espClient);

// Variables
unsigned long lastReconnectAttempt = 0;
bool wifi_connected = false;

// Function declarations
void connectToWiFi();
void connectToMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== ESP32 Relay Controller Starting ===");
  
  // Initialize relay pin
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW); // Start with relay OFF
  Serial.println("Relay pin initialized (GPIO 26)");
  
  // Connect to WiFi
  connectToWiFi();
  
  // Setup MQTT
  mqtt_client.setServer(mqtt_server, mqtt_port);
  mqtt_client.setCallback(mqttCallback);
  
  Serial.println("=== Setup Complete ===");
  Serial.println("Listening for MQTT messages...\n");
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
  
  Serial.print("Connecting to MQTT broker... ");
  
  if (mqtt_client.connect(mqtt_client_id)) {
    Serial.println("Connected!");
    
    // Subscribe to RFID_LOGIN topic
    bool subscribed = mqtt_client.subscribe(mqtt_topic);
    if (subscribed) {
      Serial.print("Subscribed to topic: ");
      Serial.println(mqtt_topic);
    } else {
      Serial.println("Subscription failed!");
    }
  } else {
    Serial.print("Failed, rc=");
    Serial.println(mqtt_client.state());
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.println("\n---------------------------------");
  Serial.print("MQTT Message Received on topic: ");
  Serial.println(topic);
  
  // Convert payload to string
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  Serial.print("Message: ");
  Serial.println(message);
  
  // Control relay based on message
  if (message == "1") {
    digitalWrite(RELAY_PIN, HIGH);
    Serial.println("Action: Relay ON - LED ON");
  } else if (message == "0") {
    digitalWrite(RELAY_PIN, LOW);
    Serial.println("Action: Relay OFF - LED OFF");
  } else {
    Serial.print("Unknown command: ");
    Serial.println(message);
  }
  
  Serial.println("---------------------------------\n");
}

