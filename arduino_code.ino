#include <Arduino.h>
#include <IRremoteESP8266.h>
#include <IRsend.h>
#include <ir_Daikin.h>
#include <ESP8266WiFi.h>
#include <Firebase_ESP_Client.h>
#include <OneWire.h>
#include <DallasTemperature.h>

//Provide the token generation process info.
#include "addons/TokenHelper.h"
//Provide the RTDB payload printing info and other helper functions.
#include "addons/RTDBHelper.h"

// Thông tin WiFi
#define WIFI_SSID "abc"
#define WIFI_PASSWORD "1234567890"

// Insert Firebase project API Key
#define API_KEY "AIzaSyB4qzwYzJV17az7JkqGRU7A-lSk45mCdzI"
#define DATABASE_URL "https://project-iot-4bef7-default-rtdb.asia-southeast1.firebasedatabase.app/"

// Định nghĩa chân
const uint16_t kIrLed = 4;      // ESP8266 GPIO pin để kết nối với IR LED (D2)
const int DS18B20_PIN = 0;      // Chân D3
const int LED_PIN = 5;          // Chân D1

//Define Firebase Data object
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Khởi tạo đối tượng OneWire và DallasTemperature
OneWire oneWire(DS18B20_PIN);
DallasTemperature sensors(&oneWire);

IRDaikin176 ac(kIrLed);     // Tạo đối tượng điều khiển Daikin

unsigned long sendDataPrevMillis = 0;
unsigned long tempCheckPrevMillis = 0;  // Biến để kiểm tra nhiệt độ định kỳ
const long tempCheckInterval = 5000;    // Đọc nhiệt độ mỗi 5 giây

bool signupOK = false;
String currentStatus = "";
bool lastACState = false;
int currentTemp = 24;  // Nhiệt độ hiện tại
float lastSensorTemp = 0;  // Nhiệt độ từ cảm biến
bool ledState = false;     // Trạng thái đèn LED

// ... giữ nguyên các hàm setupAC(), turnOn(), turnOff(), setTemperature() ...

void setupLED() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
}

void setLED(bool state) {
  ledState = state;
  digitalWrite(LED_PIN, state ? HIGH : LOW);
  // Cập nhật trạng thái LED lên Firebase
  Serial.printf("\nĐang cập nhật trạng thái LED (%s) lên Firebase...\n", state ? "BẬT" : "TẮT");
  if (Firebase.RTDB.setBool(&fbdo, "led/status", ledState)) {
    Serial.println("✓ Đã cập nhật trạng thái LED lên Firebase thành công");
  } else {
    Serial.println("✗ Lỗi cập nhật LED: " + fbdo.errorReason());
  }
}

void readAndUpdateTemperature() {
  Serial.println("\n=== ĐANG ĐỌC NHIỆT ĐỘ CẢM BIẾN ===");
  sensors.requestTemperatures();
  float tempC = sensors.getTempCByIndex(0);
  
  if (tempC != DEVICE_DISCONNECTED_C) {
    lastSensorTemp = tempC;
    Serial.printf("Nhiệt độ đọc được: %.2f°C\n", tempC);
    // Cập nhật nhiệt độ lên Firebase
    Serial.println("Đang cập nhật nhiệt độ lên Firebase...");
    if (Firebase.RTDB.setFloat(&fbdo, "sensor/temperature", tempC)) {
      Serial.println("✓ Đã cập nhật nhiệt độ lên Firebase thành công");
    } else {
      Serial.println("✗ Lỗi cập nhật nhiệt độ: " + fbdo.errorReason());
      Serial.println("Chi tiết lỗi:");
      Serial.println("- Mã lỗi: " + String(fbdo.errorCode()));
      Serial.println("- Lý do: " + fbdo.errorReason());
    }
  } else {
    Serial.println("✗ Lỗi: Không thể đọc dữ liệu từ cảm biến nhiệt độ!");
    Serial.println("Kiểm tra lại kết nối của cảm biến DS18B20");
  }
  Serial.println("===============================");
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== BẮT ĐẦU KHỞI TẠO HỆ THỐNG ===");
  
  Serial.println("1. Khởi tạo máy lạnh...");
  setupAC();
  
  Serial.println("2. Khởi tạo LED...");
  setupLED();
  
  Serial.println("3. Khởi tạo cảm biến DS18B20...");
  sensors.begin();
  
  Serial.println("4. Kết nối WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Đang kết nối WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(300);
  }
  Serial.println("\n✓ Đã kết nối WiFi thành công!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());

  Serial.println("\n5. Cấu hình Firebase...");
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;

  Serial.println("6. Đăng ký với Firebase...");
  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("✓ Kết nối Firebase thành công!");
    signupOK = true;
  } else {
    Serial.println("✗ Lỗi kết nối Firebase!");
    Serial.printf("Chi tiết lỗi: %s\n", config.signer.signupError.message.c_str());
  }

  config.token_status_callback = tokenStatusCallback;
  
  Serial.println("7. Khởi tạo kết nối Firebase...");
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Kiểm tra kết nối Firebase
  if (Firebase.ready()) {
    Serial.println("✓ Firebase đã sẵn sàng!");
  } else {
    Serial.println("✗ Firebase chưa sẵn sàng, kiểm tra lại kết nối!");
  }

  Serial.println("\n=== KHỞI TẠO HOÀN TẤT ===");
  Serial.println("Hệ thống bắt đầu hoạt động...\n");
}

