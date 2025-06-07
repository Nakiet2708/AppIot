import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  TextInput,
  ScrollView,
  Alert,
  SafeAreaView,
  StatusBar
} from 'react-native';
import { getDatabase, ref, onValue, set, get } from 'firebase/database';
import { auth } from '../../config';
import { useNavigation } from '@react-navigation/native';

const Home = () => {
  const navigation = useNavigation();
  // State cho chế độ hoạt động
  const [isAutoMode, setIsAutoMode] = useState(true);
  
  // State cho nhiệt độ
  const [currentTemp, setCurrentTemp] = useState(0);
  const [thresholdTemp, setThresholdTemp] = useState('30');
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);
  
  // State cho quạt
  const [fanStates, setFanStates] = useState({
    fan1: false,
    fan2: false,
    fan3: false,
    fan4: false
  });
  
  // State cho cài đặt
  const [isSettingVisible, setIsSettingVisible] = useState(false);
  // Thêm state cho nhiệt độ ngưỡng của từng quạt
  const [fanThresholds, setFanThresholds] = useState({
    fan1: 30,
    fan2: 32,
    fan3: 34,
    fan4: 36
  });

  useEffect(() => {
    const db = getDatabase();
    
    // Lắng nghe thay đổi nhiệt độ
    const tempRef = ref(db, 'temperature/current');
    const unsubTemp = onValue(tempRef, (snapshot) => {
      const temp = snapshot.val();
      setCurrentTemp(temp);
      
      // Chỉ điều khiển quạt tự động khi đang ở chế độ tự động
      if (isAutoMode) {
        handleAutoFanControl(temp);
      }
    });

    // Lấy cài đặt từ database
    const settingsRef = ref(db, 'settings');
    const unsubSettings = onValue(settingsRef, (snapshot) => {
      const settings = snapshot.val();
      if (settings) {
        // Lấy nhiệt độ ngưỡng thấp nhất từ các quạt
        const lowestThreshold = Math.min(...Object.values(settings.fanThresholds || fanThresholds));
        setThresholdTemp(lowestThreshold.toString());
        setFanThresholds(settings.fanThresholds || {
          fan1: 30,
          fan2: 32,
          fan3: 34,
          fan4: 36
        });
        
        // Cập nhật trạng thái tự động/thủ công
        if (settings.isAutoMode !== undefined) {
          setIsAutoMode(settings.isAutoMode);
        }
      }
    });

    // Lắng nghe trạng thái quạt
    const fansRef = ref(db, 'fans');
    const unsubFans = onValue(fansRef, (snapshot) => {
      const fans = snapshot.val();
      if (fans) {
        // Chỉ cập nhật trạng thái quạt nếu đang ở chế độ thủ công
        if (!isAutoMode) {
          setFanStates(fans);
        }
      }
    });

    return () => {
      unsubTemp();
      unsubSettings();
      unsubFans();
    };
  }, [isAutoMode]); // Thêm isAutoMode vào dependencies

  const handleAutoFanControl = async (temp) => {
    const db = getDatabase();
    const newFanStates = {
      fan1: false,
      fan2: false,
      fan3: false,
      fan4: false
    };
    
    // Kiểm tra nhiệt độ với ngưỡng của từng quạt
    Object.entries(fanThresholds).forEach(([fanId, threshold]) => {
      if (temp >= threshold) {
        newFanStates[fanId] = true;
      }
    });
    
    // Cập nhật trạng thái quạt lên database
    await set(ref(db, 'fans'), newFanStates);
    setFanStates(newFanStates);
  };

  const handleModeChange = async (value) => {
    setIsAutoMode(value);
    const db = getDatabase();
    
    // Lưu trạng thái mode vào database
    await set(ref(db, 'settings/isAutoMode'), value);
    
    // Nếu chuyển sang chế độ tự động, kiểm tra nhiệt độ ngay
    if (value) {
      handleAutoFanControl(currentTemp);
    } else {
      // Khi chuyển sang chế độ thủ công, reset trạng thái quạt về false
      const newFanStates = {
        fan1: false,
        fan2: false,
        fan3: false,
        fan4: false
      };
      await set(ref(db, 'fans'), newFanStates);
      setFanStates(newFanStates);
    }
  };

  const handleManualFanToggle = async (fanId) => {
    if (!isAutoMode) {
      const db = getDatabase();
      const newFanStates = {
        ...fanStates,
        [fanId]: !fanStates[fanId]
      };
      await set(ref(db, 'fans'), newFanStates);
      setFanStates(newFanStates); // Cập nhật state ngay lập tức
    }
  };

  const handleThresholdSubmit = async () => {
    const db = getDatabase();
    const newThresholdTemp = parseFloat(thresholdTemp);
    
    // Tính toán chênh lệch với ngưỡng cũ
    const oldThreshold = parseFloat(Object.values(fanThresholds)[0]);
    const difference = newThresholdTemp - oldThreshold;
    
    // Cập nhật các ngưỡng nhiệt độ của quạt
    const newFanThresholds = {};
    Object.entries(fanThresholds).forEach(([fanId, threshold]) => {
      newFanThresholds[fanId] = threshold + difference;
    });
    
    // Cập nhật lên database
    await set(ref(db, 'settings/thresholdTemp'), newThresholdTemp);
    await set(ref(db, 'settings/fanThresholds'), newFanThresholds);
    
    setFanThresholds(newFanThresholds);
    setIsEditingThreshold(false);

    // Nếu đang ở chế độ tự động, kiểm tra và điều khiển quạt ngay lập tức
    if (isAutoMode) {
      handleAutoFanControl(currentTemp);
    }
  };

  // Cập nhật hàm xử lý khi thay đổi nhiệt độ ngưỡng của từng quạt
  const handleFanThresholdChange = async (fanId, value) => {
    const newThresholds = { ...fanThresholds };
    newThresholds[fanId] = parseFloat(value) || 0;
    setFanThresholds(newThresholds);
    const db = getDatabase();
    await set(ref(db, 'settings/fanThresholds'), newThresholds);
    
    // Nếu đang ở chế độ tự động, kiểm tra và điều khiển quạt ngay lập tức
    if (isAutoMode) {
      handleAutoFanControl(currentTemp);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView style={styles.container}>
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => navigation.navigate('Profile')}
            >
              <Text style={styles.iconText}>👤</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Hệ thống điều khiển nhiệt độ IOT</Text>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => setIsSettingVisible(!isSettingVisible)}
            >
              <Text style={styles.iconText}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Nút điều khiển máy lạnh */}
        <TouchableOpacity 
          style={styles.acButton}
          onPress={() => navigation.navigate('AirConditioner')}
        >
          <Text style={styles.acButtonIcon}>❄️</Text>
          <Text style={styles.acButtonText}>Điều khiển máy lạnh</Text>
        </TouchableOpacity>

        {/* Hiển thị nhiệt độ */}
        <View style={styles.tempContainer}>
          <Text style={styles.tempTitle}>Nhiệt độ hiện tại:</Text>
          <Text style={styles.tempValue}>{currentTemp}°C</Text>
        </View>

        {/* Cài đặt nhiệt độ ngưỡng */}
        <View style={styles.thresholdContainer}>
          <Text style={styles.thresholdTitle}>Nhiệt độ ngưỡng chung:</Text>
          {isEditingThreshold ? (
            <View style={styles.thresholdEditContainer}>
              <TextInput
                style={styles.thresholdInput}
                value={thresholdTemp}
                onChangeText={setThresholdTemp}
                keyboardType="numeric"
              />
              <TouchableOpacity 
                style={styles.thresholdButton}
                onPress={handleThresholdSubmit}
              >
                <Text style={styles.buttonText}>Lưu</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setIsEditingThreshold(true)}>
              <Text style={styles.thresholdValue}>{thresholdTemp}°C</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Cài đặt */}
        {isSettingVisible && (
          <View style={styles.settingsPanel}>
            <Text style={styles.settingTitle}>Cài đặt hệ thống</Text>
            
            {/* Chuyển đổi chế độ */}
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Chế độ hoạt động:</Text>
              <View style={styles.modeSelector}>
                <Text style={styles.modeText}>{isAutoMode ? 'Tự động' : 'Điều khiển tay'}</Text>
                <Switch
                  value={isAutoMode}
                  onValueChange={handleModeChange}
                  trackColor={{ false: "#767577", true: "#81b0ff" }}
                  thumbColor={isAutoMode ? "#f5dd4b" : "#f4f3f4"}
                />
              </View>
            </View>

            {/* Cài đặt nhiệt độ cho từng quạt */}
            {isAutoMode && (
              <View style={styles.settingRow}>
                <Text style={styles.settingLabel}>Cài đặt nhiệt độ cho từng quạt:</Text>
                {Object.entries(fanThresholds).map(([fanId, threshold]) => (
                  <View key={fanId} style={styles.fanThresholdRow}>
                    <Text style={styles.fanThresholdLabel}>{`Quạt ${fanId.slice(-1)}:`}</Text>
                    <TextInput
                      style={styles.fanThresholdInput}
                      value={threshold.toString()}
                      onChangeText={(value) => handleFanThresholdChange(fanId, value)}
                      keyboardType="numeric"
                    />
                    <Text style={styles.fanThresholdUnit}>°C</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Điều khiển quạt */}
        <View style={styles.fansContainer}>
          <Text style={styles.fansTitle}>Điều khiển quạt:</Text>
          <View style={styles.fansGrid}>
            {Object.entries(fanStates).map(([fanId, isOn]) => (
              <TouchableOpacity
                key={fanId}
                style={[
                  styles.fanButton,
                  isOn && styles.fanButtonActive,
                  isAutoMode && styles.fanButtonDisabled
                ]}
                onPress={() => handleManualFanToggle(fanId)}
                disabled={isAutoMode}
              >
                <Text style={[
                  styles.fanIcon,
                  isOn && styles.fanIconActive
                ]}>{isOn ? "💨" : "💨"}</Text>
                <Text style={[
                  styles.fanText,
                  isOn && styles.fanTextActive
                ]}>{`Quạt ${fanId.slice(-1)}`}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
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
  },
  headerContainer: {
    backgroundColor: '#fff',
    paddingTop: 16,
    paddingBottom: 16,
    elevation: 4,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  iconButton: {
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    elevation: 2,
  },
  tempContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 10,
    marginBottom: 16,
    elevation: 2,
  },
  tempTitle: {
    fontSize: 16,
    color: '#666',
  },
  tempValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  thresholdContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
    elevation: 2,
  },
  thresholdTitle: {
    fontSize: 16,
    color: '#666',
  },
  thresholdValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  thresholdEditContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  thresholdInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    marginRight: 10,
    fontSize: 18,
  },
  thresholdButton: {
    backgroundColor: '#81b0ff',
    padding: 10,
    borderRadius: 5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  settingsPanel: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
    elevation: 2,
  },
  settingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  settingRow: {
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  modeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  modeText: {
    fontSize: 16,
    color: '#333',
  },
  fansContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
    elevation: 2,
  },
  fansTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  fansGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  fanButton: {
    width: '48%',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 1,
  },
  fanButtonActive: {
    backgroundColor: '#81b0ff',
  },
  fanButtonDisabled: {
    opacity: 0.7,
  },
  fanText: {
    marginTop: 8,
    fontSize: 14,
    color: '#333',
  },
  fanTextActive: {
    color: '#fff',
  },
  fanThresholdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  fanThresholdLabel: {
    flex: 1,
    fontSize: 16,
    color: '#666',
  },
  fanThresholdInput: {
    width: 60,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    marginHorizontal: 10,
    textAlign: 'center',
  },
  fanThresholdUnit: {
    fontSize: 16,
    color: '#666',
  },
  acButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#81b0ff',
    padding: 12,
    borderRadius: 10,
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
  },
  acButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  iconText: {
    fontSize: 24,
    color: '#81b0ff',
  },
  acButtonIcon: {
    fontSize: 24,
    color: '#fff',
  },
  fanIcon: {
    fontSize: 32,
    color: '#333',
  },
  fanIconActive: {
    color: '#fff',
  },
});

export default Home;
