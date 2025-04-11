#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

// WiFi credentials
const char* ssid = "SuperWifi";
const char* password = "cacaboudin";

// Web server on port 80
WebServer server(80);


// Static IP configuration
IPAddress local_IP(10, 0, 0, 40);
IPAddress gateway(10, 0, 0, 1);
IPAddress subnet(255, 255, 255, 0);
IPAddress primaryDNS(24, 201, 245, 77); // Optional

void configureWiFi() {
    if (!WiFi.config(local_IP, gateway, subnet, primaryDNS, secondaryDNS)) {
        Serial.println("STA Failed to configure");
    }
}

// Function to handle root path
void handleRoot() {
    String html = "<html><body><h1>ESP32 API</h1>";
    html += "<p>Use the following endpoints to configure PWM and read pin data:</p>";
    html += "<ul>";
    html += "<li>/set_pwm?pin=[pin]&value=[value]</li>";
    html += "<li>/read_pin?pin=[pin]</li>";
    html += "</ul>";
    html += "</body></html>";
    server.send(200, "text/html", html);
}

// Function to set PWM on a pin
void handleSetPWM() {
    if (server.hasArg("pin") && server.hasArg("value")) {
        int pin = server.arg("pin").toInt();
        int value = server.arg("value").toInt();
        ledcWrite(pin, value);
        server.send(200, "text/plain", "PWM set");
    } else {
        server.send(400, "text/plain", "Bad Request");
    }
}

// Function to read a pin value
void handleReadPin() {
    if (server.hasArg("pin")) {
        int pin = server.arg("pin").toInt();
        int value = digitalRead(pin);
        server.send(200, "text/plain", String(value));
    } else {
        server.send(400, "text/plain", "Bad Request");
    }
}

void setup() {
    // Initialize serial communication
    Serial.begin(115200);

    // Initialize buttons
    for (int i = 0; i < 4; i++) {
        pinMode(buttonPins[i], INPUT_PULLUP);
    }

    // Initialize MPU6050
    if (!mpu.begin()) {
        Serial.println("Failed to find MPU6050 chip");
        while (1) {
            delay(10);
        }
    }
    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
    mpu.setGyroRange(MPU6050_RANGE_500_DEG);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

    // Connect to WiFi
    WiFi.begin(ssid, password);
    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.println("Connecting to WiFi...");
    }
    Serial.println("Connected to WiFi");

    // Start the server
    server.on("/", handleRoot);
    server.on("/set_pwm", handleSetPWM);
    server.on("/read_pin", handleReadPin);
    server.begin();
    Serial.println("Server started");
}

void loop() {
    // Handle client requests
    server.handleClient();

    // Read accelerometer data
    sensors_event_t a, g, temp;
    mpu.getEvent(&a, &g, &temp);

    // Print accelerometer data
    Serial.print("Accel X: "); Serial.print(a.acceleration.x); Serial.print(", ");
    Serial.print("Accel Y: "); Serial.print(a.acceleration.y); Serial.print(", ");
    Serial.print("Accel Z: "); Serial.println(a.acceleration.z);

    delay(1000);
}