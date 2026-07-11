import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config';
import * as api from '../api/client';

interface AuthContextValue {
  loggedIn: boolean;
  username: string | null;
  checkingSession: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    (async () => {
      const [session, storedUsername] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.session),
        AsyncStorage.getItem(STORAGE_KEYS.username),
      ]);
      if (session) {
        setLoggedIn(true);
        setUsername(storedUsername);
      }
      setCheckingSession(false);
    })();
  }, []);

  const login = useCallback(async (user: string, password: string) => {
    await api.login(user, password);
    await AsyncStorage.setMany({
      [STORAGE_KEYS.session]: 'true',
      [STORAGE_KEYS.username]: user,
    });
    setUsername(user);
    setLoggedIn(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // best-effort — clear local session regardless of server reachability
    }
    await AsyncStorage.removeMany([STORAGE_KEYS.session, STORAGE_KEYS.username]);
    setLoggedIn(false);
    setUsername(null);
  }, []);

  const value = useMemo(
    () => ({ loggedIn, username, checkingSession, login, logout }),
    [loggedIn, username, checkingSession, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
