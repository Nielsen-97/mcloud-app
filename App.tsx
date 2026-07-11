import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { COLORS } from './src/config';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SyncProvider } from './src/context/SyncContext';
import UploadBanner from './src/components/UploadBanner';

import GalleryScreen from './src/screens/GalleryScreen';
import VideoScreen from './src/screens/VideoScreen';
import DocumentScreen from './src/screens/DocumentScreen';
import AlbumStackNavigator from './src/screens/AlbumStackNavigator';
import SettingsScreen from './src/screens/SettingsScreen';
import type { RootTabParamList } from './src/navigation/types';

const Tab = createBottomTabNavigator<RootTabParamList>();

function MainApp() {
  return (
    <NavigationContainer>
      <UploadBanner />
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: { backgroundColor: COLORS.sidebar, borderTopColor: COLORS.border },
          tabBarActiveTintColor: COLORS.accent,
          tabBarInactiveTintColor: COLORS.textMuted,
          headerStyle: { backgroundColor: COLORS.sidebar },
          headerTintColor: COLORS.text,
        }}>
        <Tab.Screen name="Billeder" component={GalleryScreen} />
        <Tab.Screen name="Videoer" component={VideoScreen} />
        <Tab.Screen name="Dokumenter" component={DocumentScreen} />
        <Tab.Screen name="Albums" component={AlbumStackNavigator} options={{ headerShown: false }} />
        <Tab.Screen name="Indstillinger" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      await login(username, password);
    } catch (e: any) {
      if (e?.status) {
        Alert.alert('Fejl', 'Forkert brugernavn eller password');
      } else {
        Alert.alert('Fejl', 'Kunne ikke forbinde til serveren');
      }
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MCloud</Text>
      <TextInput
        style={styles.input}
        placeholder="Brugernavn"
        placeholderTextColor={COLORS.textMuted}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={COLORS.textMuted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Log ind</Text>}
      </TouchableOpacity>
    </View>
  );
}

function Root() {
  const { loggedIn, checkingSession } = useAuth();

  if (checkingSession) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  if (!loggedIn) return <LoginScreen />;

  return (
    <SyncProvider>
      <MainApp />
    </SyncProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <AuthProvider>
        <Root />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: COLORS.background },
  title: { fontSize: 32, fontWeight: 'bold', color: COLORS.accent, marginBottom: 32, textAlign: 'center' },
  input: {
    backgroundColor: COLORS.card, color: COLORS.text, padding: 14, borderRadius: 10,
    marginBottom: 12, fontSize: 15,
  },
  button: { backgroundColor: COLORS.accentDark, padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
