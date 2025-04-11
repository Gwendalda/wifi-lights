#include <stdio.h>
#include <WiFi.h>
#include <WebServer.h>
#include <WiFiClient.h>
#include <stdio.h>
#include "driver/gpio.h"
#include "esp_timer.h"

// Static IP configuration
IPAddress local_IP(10, 0, 0, 40);
IPAddress gateway(10, 0, 0, 1);
IPAddress subnet(255, 255, 255, 0);

// Create a web server on port 80
WebServer server(80);
WiFiClient client;

const char* serverHost = "10.0.0.43";  // WiFi-Lights server IP address
const int serverPort = 5000;            // Port for WiFi-Lights server

// Use GPIO pins that are generally safe for input (e.g., GPIO 12, 13, 14, 27, 32, 33)
int monitoredPins[] = {12, 13, 14, 27, 32, 33};
int previousPinStates[6];

volatile int64_t lastPressTime = 0;
volatile bool buttonPressed = false;
bool button_27_state = false;
volatile int buttonPressedPin = -1;

void IRAM_ATTR button_isr_handler(void* arg) {
    int pin = (int)arg;
    int64_t currentTime = esp_timer_get_time(); // Get the current time in microseconds
    
    // Ensure at least 250ms (250000 microseconds) has passed since the last press
    if (currentTime - lastPressTime > 250000) {
        lastPressTime = currentTime;
        buttonPressed = true;
        buttonPressedPin = pin;
    }
}

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

void notifyStateChange(int pin, int value) {
  if (client.connect(serverHost, serverPort)) {
    // Create a compact JSON package
    String data = String("{\"pin\":") + pin + String(",\"state\":") + value + String("}");
    client.println("POST / HTTP/1.1");
    client.println("Host: " + String(serverHost));
    client.println("Content-Type: application/json");
    client.println("Content-Length: " + String(data.length()));
    client.println();
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
  for (int i = 0; i < 6; i++) {
    pinMode(monitoredPins[i], INPUT);
    previousPinStates[i] = digitalRead(monitoredPins[i]);
  }

  // Start the web server
  server.on("/", handleRoot);
  server.on("/setPin", handleSetPin);
  server.on("/readPin", handleReadPin);
  server.begin();
  Serial.println("HTTP server started");

  gpio_config_t button_config;
  button_config.intr_type = GPIO_INTR_ANYEDGE; // Trigger on any edge (press or release)
  button_config.mode = GPIO_MODE_INPUT;       // Set the pin as input
  button_config.pin_bit_mask = (1ULL << (gpio_num_t)27);
  button_config.pull_down_en = GPIO_PULLDOWN_DISABLE;
  button_config.pull_up_en = GPIO_PULLUP_ENABLE;
  gpio_config(&button_config);

  gpio_install_isr_service(0);
  gpio_isr_handler_add((gpio_num_t)27, button_isr_handler, (void*)27);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    reconnectWiFi();
  }
  server.handleClient();
  // Handle button press in the main loop
  if (buttonPressed) {
    buttonPressed = false;
    Serial.printf("Button pressed on pin %d!\n", buttonPressedPin);
    notifyStateChange(buttonPressedPin, button_27_state);
    button_27_state = !button_27_state;
  }
  delay(100); // Reduce delay to improve responsiveness
}
