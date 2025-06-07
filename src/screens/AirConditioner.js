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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.headerIcon}>{'←'}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Điều khiển máy lạnh</Text>
          <TouchableOpacity
            style={styles.scheduleButton}
            onPress={() => navigation.navigate('Schedule')}
          >
            <Text style={styles.headerIcon}>{'⏰'}</Text>
          </TouchableOpacity>
        </View>

        {/* Card trạng thái & nhiệt độ */}
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Trạng thái máy lạnh</Text>
          <Text style={[styles.statusValue, isACOn ? styles.statusOn : styles.statusOff]}>
            {isACOn ? '● ĐANG BẬT' : '○ ĐANG TẮT'}
          </Text>
          <Text style={styles.sensorTempCard}>Nhiệt độ phòng: <Text style={{fontWeight:'bold'}}>{sensorTemp.toFixed(1)}°C</Text></Text>
        </View>

        {/* Card điều khiển ON/OFF */}
        <View style={styles.controlCard}>
          <TouchableOpacity
            style={[styles.bigButton, isACOn && styles.bigButtonActive]}
            onPress={() => handleACControl('ON')}
            disabled={isLoading}
          >
            <Text style={[styles.bigButtonLabel, isACOn && styles.bigButtonTextActive]}>
              {isLoading ? '...' : 'BẬT'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bigButton, !isACOn && styles.bigButtonActive]}
            onPress={() => handleACControl('OFF')}
            disabled={isLoading}
          >
            <Text style={[styles.bigButtonLabel, !isACOn && styles.bigButtonTextActive]}>
              {isLoading ? '...' : 'TẮT'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Card điều chỉnh nhiệt độ */}
        <View style={styles.tempCard}>
          <Text style={styles.tempTitle}>Nhiệt độ cài đặt</Text>
          <View style={styles.tempRow}>
            <TouchableOpacity
              style={[styles.tempButton, !isACOn && styles.tempButtonDisabled]}
              onPress={() => handleTemperatureChange(temperature - 1)}
              disabled={!isACOn || isLoading}
            >
              <Text style={styles.tempButtonText}>▼</Text>
            </TouchableOpacity>
            <Text style={styles.tempValue}>{temperature}°C</Text>
            <TouchableOpacity
              style={[styles.tempButton, !isACOn && styles.tempButtonDisabled]}
              onPress={() => handleTemperatureChange(temperature + 1)}
              disabled={!isACOn || isLoading}
            >
              <Text style={styles.tempButtonText}>▲</Text>
            </TouchableOpacity>
          </View>
          {isACOn && (
            <Text style={styles.countdownText}>
              ⏳ Kiểm tra sau: <Text style={{fontWeight:'bold'}}>{countdown}s</Text>
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  headerIcon: {
    fontSize: 28,
    color: '#4f8cff',
    padding: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    flex: 1,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    marginBottom: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statusLabel: {
    fontSize: 16,
    color: '#888',
    marginBottom: 6,
  },
  statusValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusOn: {
    color: '#4f8cff',
  },
  statusOff: {
    color: '#bbb',
  },
  sensorTempCard: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  controlCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 18,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  bigButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f6fa',
    borderRadius: 16,
    width: 110,
    height: 110,
    marginHorizontal: 8,
    borderWidth: 2,
    borderColor: '#e0e7ef',
  },
  bigButtonActive: {
    backgroundColor: '#4f8cff',
    borderColor: '#4f8cff',
  },
  bigButtonText: {
    fontSize: 38,
    color: '#4f8cff',
    fontWeight: 'bold',
  },
  bigButtonTextActive: {
    color: '#fff',
  },
  bigButtonLabel: {
    fontSize: 18,
    marginTop: 8,
    color: '#4f8cff',
    fontWeight: 'bold',
  },
  tempCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 18,
  },
  tempTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 12,
  },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tempButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f6fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    borderWidth: 2,
    borderColor: '#e0e7ef',
  },
  tempButtonDisabled: {
    backgroundColor: '#f0f0f0',
    borderColor: '#e0e0e0',
  },
  tempButtonText: {
    fontSize: 28,
    color: '#4f8cff',
    fontWeight: 'bold',
  },
  tempValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4f8cff',
    marginHorizontal: 12,
  },
  countdownText: {
    fontSize: 15,
    color: '#888',
    marginTop: 8,
    fontWeight: '500',
  },
  scheduleButton: {
    padding: 4,
  },
});

export default AirConditioner; 