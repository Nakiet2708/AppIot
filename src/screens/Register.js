import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { getDatabase, ref, set } from "firebase/database";
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  Image, 
  ImageBackground,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { auth } from '../../config';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const RegisterScreen = () => {
  const navigation = useNavigation();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: ''
  });
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    // Kiểm tra họ tên
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Vui lòng nhập họ tên';
    }

    // Kiểm tra email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = 'Vui lòng nhập email';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Email không hợp lệ';
    }

    // Kiểm tra mật khẩu
    if (!formData.password) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }

    // Kiểm tra xác nhận mật khẩu
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
    }

    // Kiểm tra số điện thoại
    const phoneRegex = /^[0-9]{10}$/;
    if (!formData.phone.trim()) {
      newErrors.phone = 'Vui lòng nhập số điện thoại';
    } else if (!phoneRegex.test(formData.phone)) {
      newErrors.phone = 'Số điện thoại không hợp lệ';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (validateForm()) {
      try {
        // 1. Tạo tài khoản authentication
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;
        
        // 2. Lưu thông tin vào Realtime Database
        const db = getDatabase();
        await set(ref(db, 'users/' + user.uid), {
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          createdAt: new Date().toISOString()
        });

        // 3. Lưu thông tin vào AsyncStorage
        await AsyncStorage.setItem('isLoggedIn', 'true');
        await AsyncStorage.setItem('userProfile', JSON.stringify({
          uid: user.uid,
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone
        }));

        window.alert('Đăng ký thành công!');
        navigation.navigate('Login');
      } catch (error) {
        console.error('Error code:', error.code);
        let errorMessage = 'Đã có lỗi xảy ra khi đăng ký';
        
        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'Email này đã được sử dụng';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Email không hợp lệ';
            break;
          case 'auth/weak-password':
            errorMessage = 'Mật khẩu phải có ít nhất 6 ký tự';
            break;
          default:
            errorMessage = `Lỗi: ${error.message}`;
        }
        
        window.alert(errorMessage);
      }
    }
  };

  return (
    <ImageBackground 
      source={require('../../assets/nen.jpeg')}
      style={styles.backgroundImage}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.formContainer}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/logo.jpg')}
                style={styles.logo}
              />
            </View>
            
            <Text style={styles.title}>Đăng Ký Tài Khoản</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Họ và tên</Text>
              <TextInput
                placeholder="Nhập họ và tên"
                value={formData.fullName}
                onChangeText={(text) => setFormData({...formData, fullName: text})}
                style={styles.input}
              />
              {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}

              <Text style={styles.label}>Email</Text>
              <TextInput
                placeholder="Nhập email"
                value={formData.email}
                onChangeText={(text) => setFormData({...formData, email: text})}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}

              <Text style={styles.label}>Số điện thoại</Text>
              <TextInput
                placeholder="Nhập số điện thoại"
                value={formData.phone}
                onChangeText={(text) => setFormData({...formData, phone: text})}
                style={styles.input}
                keyboardType="phone-pad"
              />
              {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}

              <Text style={styles.label}>Mật khẩu</Text>
              <TextInput
                placeholder="Nhập mật khẩu"
                value={formData.password}
                onChangeText={(text) => setFormData({...formData, password: text})}
                style={styles.input}
                secureTextEntry
              />
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}

              <Text style={styles.label}>Xác nhận mật khẩu</Text>
              <TextInput
                placeholder="Nhập lại mật khẩu"
                value={formData.confirmPassword}
                onChangeText={(text) => setFormData({...formData, confirmPassword: text})}
                style={styles.input}
                secureTextEntry
              />
              {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
            </View>

            <TouchableOpacity 
              style={styles.registerButton}
              onPress={handleRegister}
            >
              <Text style={styles.registerButtonText}>Đăng Ký</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.loginLink}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginLinkText}>Đã có tài khoản? Đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  formContainer: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
  },
  inputContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  input: {
    height: 45,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: -12,
    marginBottom: 10,
  },
  registerButton: {
    width: '100%',
    maxWidth: 400,
    height: 50,
    backgroundColor: '#7ED321',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  registerButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginLink: {
    marginTop: 10,
  },
  loginLinkText: {
    color: 'white',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});

export default RegisterScreen; 