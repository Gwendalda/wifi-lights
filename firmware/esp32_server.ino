#include <stdio.h>
#include <WiFi.h>
#include <WebServer.h>
#include <WiFiClient.h>

// Static IP configuration
IPAddress local_IP(10, 0, 0, 40);
IPAddress gateway(10, 0, 0, 1);
IPAddress subnet(255, 255, 255, 0);

// Create a web server on port 80
WebServer server(80);
WiFiClient client;

const char* serverHost = "10.0.0.40";  // WiFi-Lights server IP address
const int serverPort = 5001;            // Port for WiFi-Lights server

int previousPinStates[10]; // Assuming pin numbers from 0-9 for monitoring state changes

void reconnectWiFi() {
  Serial.println("WiFi connection lost. Attempting to reconnect...");
  WiFi.disconnect();
  WiFi.begin("SuperWifi", "cacaboudin");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print('.');
    delay(1000);
  }
  Serial.println("Reconnected to WiFi: ");
  Serial.println(WiFi.localIP());
}

void handleRoot() {
  server.send(200, "text/plain", "ESP32 is online");
}

void handleSetPin() {
  if (server.hasArg("pin") && server.hasArg("value")) {
    int pin = server.arg("pin").toInt();
    int value = server.arg("value").toInt();
    pinMode(pin, OUTPUT);
    digitalWrite(pin, value);
    server.send(200, "text/plain", "Pin value updated");
  } else {
    server.send(400, "text/plain", "Missing pin or value argument");
  }
}

void handleReadPin() {
  if (server.hasArg("pin")) {
    int pin = server.arg("pin").toInt();
    pinMode(pin, INPUT);
    int value = digitalRead(pin);
    server.send(200, "application/json", String("{\"pin\": " + String(pin) + ", \"value\": " + String(value) + "}"));
  } else {
    server.send(400, "text/plain", "Missing pin argument");
  }
}

void notifyStateChange(int pin, int value) {
  if (client.connect(serverHost, serverPort)) {
    String data = String("Pin: ") + pin + String(", State: ") + value + "\n";
    client.print(data);
    client.stop();
  } else {
    Serial.println("Connection to WiFi-Lights server failed");
  }
}

void setup() {
  Serial.begin(115200);
  Serial.printf("initiating connection to wifi network !");
  
  if (!WiFi.config(local_IP, gateway, subnet)) {
    Serial.println("Failed to configure Static IP");
  }
  
  WiFi.mode(WIFI_STA);
  WiFi.begin("SuperWifi", "cacaboudin");
  Serial.printf("Connecting to WiFi ..");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print('.');
    delay(1000);
  }
  Serial.println(WiFi.localIP());

  // Initialize previous pin states
  for (int i = 0; i < 10; i++) {
    pinMode(i, INPUT);
    previousPinStates[i] = digitalRead(i);
  }

  // Start the web server
  server.on("/", handleRoot);
  server.on("/setPin", handleSetPin);
  server.on("/readPin", handleReadPin);
  server.begin();
  Serial.println("HTTP server started");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    reconnectWiFi();
  }
  server.handleClient();

  // Check for pin state changes
  for (int i = 0; i < 10; i++) {
    int currentState = digitalRead(i);
    if (currentState != previousPinStates[i]) {
      notifyStateChange(i, currentState);
      previousPinStates[i] = currentState;
    }
  }

  delay(1000);
  Serial.print(WiFi.status());
}
