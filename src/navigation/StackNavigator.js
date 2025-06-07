import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/Login';
import RegisterScreen from '../screens/Register';
import Home from '../screens/Home';
import Profile from '../screens/Profile';
import AirConditioner from '../screens/AirConditioner';
import Schedule from '../screens/Schedule';

const Stack = createNativeStackNavigator();

const StackNavigator = () => {
  return (
    <Stack.Navigator 
      initialRouteName="Login"
      screenOptions={{
        headerShown: false
      }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Home" component={Home} />
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="AirConditioner" component={AirConditioner} />
      <Stack.Screen name="Schedule" component={Schedule} />
    </Stack.Navigator>
  );
};

export default StackNavigator;