import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { getDatabase, ref, onValue, set, get } from 'firebase/database';
import { useNavigation } from '@react-navigation/native';

const AirConditioner = () => {
  const navigation = useNavigation();
  const [isACOn, setIsACOn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [temperature, setTemperature] = useState(24);
  const [sensorTemp, setSensorTemp] = useState(0);
  const [countdown, setCountdown] = useState(10);

  // useEffect cho việc theo dõi Firebase
  useEffect(() => {
    const db = getDatabase();
    const acRef = ref(db, 'airConditioner/status');
    const tempRef = ref(db, 'airConditioner/temperature');
    const sensorTempRef = ref(db, 'sensor/temperature');
    
    // Lắng nghe thay đổi trạng thái máy lạnh
    const unsubscribeStatus = onValue(acRef, (snapshot) => {
      const status = snapshot.val();
      console.log('Current AC status:', status);
      setIsACOn(status === 'ON');
      setIsLoading(false);
      // Reset đồng hồ đếm ngược khi thay đổi trạng thái ON/OFF
      setCountdown(10);
    }, (error) => {
      console.error('Error reading AC status:', error);
      window.alert('Lỗi: Không thể đọc trạng thái máy lạnh');
      setIsLoading(false);
    });

    // Lắng nghe thay đổi nhiệt độ cài đặt
    const unsubscribeTemp = onValue(tempRef, (snapshot) => {
      const temp = snapshot.val();
      if (temp !== null && temp !== temperature) {
        setTemperature(temp);
        // Reset đồng hồ đếm ngược khi thay đổi nhiệt độ từ remote
        setCountdown(10);
      }
    }, (error) => {
      console.error('Error reading temperature:', error);
    });

    // Lắng nghe nhiệt độ từ cảm biến
    const unsubscribeSensorTemp = onValue(sensorTempRef, (snapshot) => {
      const temp = snapshot.val();
      if (temp !== null) {
        setSensorTemp(temp);
      }
    }, (error) => {
      console.error('Error reading sensor temperature:', error);
    });

    return () => {
      unsubscribeStatus();
      unsubscribeTemp();
      unsubscribeSensorTemp();
    };
  }, []); // Chỉ chạy một lần khi component mount

  // useEffect riêng cho đồng hồ đếm ngược và kiểm tra nhiệt độ
  useEffect(() => {
    let countdownInterval;
    
    if (isACOn) {
      countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            // Đọc dữ liệu mới nhất từ Firebase để kiểm tra
            const db = getDatabase();
            const tempRef = ref(db, 'airConditioner/temperature');
            const sensorRef = ref(db, 'sensor/temperature');
            
            // Đọc cả nhiệt độ cài đặt và nhiệt độ cảm biến
            Promise.all([
              get(tempRef),
              get(sensorRef)
            ]).then(([tempSnapshot, sensorSnapshot]) => {
              const currentTemp = tempSnapshot.val();
              const currentSensorTemp = sensorSnapshot.val();
              
              console.log('Kiểm tra nhiệt độ:');
              console.log('- Nhiệt độ cài đặt:', currentTemp, '°C');
              console.log('- Nhiệt độ phòng:', currentSensorTemp, '°C');
              
              if (currentTemp !== null && currentSensorTemp !== null) {
                const tempDiff = Math.abs(currentSensorTemp - currentTemp);
                console.log('- Chênh lệch:', tempDiff, '°C');
                
                if (tempDiff >= 5) {
                  const ledRef = ref(db, 'led/status');
                  set(ledRef, true).then(() => {
                    window.alert(`Cảnh báo nhiệt độ!\n\nNhiệt độ phòng (${currentSensorTemp.toFixed(1)}°C) chênh lệch nhiều với nhiệt độ cài đặt (${currentTemp}°C)\n\nVui lòng kiểm tra lại máy lạnh.`);
                    set(ledRef, false);
                  }).catch(error => {
                    console.error('Error setting LED status:', error);
                  });
                }
              } else {
                console.log('Không thể đọc được nhiệt độ từ Firebase');
              }
            }).catch(error => {
              console.error('Error reading temperatures:', error);
            });
            
            return 10; // Reset về 10 giây
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [isACOn]);

  const handleACControl = async (command) => {
    setIsLoading(true);
    const db = getDatabase();
    const acRef = ref(db, 'airConditioner/status');
    
    try {
      console.log('Sending command:', command);
      await set(acRef, command);
      console.log('Command sent successfully');
      setIsACOn(command === 'ON');
      window.alert(`Thành công: Máy lạnh đã được ${command === 'ON' ? 'bật' : 'tắt'}`);
    } catch (error) {
      console.error('Error controlling AC:', error);
      window.alert('Lỗi: Không thể điều khiển máy lạnh');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemperatureChange = async (newTemp) => {
    if (newTemp < 18 || newTemp > 30) {
      window.alert('Lỗi: Nhiệt độ phải từ 18°C đến 30°C');
      return;
    }

    setIsLoading(true);
    const db = getDatabase();
    const tempRef = ref(db, 'airConditioner/temperature');
    
    try {
      await set(tempRef, newTemp);
      setTemperature(newTemp);
      // Reset đồng hồ đếm ngược khi thay đổi nhiệt độ từ nút + -
      setCountdown(10); // Đổi thành 10 giây
      window.alert(`Thành công: Đã đặt nhiệt độ ${newTemp}°C`);
    } catch (error) {
      console.error('Error setting temperature:', error);
      window.alert('Lỗi: Không thể thay đổi nhiệt độ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.iconText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Điều khiển máy lạnh</Text>
          <TouchableOpacity
            style={styles.scheduleButton}
            onPress={() => navigation.navigate('Schedule')}
          >
            <Text style={styles.iconText}>📅</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.controlContainer}>
          <TouchableOpacity
            style={[styles.button, isACOn && styles.buttonActive]}
            onPress={() => handleACControl('ON')}
            disabled={isLoading}
          >
            <Text style={[styles.iconText, isACOn && styles.buttonTextActive]}>⚡</Text>
            <Text style={[styles.buttonText, isACOn && styles.buttonTextActive]}>
              {isLoading ? 'Đang xử lý...' : 'ON'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, !isACOn && styles.buttonActive]}
            onPress={() => handleACControl('OFF')}
            disabled={isLoading}
          >
            <Text style={[styles.iconText, !isACOn && styles.buttonTextActive]}>⭕</Text>
            <Text style={[styles.buttonText, !isACOn && styles.buttonTextActive]}>
              {isLoading ? 'Đang xử lý...' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Temperature Control */}
        <View style={styles.temperatureContainer}>
          <Text style={styles.temperatureTitle}>Nhiệt độ cài đặt: {temperature}°C</Text>
          <Text style={styles.sensorTemp}>Nhiệt độ phòng: {sensorTemp.toFixed(1)}°C</Text>
          {isACOn && (
            <Text style={styles.countdownText}>
              Kiểm tra nhiệt độ sau: {countdown} giây
            </Text>
          )}
          <View style={styles.temperatureControls}>
            <TouchableOpacity
              style={[styles.tempButton, !isACOn && styles.tempButtonDisabled]}
              onPress={() => handleTemperatureChange(temperature - 1)}
              disabled={!isACOn || isLoading}
            >
              <Text style={[styles.iconText, !isACOn && styles.tempButtonDisabled]}>-</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tempButton, !isACOn && styles.tempButtonDisabled]}
              onPress={() => handleTemperatureChange(temperature + 1)}
              disabled={!isACOn || isLoading}
            >
              <Text style={[styles.iconText, !isACOn && styles.tempButtonDisabled]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>
            Trạng thái hiện tại: {isLoading ? 'Đang tải...' : (isACOn ? 'Đang bật' : 'Đang tắt')}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  controlContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    width: 120,
    elevation: 2,
  },
  buttonActive: {
    backgroundColor: '#81b0ff',
  },
  buttonText: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#81b0ff',
  },
  buttonTextActive: {
    color: '#fff',
  },
  temperatureContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  temperatureTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  temperatureControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  tempButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  tempButtonDisabled: {
    backgroundColor: '#f5f5f5',
  },
  statusContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  statusText: {
    fontSize: 18,
    color: '#666',
  },
  scheduleButton: {
    padding: 8,
  },
  sensorTemp: {
    fontSize: 18,
    color: '#666',
    marginTop: 8,
    marginBottom: 16,
  },
  countdownText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
    marginBottom: 16,
    fontWeight: '500',
  },
  iconText: {
    fontSize: 24,
    color: '#81b0ff',
  },
});

export default AirConditioner; 