import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
  FlatList
} from 'react-native';
import { getDatabase, ref, onValue, set, remove, push } from 'firebase/database';
import { useNavigation } from '@react-navigation/native';

const Schedule = () => {
  const navigation = useNavigation();
  const [schedules, setSchedules] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    time: new Date(),
    action: 'ON',
    temperature: 24,
    duration: null
  });
  const [selectedTime, setSelectedTime] = useState({
    hours: new Date().getHours(),
    minutes: new Date().getMinutes()
  });
  const [currentTime, setCurrentTime] = useState(new Date());

  // Tạo mảng số từ 0 đến max
  const range = (max) => Array.from({ length: max }, (_, i) => i);
  const hours = range(24);
  const minutes = range(60);

  // Thêm state để theo dõi thời gian còn lại
  const [, forceUpdate] = useState();

  useEffect(() => {
    const db = getDatabase();
    const scheduleRef = ref(db, 'airConditioner/schedules');
    
    // Lắng nghe thay đổi lịch hẹn
    const unsubscribe = onValue(scheduleRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const scheduleArray = Object.entries(data).map(([id, schedule]) => ({
          id,
          ...schedule
        }));
        // Sort schedules by time
        scheduleArray.sort((a, b) => {
          const timeA = new Date(a.time);
          const timeB = new Date(b.time);
          return timeA - timeB;
        });
        setSchedules(scheduleArray);
      } else {
        setSchedules([]);
      }
    });

    // Kiểm tra lịch hẹn mỗi giây
    const checkInterval = setInterval(checkAndExecuteSchedules, 1000);

    // Cập nhật thời gian hiện tại mỗi giây
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Cập nhật thời gian còn lại mỗi giây
    const interval = setInterval(() => {
      forceUpdate({});
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(checkInterval);
      clearInterval(timeInterval);
      clearInterval(interval);
    };
  }, []);

  const checkAndExecuteSchedules = async () => {
    const now = new Date();
    const db = getDatabase();

    // Log thời gian hiện tại chi tiết
    console.log('=== Thời gian hiện tại ===', {
      local: now.toLocaleString('vi-VN'),
      iso: now.toISOString(),
      timestamp: now.getTime(),
      hours: now.getHours(),
      minutes: now.getMinutes(),
      seconds: now.getSeconds()
    });

    for (const schedule of schedules) {
      try {
        const scheduleTime = new Date(schedule.time);
        const timeDiffInSeconds = Math.floor((scheduleTime.getTime() - now.getTime()) / 1000);

        console.log('So sánh thời gian:', {
          id: schedule.id,
          scheduleTime: scheduleTime.toLocaleString('vi-VN'),
          currentTime: now.toLocaleString('vi-VN'),
          timeDiffInSeconds
        });

        // Nếu thời gian đã qua, thực hiện ngay lập tức
        if (timeDiffInSeconds <= 0) {
          console.log('=== THỰC HIỆN LỊCH HẸN ĐÃ QUÁ HẠN ===', {
            id: schedule.id,
            time: scheduleTime.toLocaleString('vi-VN'),
            action: schedule.action,
            temperature: schedule.temperature
          });

          try {
            // Cập nhật trạng thái máy lạnh
            const acRef = ref(db, 'airConditioner/status');
            await set(acRef, schedule.action);
            console.log('Đã cập nhật trạng thái máy lạnh:', schedule.action);

            // Nếu action là ON và có nhiệt độ, cập nhật nhiệt độ
            if (schedule.action === 'ON' && schedule.temperature) {
              const tempRef = ref(db, 'airConditioner/temperature');
              await set(tempRef, schedule.temperature);
              console.log('Đã cập nhật nhiệt độ:', schedule.temperature);
            }

            // Xóa lịch hẹn sau khi thực hiện thành công
            const scheduleRef = ref(db, `airConditioner/schedules/${schedule.id}`);
            await remove(scheduleRef);
            console.log('Đã xóa lịch hẹn:', schedule.id);

            window.alert(`Đã thực hiện lịch hẹn: ${schedule.action === 'ON' ? 
              `Bật máy lạnh ${schedule.temperature}°C` : 
              'Tắt máy lạnh'}`);
          } catch (error) {
            console.error('Lỗi khi thực hiện lịch hẹn:', error);
          }
        }
      } catch (error) {
        console.error('Lỗi khi kiểm tra lịch hẹn:', error);
      }
    }
  };

  const handleTimeSelect = () => {
    const now = new Date();
    const selectedDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      selectedTime.hours,
      selectedTime.minutes,
      0
    );

    // Nếu thời gian đã qua, thêm 1 ngày
    if (selectedDate < now) {
      selectedDate.setDate(selectedDate.getDate() + 1);
    }

    setScheduleForm(prev => ({...prev, time: selectedDate}));
  };

  const handleAddSchedule = async () => {
    if (!selectedTime.hours && !selectedTime.minutes) {
      window.alert('Lỗi: Vui lòng chọn thời gian');
      return;
    }

    setIsLoading(true);
    const db = getDatabase();
    const schedulesRef = ref(db, 'airConditioner/schedules');
    
    try {
      const now = new Date();
      const selectedDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        selectedTime.hours,
        selectedTime.minutes,
        0
      );

      // Nếu thời gian đã qua, thêm 1 ngày
      if (selectedDate < now) {
        selectedDate.setDate(selectedDate.getDate() + 1);
      }

      const newScheduleRef = push(schedulesRef);
      await set(newScheduleRef, {
        scheduleId: newScheduleRef.key,
        time: selectedDate.toISOString(),
        action: scheduleForm.action,
        temperature: scheduleForm.action === 'ON' ? scheduleForm.temperature : null,
      });
      
      console.log('Đã thêm lịch hẹn mới:', {
        time: selectedDate.toLocaleString('vi-VN'),
        action: scheduleForm.action,
        temperature: scheduleForm.temperature
      });

      setSelectedTime({
        hours: new Date().getHours(),
        minutes: new Date().getMinutes()
      });
      setScheduleForm({
        time: new Date(),
        action: 'ON',
        temperature: 24
      });
      setIsModalVisible(false);
      window.alert('Thành công: Đã thêm lịch hẹn mới');
    } catch (error) {
      console.error('Error adding schedule:', error);
      window.alert('Lỗi: Không thể thêm lịch hẹn');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa lịch hẹn này?')) {
      setIsLoading(true);
      const db = getDatabase();
      const scheduleRef = ref(db, `airConditioner/schedules/${id}`);
      
      try {
        await remove(scheduleRef);
        window.alert('Thành công: Đã xóa lịch hẹn');
      } catch (error) {
        console.error('Error deleting schedule:', error);
        window.alert('Lỗi: Không thể xóa lịch hẹn');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const formatTime = (timeString) => {
    const date = new Date(timeString);
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatRemainingTime = (scheduleTime) => {
    const now = new Date();
    const scheduledTime = new Date(scheduleTime);
    const diffInSeconds = Math.floor((scheduledTime.getTime() - now.getTime()) / 1000);
    
    if (diffInSeconds < 0) {
      // Nếu đã qua thời gian, thực hiện ngay lập tức
      checkAndExecuteSchedules();
      return 'Đã qua';
    }

    const hours = Math.floor(diffInSeconds / 3600);
    const minutes = Math.floor((diffInSeconds % 3600) / 60);
    const seconds = diffInSeconds % 60;

    let timeString = '';
    
    if (hours > 0) {
      timeString = `Còn ${hours} giờ ${minutes} phút`;
    } else if (minutes > 0) {
      timeString = `Còn ${minutes} phút ${seconds} giây`;
    } else {
      timeString = `Còn ${seconds} giây`;
    }

    return timeString;
  };

  const renderTimePicker = () => {
    return (
      <View style={styles.timePickerContainer}>
        <Text style={styles.timePickerLabel}>Chọn thời gian:</Text>
        <View style={styles.timePickerRow}>
          {/* Giờ */}
          <View style={styles.timePickerColumn}>
            <Text style={styles.timePickerHeader}>Giờ</Text>
            <ScrollView 
              style={styles.timePickerScroll}
              showsVerticalScrollIndicator={false}
            >
              {hours.map((hour) => (
                <TouchableOpacity
                  key={`hour-${hour}`}
                  style={[
                    styles.timePickerItem,
                    selectedTime.hours === hour && styles.timePickerItemSelected
                  ]}
                  onPress={() => {
                    setSelectedTime(prev => ({...prev, hours: hour}));
                    handleTimeSelect();
                  }}
                >
                  <Text style={[
                    styles.timePickerItemText,
                    selectedTime.hours === hour && styles.timePickerItemTextSelected
                  ]}>
                    {hour.toString().padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Phút */}
          <View style={styles.timePickerColumn}>
            <Text style={styles.timePickerHeader}>Phút</Text>
            <ScrollView 
              style={styles.timePickerScroll}
              showsVerticalScrollIndicator={false}
            >
              {minutes.map((minute) => (
                <TouchableOpacity
                  key={`minute-${minute}`}
                  style={[
                    styles.timePickerItem,
                    selectedTime.minutes === minute && styles.timePickerItemSelected
                  ]}
                  onPress={() => {
                    setSelectedTime(prev => ({...prev, minutes: minute}));
                    handleTimeSelect();
                  }}
                >
                  <Text style={[
                    styles.timePickerItemText,
                    selectedTime.minutes === minute && styles.timePickerItemTextSelected
                  ]}>
                    {minute.toString().padStart(2, '0')}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>
    );
  };

  const formatTimeForInput = (date) => {
    return date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const formatDuration = (minutes) => {
    if (minutes < 60) {
      return `${minutes} phút`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} giờ`;
    }
    return `${hours} giờ ${remainingMinutes} phút`;
  };

  const renderActionButtons = () => {
    return (
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            scheduleForm.action === 'ON' && styles.actionButtonActive
          ]}
          onPress={() => setScheduleForm(prev => ({...prev, action: 'ON'}))}
        >
          <Text style={[
            styles.actionButtonText,
            scheduleForm.action === 'ON' && styles.actionButtonTextActive
          ]}>
            Bật
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.actionButton,
            scheduleForm.action === 'OFF' && styles.actionButtonActive
          ]}
          onPress={() => setScheduleForm(prev => ({...prev, action: 'OFF'}))}
        >
          <Text style={[
            styles.actionButtonText,
            scheduleForm.action === 'OFF' && styles.actionButtonTextActive
          ]}>
            Tắt
          </Text>
        </TouchableOpacity>
      </View>
    );
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
          <Text style={styles.title}>Lịch trình máy lạnh</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setIsModalVisible(true)}
          >
            <Text style={styles.iconText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.clockContainer}>
          <Text style={styles.clockTime}>
            {currentTime.toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: false
            })}
          </Text>
          <Text style={styles.clockDate}>
            {currentTime.toLocaleDateString('vi-VN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#81b0ff" />
          </View>
        )}

        <ScrollView style={styles.scheduleList}>
          {schedules.map((schedule) => (
            <View key={schedule.id} style={styles.scheduleItem}>
              <View style={styles.scheduleInfo}>
                <Text style={styles.scheduleTime}>
                  {formatTime(schedule.time)}
                </Text>
                <Text style={styles.scheduleAction}>
                  {schedule.action === 'ON' 
                    ? `Bật máy lạnh (${schedule.temperature}°C)`
                    : 'Tắt máy lạnh'}
                </Text>
                <Text style={[
                  styles.remainingTime,
                  new Date(schedule.time) < new Date() && styles.remainingTimePast
                ]}>
                  {formatRemainingTime(schedule.time)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDeleteSchedule(schedule.id)}
                disabled={isLoading}
              >
                <Text style={styles.deleteIconText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <Modal
          visible={isModalVisible}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Thêm lịch trình mới</Text>
                <TouchableOpacity
                  onPress={() => setIsModalVisible(false)}
                >
                  <Text style={styles.iconText}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>Chọn thời gian:</Text>
              {renderTimePicker()}

              {renderActionButtons()}

              {scheduleForm.action === 'ON' && (
                <View style={styles.temperatureContainer}>
                  <Text style={styles.temperatureLabel}>Nhiệt độ:</Text>
                  <View style={styles.temperatureControls}>
                    <TouchableOpacity
                      style={styles.tempButton}
                      onPress={() => setScheduleForm(prev => ({
                        ...prev,
                        temperature: Math.max(18, prev.temperature - 1)
                      }))}
                    >
                      <Text style={styles.iconText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.temperatureValue}>
                      {scheduleForm.temperature}°C
                    </Text>
                    <TouchableOpacity
                      style={styles.tempButton}
                      onPress={() => setScheduleForm(prev => ({
                        ...prev,
                        temperature: Math.min(30, prev.temperature + 1)
                      }))}
                    >
                      <Text style={styles.iconText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  (!selectedTime.hours && !selectedTime.minutes) && styles.saveButtonDisabled
                ]}
                onPress={handleAddSchedule}
                disabled={(!selectedTime.hours && !selectedTime.minutes) || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    Lưu
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    elevation: 2,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    padding: 8,
  },
  scheduleList: {
    flex: 1,
    padding: 16,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 1,
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  scheduleAction: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  timePickerContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 15,
  },
  timePickerLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 150,
  },
  timePickerColumn: {
    flex: 1,
    marginHorizontal: 5,
  },
  timePickerHeader: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  timePickerScroll: {
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  timePickerItem: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timePickerItemSelected: {
    backgroundColor: '#81b0ff',
  },
  timePickerItemText: {
    fontSize: 16,
    color: '#333',
  },
  timePickerItemTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 20,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  actionButtonActive: {
    backgroundColor: '#81b0ff',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#666',
  },
  actionButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  temperatureContainer: {
    marginBottom: 16,
  },
  temperatureLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  temperatureControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tempButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  temperatureValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginHorizontal: 16,
  },
  saveButton: {
    backgroundColor: '#81b0ff',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  clockContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
    elevation: 2,
  },
  clockTime: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  clockDate: {
    fontSize: 16,
    color: '#666',
  },
  remainingTime: {
    fontSize: 14,
    color: '#81b0ff',
    marginTop: 4,
  },
  remainingTimePast: {
    color: '#ff4444',
  },
  iconText: {
    fontSize: 24,
    color: '#81b0ff',
  },
  deleteIconText: {
    fontSize: 24,
    color: '#ff4444',
  },
});

export default Schedule; 