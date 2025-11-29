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
 * Relay to Bulb/LED:
 * COM         --> Power source (3.3V from ESP32, or try 5V)
 * NO          --> Bulb/LED (+) positive terminal (longer leg for LED)
 * Bulb/LED (-)--> GND (shorter leg for LED)
 * 
 * TROUBLESHOOTING:
 * - If relay LED lights but bulb doesn't:
 *   1. Check if bulb needs more voltage (try 5V instead of 3.3V)
 *   2. Verify COM->NO connection when relay activates (use multimeter)
 *   3. Check if using correct terminal (NO = Normally Open, NC = Normally Closed)
 *   4. Try inverting relay logic in code (some modules are active LOW)
 */

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <esp_system.h>
#include <esp_wifi.h>

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
// Set this to your MQTT broker IP address (where Mosquitto is running)
// Use your PC's IP: 192.168.43.17
const char* mqtt_broker_ip = "192.168.43.17";  // Change this to your MQTT broker IP
const int mqtt_port = 1883;
const char* mqtt_topic = "RFID_LOGIN";
const char* mqtt_client_id = "ESP32_Relay_Controller";

// Runtime tuning constants
constexpr unsigned long LOOP_IDLE_DELAY_MS = 5;
constexpr unsigned long TELEMETRY_INTERVAL_MS = 60000;
constexpr unsigned long MQTT_BACKOFF_MIN_MS = 1000;
constexpr unsigned long MQTT_BACKOFF_MAX_MS = 10000;

// Initialize objects
WiFiClient espClient;
PubSubClient mqtt_client(espClient);

// Variables
unsigned long lastReconnectAttempt = 0;
unsigned long mqttBackoffDelay = MQTT_BACKOFF_MIN_MS;
unsigned long lastTelemetryReport = 0;
bool wifi_connected = false;
IPAddress gateway_ip;
IPAddress mqtt_broker;
char gateway_host[16] = {0};
bool gateway_ready = false;
bool mqtt_broker_ready = false;

// Function declarations
void connectToWiFi();
void connectToMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void updateNetworkTargets();
void reportRuntimeStats(unsigned long now);

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== ESP32 Relay Controller Starting ===");
  
  // Initialize relay pin
  pinMode(RELAY_PIN, OUTPUT);
  // Start with relay OFF
  // ACTIVE HIGH: LOW = OFF (default)
  // ACTIVE LOW: HIGH = OFF
  digitalWrite(RELAY_PIN, LOW); // Start OFF (Active HIGH mode - change to HIGH for Active LOW)
  Serial.println("Relay pin initialized (GPIO 26) - Active HIGH mode");
  
  // Connect to WiFi
  connectToWiFi();
  
  // Configure WiFi power management for balanced performance
  WiFi.setSleep(WIFI_PS_MIN_MODEM);  // Balanced: saves power but maintains responsiveness
  esp_wifi_set_ps(WIFI_PS_MIN_MODEM);
  Serial.println("WiFi power management: Balanced mode");
  
  // Setup MQTT
  mqtt_client.setCallback(mqttCallback);
  
  Serial.println("=== Setup Complete ===");
  Serial.println("Listening for MQTT messages...\n");
}

void loop() {
  const unsigned long now = millis();

  // Maintain WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    if (wifi_connected) {
      Serial.println("WiFi disconnected! Reconnecting...");
    }
    wifi_connected = false;
    connectToWiFi();
  } else {
    wifi_connected = true;
  }
  
  // Maintain MQTT connection with exponential backoff
  if (mqtt_client.connected()) {
    mqtt_client.loop();
    mqttBackoffDelay = MQTT_BACKOFF_MIN_MS;
  } else if (wifi_connected) {
    if (now - lastReconnectAttempt >= mqttBackoffDelay) {
      lastReconnectAttempt = now;
      connectToMQTT();
      unsigned long nextDelay = mqttBackoffDelay * 2;
      mqttBackoffDelay = nextDelay > MQTT_BACKOFF_MAX_MS ? MQTT_BACKOFF_MAX_MS : nextDelay;
    }
  }

  reportRuntimeStats(now);
  delay(LOOP_IDLE_DELAY_MS);
}

void connectToWiFi() {
  Serial.println("\n=== Connecting to WiFi ===");
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  gateway_ready = false;
  gateway_host[0] = '\0';
  
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

  if (!mqtt_broker_ready) {
    Serial.println("Skipping MQTT connect: MQTT broker IP not configured");
    return;
  }

  Serial.print("Connecting to MQTT broker... ");
  Serial.print(mqtt_broker_ip);
  Serial.print(":");
  Serial.print(mqtt_port);
  Serial.print(" ... ");
  
  if (mqtt_client.connect(mqtt_client_id)) {
    Serial.println("Connected!");
    mqttBackoffDelay = MQTT_BACKOFF_MIN_MS;
    
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

void updateNetworkTargets() {
  IPAddress new_gateway = WiFi.gatewayIP();

  if (new_gateway == IPAddress(0, 0, 0, 0)) {
    Serial.println("Gateway IP unavailable; MQTT target not updated");
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
    gateway_ip[3]
  );
  gateway_ready = true;

  Serial.print("Gateway IP: ");
  Serial.println(gateway_host);

  // Parse MQTT broker IP from string
  if (mqtt_broker.fromString(mqtt_broker_ip)) {
    mqtt_broker_ready = true;
    mqtt_client.setServer(mqtt_broker, mqtt_port);
    Serial.print("Configured MQTT broker: ");
    Serial.print(mqtt_broker_ip);
    Serial.print(":");
    Serial.println(mqtt_port);
  } else {
    mqtt_broker_ready = false;
    Serial.print("ERROR: Failed to parse MQTT broker IP: ");
    Serial.println(mqtt_broker_ip);
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
  // Behavior:
  // - Default/Low: Relay pin = LOW (OFF)
  // - Message "0": Relay pin = LOW (OFF) - stays LOW
  // - Message "1": Relay pin = HIGH (ON) - stays HIGH until next "0"
  
  if (message == "1") {
    digitalWrite(RELAY_PIN, HIGH);
    Serial.println("Action: Relay ON - Set to HIGH");
    Serial.println("Relay Pin State: HIGH");
  } else if (message == "0") {
    digitalWrite(RELAY_PIN, LOW);
    Serial.println("Action: Relay OFF - Set to LOW");
    Serial.println("Relay Pin State: LOW");
  } else {
    Serial.print("Unknown command: ");
    Serial.println(message);
    Serial.println("Relay maintains current state");
  }
  
  Serial.println("---------------------------------\n");
}

void reportRuntimeStats(unsigned long now) {
  if (now - lastTelemetryReport < TELEMETRY_INTERVAL_MS) {
    return;
  }

  lastTelemetryReport = now;

  Serial.println("\n--- Relay Runtime Telemetry ---");
  Serial.print("Free Heap: ");
  Serial.print(ESP.getFreeHeap());
  Serial.println(" bytes");

  Serial.print("WiFi RSSI: ");
  if (wifi_connected) {
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("N/A");
  }

  Serial.print("MQTT Connected: ");
  Serial.println(mqtt_client.connected() ? "Yes" : "No");
  Serial.println("--------------------------------");
}
