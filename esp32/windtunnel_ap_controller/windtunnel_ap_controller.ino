/*
  Wind tunnel ESC controller (ESP32, Arduino) - AP mode

  - ESP32 creates WiFi AP for PAD to connect.
  - HTTP control endpoint: POST /control  (x-www-form-urlencoded) speed=0..100
  - Output: standard servo/ESC PWM at 50Hz, pulse 900..2100us
  - Safety: arming delay, ramp limiting, command timeout failsafe

  Wiring to servo splitter ("S/+/-"):
  - ESP32 GND -> '-' (must share ground with ESCs)
  - ESP32 PWM GPIO -> 'S'
  - ESP32 5V/VIN <- '+' from ONE ESC BEC (or external 5V)
*/

#include <WiFi.h>
#include <WebServer.h>
#include <ESP32Servo.h>

// ===== WiFi AP settings =====
static const char* AP_SSID = "WindTunnel-ESP32";
static const char* AP_PASS = "12345678"; // >= 8 chars

// AP IP config (default is 192.168.4.1)
IPAddress apIP(192, 168, 4, 1);
IPAddress apGW(192, 168, 4, 1);
IPAddress apMask(255, 255, 255, 0);

// ===== ESC PWM settings =====
static const int ESC_GPIO = 18;         // change to your chosen pin
static const int ESC_HZ = 50;           // typical ESC/servo frequency
static const int PULSE_MIN_US = 900;    // per your knob controller spec
static const int PULSE_MAX_US = 2100;
static const int PULSE_SAFE_US = 900;   // idle / stop

// ===== Safety behavior =====
static const uint32_t ARM_DELAY_MS = 2500;     // keep SAFE pulse after boot
static const uint32_t CMD_TIMEOUT_MS = 1000;   // if no cmd in time -> SAFE
static const int RAMP_STEP_US = 6;             // max change per tick
static const uint32_t RAMP_TICK_MS = 20;       // 50Hz-ish update

WebServer server(80);
Servo esc;

volatile int targetUs = PULSE_SAFE_US;
int currentUs = PULSE_SAFE_US;

uint32_t bootMs = 0;
uint32_t lastCmdMs = 0;
uint32_t lastRampMs = 0;

static int clampInt(int v, int lo, int hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

static int pctToPulseUs(int pct) {
  pct = clampInt(pct, 0, 100);
  // map 0..100 -> MIN..MAX
  return map(pct, 0, 100, PULSE_MIN_US, PULSE_MAX_US);
}

static void addCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  server.sendHeader("Access-Control-Max-Age", "600");
}

void handleOptions() {
  addCorsHeaders();
  server.send(204);
}

void handleHealth() {
  addCorsHeaders();
  server.send(200, "application/json",
              "{\"ok\":true,\"mode\":\"ap\",\"ip\":\"192.168.4.1\"}");
}

void handleTelemetry() {
  // simple telemetry for future expansion
  const uint32_t now = millis();
  const bool armed = (now - bootMs) >= ARM_DELAY_MS;
  const bool timeout = (now - lastCmdMs) > CMD_TIMEOUT_MS;

  String json = "{";
  json += "\"armed\":" + String(armed ? "true" : "false");
  json += ",\"timeout\":" + String(timeout ? "true" : "false");
  json += ",\"pulse_us\":" + String(currentUs);
  json += "}";
  addCorsHeaders();
  server.send(200, "application/json", json);
}

void handleControl() {
  // Accept: speed=0..100 (x-www-form-urlencoded)
  if (!server.hasArg("speed")) {
    addCorsHeaders();
    server.send(400, "text/plain", "missing speed");
    return;
  }

  const int pct = server.arg("speed").toInt();
  const int pulse = pctToPulseUs(pct);

  lastCmdMs = millis();
  targetUs = pulse;

  addCorsHeaders();
  server.send(200, "application/json",
              String("{\"ok\":true,\"speed\":") + pct + ",\"target_us\":" + pulse + "}");
}

void setup() {
  Serial.begin(115200);
  delay(50);

  bootMs = millis();
  lastCmdMs = bootMs;
  lastRampMs = bootMs;

  // WiFi AP
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(apIP, apGW, apMask);
  WiFi.softAP(AP_SSID, AP_PASS);

  // ESC output
  esc.setPeriodHertz(ESC_HZ);
  esc.attach(ESC_GPIO, PULSE_MIN_US, PULSE_MAX_US);
  esc.writeMicroseconds(PULSE_SAFE_US);

  // HTTP routes
  server.on("/health", HTTP_GET, handleHealth);
  server.on("/telemetry", HTTP_GET, handleTelemetry);
  server.on("/control", HTTP_POST, handleControl);
  server.on("/health", HTTP_OPTIONS, handleOptions);
  server.on("/telemetry", HTTP_OPTIONS, handleOptions);
  server.on("/control", HTTP_OPTIONS, handleOptions);
  server.onNotFound([]() { server.send(404, "text/plain", "not found"); });
  server.begin();

  Serial.println("AP started:");
  Serial.print("  SSID: "); Serial.println(AP_SSID);
  Serial.print("  IP:   "); Serial.println(WiFi.softAPIP());
  Serial.print("  PWM GPIO: "); Serial.println(ESC_GPIO);
}

void loop() {
  server.handleClient();

  const uint32_t now = millis();

  // Keep SAFE during arming delay
  const bool armed = (now - bootMs) >= ARM_DELAY_MS;
  if (!armed) {
    if (currentUs != PULSE_SAFE_US) {
      currentUs = PULSE_SAFE_US;
      esc.writeMicroseconds(currentUs);
    }
    delay(5);
    return;
  }

  // Failsafe on command timeout
  const bool timeout = (now - lastCmdMs) > CMD_TIMEOUT_MS;
  if (timeout) {
    targetUs = PULSE_SAFE_US;
  }

  // Ramp update
  if ((now - lastRampMs) >= RAMP_TICK_MS) {
    lastRampMs = now;

    int nextUs = currentUs;
    if (currentUs < targetUs) nextUs = min(currentUs + RAMP_STEP_US, (int)targetUs);
    else if (currentUs > targetUs) nextUs = max(currentUs - RAMP_STEP_US, (int)targetUs);

    if (nextUs != currentUs) {
      currentUs = nextUs;
      esc.writeMicroseconds(currentUs);
    }
  }

  delay(2);
}

