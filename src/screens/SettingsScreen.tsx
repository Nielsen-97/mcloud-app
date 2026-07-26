import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import * as api from '../api/client';
import { COLORS } from '../config';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { formatBytes } from '../utils/fileIcons';
import { getPendingSyncCount } from '../services/photoSync';
import { getSessionCookieNames } from '../services/sessionCookie';
import type { FileStats, StorageStats } from '../types';

export default function SettingsScreen() {
  const { username, logout } = useAuth();
  const { syncing, uploaded, total, failed, lastError, lastSync, triggerSync } = useSync();
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [stats, setStats] = useState<FileStats | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [storageData, statsData] = await Promise.all([api.getStorage(), api.getStats()]);
      setStorage(storageData);
      setStats(statsData);
    } catch {
      // best-effort — leave existing values if server unreachable
    }
    getPendingSyncCount().then(setPending).catch(() => setPending(null));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleLogout = () => {
    Alert.alert('Log ud', 'Er du sikker på at du vil logge ud?', [
      { text: 'Annuller', style: 'cancel' },
      { text: 'Log ud', style: 'destructive', onPress: logout },
    ]);
  };

  const usedFraction = storage && storage.total > 0 ? storage.used / storage.total : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.label}>Logget ind som</Text>
        <Text style={styles.value}>{username ?? 'ukendt'}</Text>
        <Text style={styles.debugText}>
          Session-cookie: {getSessionCookieNames().join(', ') || 'ingen'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Diskforbrug</Text>
        {loading ? (
          <ActivityIndicator color={COLORS.accent} />
        ) : storage ? (
          <>
            <View style={styles.storageTrack}>
              <View style={[styles.storageFill, { width: `${Math.min(usedFraction * 100, 100)}%` }]} />
            </View>
            <Text style={styles.storageText}>
              {formatBytes(storage.used)} af {formatBytes(storage.total)} brugt · {formatBytes(storage.free)} fri
            </Text>
          </>
        ) : (
          <Text style={styles.value}>Ikke tilgængeligt</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Filer</Text>
        <View style={styles.statsRow}>
          <Text style={styles.statItem}>📷 {stats?.billede ?? 0}</Text>
          <Text style={styles.statItem}>🎬 {stats?.video ?? 0}</Text>
          <Text style={styles.statItem}>📄 {stats?.dokument ?? 0}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Synkronisering</Text>
        <Text style={styles.value}>
          {lastSync ? `Sidst synkroniseret: ${lastSync.toLocaleString('da-DK')}` : 'Endnu ikke synkroniseret'}
        </Text>
        <Text style={styles.value}>
          {pending != null ? `${pending} billeder i kø` : ''}
        </Text>
        {syncing && (
          <Text style={styles.value}>
            Synkroniserer {uploaded}/{total}{failed > 0 ? ` (${failed} fejlet)` : ''}…
          </Text>
        )}
        {lastError && (
          <Text style={styles.errorText} numberOfLines={3}>Sidste fejl: {lastError}</Text>
        )}
        <TouchableOpacity style={styles.button} onPress={triggerSync} disabled={syncing}>
          <Text style={styles.buttonText}>{syncing ? 'Synkroniserer…' : 'Synkroniser nu'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
        <Text style={styles.buttonText}>Log ud</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: COLORS.sidebar, borderRadius: 12, padding: 16, marginBottom: 4 },
  label: { color: COLORS.textMuted, fontSize: 12, textTransform: 'uppercase', marginBottom: 8 },
  value: { color: COLORS.text, fontSize: 15, marginBottom: 4 },
  debugText: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  storageTrack: { height: 8, backgroundColor: COLORS.card, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  storageFill: { height: 8, backgroundColor: COLORS.accent },
  storageText: { color: COLORS.textMuted, fontSize: 12 },
  errorText: { color: COLORS.red, fontSize: 12, marginBottom: 4 },
  statsRow: { flexDirection: 'row', gap: 20 },
  statItem: { color: COLORS.text, fontSize: 15 },
  button: {
    backgroundColor: COLORS.accentDark, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  logoutButton: { backgroundColor: COLORS.red },
});
