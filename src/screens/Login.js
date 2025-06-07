import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth"; 
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { View, TextInput, TouchableOpacity, Text, StyleSheet, Image, Alert, ImageBackground } from 'react-native';
import { auth } from '../../config'; 
import { useNavigation } from '@react-navigation/native'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 

const LoginScreen = () => {
  const navigation = useNavigation(); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuth = () => {
    console.log('Attempting', isRegistering ? 'registration' : 'login', 'with email:', email);
    
      // Đăng nhập
      signInWithEmailAndPassword(auth, email, password)
        .then(async (userCredential) => {
          const user = userCredential.user;
          console.log('Đăng nhập thành công:', user);
          await AsyncStorage.setItem('isLoggedIn', 'true');
          navigation.navigate('Home');
        })
        .catch((error) => {
          console.error('Error code:', error.code);
          console.error('Error message:', error.message);
          let errorMessage = 'Đã có lỗi xảy ra khi đăng nhập';
          
          switch (error.code) {
            case 'auth/invalid-credential':
              errorMessage = 'Email hoặc mật khẩu không chính xác';
              break;
            case 'auth/invalid-email':
              errorMessage = 'Email không hợp lệ';
              break;
            case 'auth/user-disabled':
              errorMessage = 'Tài khoản đã bị vô hiệu hóa';
              break;
            case 'auth/user-not-found':
              errorMessage = 'Không tìm thấy tài khoản với email này';
              break;
            case 'auth/wrong-password':
              errorMessage = 'Mật khẩu không chính xác';
              break;
            case 'auth/network-request-failed':
              errorMessage = 'Lỗi kết nối mạng';
              break;
            default:
              errorMessage = `Lỗi: ${error.message}`;
          }
          
          window.alert(errorMessage);
        });
    
  };

  return (
    <ImageBackground 
      source={require('../../assets/nen.jpeg')}
      style={styles.backgroundImage}
    >
      <View style={styles.container}>
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/logo.jpg')}
            style={styles.logo}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <Text style={styles.labelText}>Tài khoản:</Text>
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              placeholderTextColor="#DDDDDD"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          
          <View style={styles.inputRow}>
            <Text style={styles.labelText}>Mật khẩu:</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                placeholder="Mật khẩu"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={[styles.input, styles.passwordInput]}
                placeholderTextColor="#DDDDDD"
              />
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.signInButton}
          onPress={handleAuth}
        >
          <Text style={styles.signInText}>{isRegistering ? 'Đăng ký' : 'Đăng nhập'}</Text>
        </TouchableOpacity>


        <TouchableOpacity 
          style={styles.registerButton}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.registerText}>Đăng ký tài khoản mới</Text>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logoContainer: {
    position: 'absolute',
    top: 85,
    zIndex: 1,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'white',
  },
  inputRow: {
    marginBottom: 15,
  },
  labelText: {
    color: '#666',
    marginBottom: 5,
  },
  inputContainer: {
    width: '100%',
    maxWidth: 300,
    backgroundColor: 'white',
    borderRadius: 5,
    padding: 15,
    marginBottom: 3,
    marginTop: 40,
  },
  input: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    marginBottom: 0,
  },
  forgotText: {
    color: '#3498db',
    fontSize: 12,
    marginLeft: 10,
  },
  signInButton: {
    width: '100%',
    maxWidth: 300,
    height: 45,
    backgroundColor: '#7ED321', 
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  switchButton: {
    marginTop: 15,
  },
  switchText: {
    color: 'white',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  registerButton: {
    marginTop: 10,
  },
  registerText: {
    color: 'white',
    fontSize: 16,
    textDecorationLine: 'underline',
  }
});

export default LoginScreen;