void loop() {
  if (Firebase.ready() && signupOK) {
    unsigned long currentMillis = millis();
    
    // Kiểm tra và cập nhật nhiệt độ từ cảm biến định kỳ
    if (currentMillis - tempCheckPrevMillis >= tempCheckInterval) {
      tempCheckPrevMillis = currentMillis;
      readAndUpdateTemperature();
    }
    
    // Kiểm tra điều khiển máy lạnh và LED
    if (currentMillis - sendDataPrevMillis > 100 || sendDataPrevMillis == 0) {
      sendDataPrevMillis = currentMillis;
      
      // Đọc trạng thái máy lạnh từ Firebase
      if (Firebase.RTDB.getString(&fbdo, "airConditioner/status")) {
        String acStatus = fbdo.stringData();
        bool currentACState = (acStatus == "ON");
        
        if (acStatus != currentStatus) {
          Serial.println("\n=== PHÁT HIỆN THAY ĐỔI TRẠNG THÁI MÁY LẠNH ===");
          Serial.printf("Từ: %s -> %s\n", currentStatus.c_str(), acStatus.c_str());
          
          if (currentACState) {
            turnOn();
          } else {
            turnOff();
          }
          currentStatus = acStatus;
          lastACState = currentACState;
        }
      }
      
      // Đọc trạng thái LED từ Firebase
      if (Firebase.RTDB.getBool(&fbdo, "led/status")) {
        bool newLedState = fbdo.boolData();
        if (newLedState != ledState) {
          Serial.println("\n=== PHÁT HIỆN THAY ĐỔI TRẠNG THÁI LED ===");
          setLED(newLedState);
        }
      }
      
      // Đọc nhiệt độ điều chỉnh từ Firebase
      if (Firebase.RTDB.getInt(&fbdo, "airConditioner/temperature")) {
        int newTemp = fbdo.intData();
        if (newTemp != currentTemp) {
          Serial.printf("\n=== PHÁT HIỆN THAY ĐỔI NHIỆT ĐỘ CÀI ĐẶT ===\n");
          Serial.printf("Từ: %d°C -> %d°C\n", currentTemp, newTemp);
          setTemperature(newTemp);
        }
      }
      
      // In trạng thái hiện tại
      Serial.println("\n=== TRẠNG THÁI HIỆN TẠI ===");
      Serial.printf("- Máy lạnh: %s\n", lastACState ? "ĐANG BẬT" : "ĐANG TẮT");
      Serial.printf("- Nhiệt độ cài đặt: %d°C\n", currentTemp);
      Serial.printf("- Nhiệt độ cảm biến: %.2f°C\n", lastSensorTemp);
      Serial.printf("- Đèn LED: %s\n", ledState ? "ĐANG BẬT" : "ĐANG TẮT");
      Serial.printf("- Thời gian: %d giây\n", currentMillis / 1000);
      Serial.println("===========================");
    }
  } else {
    Serial.println("Firebase không sẵn sàng hoặc chưa kết nối!");
    Serial.println("Đang thử kết nối lại...");
    delay(1000);
  }
} 