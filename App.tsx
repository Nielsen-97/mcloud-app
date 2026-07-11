import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import GalleryScreen from './src/screens/GalleryScreen';

const SERVER_URL = 'https://mcloud.taile49ac8.ts.net';
const Tab = createBottomTabNavigator();

function MainApp() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: { backgroundColor: '#161618', borderTopColor: '#2a2a2e' },
          tabBarActiveTintColor: '#4ade80',
          tabBarInactiveTintColor: '#6b6b72',
          headerStyle: { backgroundColor: '#161618' },
          headerTintColor: '#e8e8ea',
        }}>
        <Tab.Screen name="Billeder" component={GalleryScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('session').then(val => {
      if (val) setLoggedIn(true);
    });
  }, []);

  const login = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `username=${username}&password=${password}`,
        credentials: 'include',
      });
      if (res.ok) {
        await AsyncStorage.setItem('session', 'true');
        setLoggedIn(true);
      } else {
        Alert.alert('Fejl', 'Forkert brugernavn eller password');
      }
    } catch (e) {
      Alert.alert('Fejl', 'Kunne ikke forbinde til serveren');
    }
    setLoading(false);
  };

  if (loggedIn) return <MainApp />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MCloud</Text>
      <TextInput
        style={styles.input}
        placeholder="Brugernavn"
        placeholderTextColor="#6b6b72"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#6b6b72"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.button} onPress={login} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Log ind</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0f0f11' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#4ade80', marginBottom: 32, textAlign: 'center' },
  input: { backgroundColor: '#1e1e21', color: '#e8e8ea', padding: 14, borderRadius: 10, marginBottom: 12, fontSize: 15 },
  button: { backgroundColor: '#1D9E75', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});