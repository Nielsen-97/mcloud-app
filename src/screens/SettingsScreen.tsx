import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Alert,
  Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as api from '../api/client';
import { COLORS } from '../config';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { formatBytes } from '../utils/fileIcons';
import { getPendingSyncCount } from '../services/photoSync';
import { getBackgroundFetchStatus } from '../services/backgroundSync';
import { getSessionCookieNames } from '../services/sessionCookie';
import type { AdminStats, BackupStatus, FileStats, StorageStats } from '../types';

const ADMIN_USERNAME = 'mathias';

type UserModalMode = 'create' | 'reset' | null;

export default function SettingsScreen() {
  const { username, logout } = useAuth();
  const { syncing, uploaded, total, failed, lastError, lastSync, triggerSync } = useSync();
  const [storage, setStorage] = useState<StorageStats | null>(null);
  const [stats, setStats] = useState<FileStats | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [backgroundFetchStatus, setBackgroundFetchStatus] = useState<string | null>(null);
  const isAdmin = username === ADMIN_USERNAME;

  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<string[]>([]);
  const [backup, setBackup] = useState<BackupStatus | null>(null);
  const [adminUnavailable, setAdminUnavailable] = useState(false);

  const [userModalMode, setUserModalMode] = useState<UserModalMode>(null);
  const [modalUsername, setModalUsername] = useState('');
  const [modalPassword, setModalPassword] = useState('');
  const [savingUser, setSavingUser] = useState(false);

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
    getBackgroundFetchStatus().then(setBackgroundFetchStatus);
    setLoading(false);
  }, []);

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [statsData, usersData, backupData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getBackupStatus(),
      ]);
      setAdminStats(statsData);
      setUsers(usersData);
      setBackup(backupData);
      setAdminUnavailable(false);
    } catch {
      setAdminUnavailable(true);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
    loadAdminData();
  }, [load, loadAdminData]);

  const handleLogout = () => {
    Alert.alert('Log ud', 'Er du sikker på at du vil logge ud?', [
      { text: 'Annuller', style: 'cancel' },
      { text: 'Log ud', style: 'destructive', onPress: logout },
    ]);
  };

  const openCreateUser = () => {
    setModalUsername('');
    setModalPassword('');
    setUserModalMode('create');
  };

  const openResetPassword = (targetUsername: string) => {
    setModalUsername(targetUsername);
    setModalPassword('');
    setUserModalMode('reset');
  };

  const closeUserModal = () => setUserModalMode(null);

  const submitUserModal = async () => {
    if (!modalUsername.trim() || !modalPassword) return;
    setSavingUser(true);
    try {
      if (userModalMode === 'create') {
        await api.createUser(modalUsername.trim(), modalPassword);
        setUsers(await api.getAdminUsers());
      } else if (userModalMode === 'reset') {
        await api.resetPassword(modalUsername.trim(), modalPassword);
      }
      closeUserModal();
    } catch (error: any) {
      Alert.alert('Fejl', error?.status === 400 ? 'Brugeren findes allerede' : 'Handlingen fejlede');
    }
    setSavingUser(false);
  };

  const confirmDeleteUser = (targetUsername: string) => {
    Alert.alert('Slet bruger', `Slet brugeren "${targetUsername}"?`, [
      { text: 'Annuller', style: 'cancel' },
      {
        text: 'Slet',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteUser(targetUsername);
            setUsers(prev => prev.filter(u => u !== targetUsername));
          } catch {
            Alert.alert('Fejl', 'Kunne ikke slette brugeren');
          }
        },
      },
    ]);
  };

  const usedFraction = storage && storage.total > 0 ? storage.used / storage.total : 0;
  const adminDiskFraction = adminStats && adminStats.disk_total > 0
    ? adminStats.disk_used / adminStats.disk_total
    : 0;

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
        {backgroundFetchStatus && backgroundFetchStatus !== 'available' && (
          <Text style={styles.errorText}>
            Baggrundsopdatering er {backgroundFetchStatus === 'denied' ? 'deaktiveret' : 'begrænset'} for MCloud
            i iOS-indstillinger — automatisk synkronisering i baggrunden virker ikke før dette slås til
            (Indstillinger → MCloud → Baggrundsopdatering).
          </Text>
        )}
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

      {isAdmin && (
        <>
          <View style={styles.card}>
            <Text style={styles.label}>System</Text>
            {adminUnavailable ? (
              <Text style={styles.debugText}>Admin-data ikke tilgængelig lige nu.</Text>
            ) : adminStats ? (
              <>
                <View style={styles.storageTrack}>
                  <View style={[styles.storageFill, { width: `${Math.min(adminDiskFraction * 100, 100)}%` }]} />
                </View>
                <Text style={styles.storageText}>
                  {formatBytes(adminStats.disk_used)} af {formatBytes(adminStats.disk_total)} brugt på disk
                </Text>
                <Text style={[styles.value, styles.monoText]}>{adminStats.mem}</Text>
                <Text style={styles.value}>Oppetid: {adminStats.uptime}</Text>
                <Text style={styles.value}>{adminStats.users} brugere · {adminStats.files} filer</Text>
              </>
            ) : (
              <ActivityIndicator color={COLORS.accent} />
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.label}>Brugere ({users.length})</Text>
              <TouchableOpacity onPress={openCreateUser}>
                <Text style={styles.linkText}>+ Ny bruger</Text>
              </TouchableOpacity>
            </View>
            {users.map(u => (
              <View key={u} style={styles.userRow}>
                <Text style={styles.value}>{u}</Text>
                <View style={styles.userRowActions}>
                  <TouchableOpacity onPress={() => openResetPassword(u)}>
                    <Text style={styles.linkText}>Nyt password</Text>
                  </TouchableOpacity>
                  {u !== username && (
                    <TouchableOpacity onPress={() => confirmDeleteUser(u)}>
                      <Text style={[styles.linkText, styles.deleteLinkText]}>Slet</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Backup (rclone)</Text>
            {backup ? (
              <>
                <Text style={styles.value}>
                  {backup.configured ? 'Sat op' : 'Ikke sat op endnu'}
                </Text>
                {backup.log ? (
                  <Text style={[styles.debugText, styles.monoText]} numberOfLines={20}>{backup.log}</Text>
                ) : (
                  <Text style={styles.debugText}>Ingen log endnu</Text>
                )}
              </>
            ) : (
              <Text style={styles.debugText}>Ikke tilgængelig</Text>
            )}
          </View>
        </>
      )}

      <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
        <Text style={styles.buttonText}>Log ud</Text>
      </TouchableOpacity>

      <Modal visible={userModalMode !== null} transparent animationType="slide" onRequestClose={closeUserModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={60}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {userModalMode === 'create' ? 'Ny bruger' : `Nyt password til ${modalUsername}`}
            </Text>
            {userModalMode === 'create' && (
              <TextInput
                style={styles.input}
                placeholder="Brugernavn"
                placeholderTextColor={COLORS.textMuted}
                value={modalUsername}
                onChangeText={setModalUsername}
                autoCapitalize="none"
              />
            )}
            <TextInput
              style={[styles.input, styles.inputSpaced]}
              placeholder="Password"
              placeholderTextColor={COLORS.textMuted}
              value={modalPassword}
              onChangeText={setModalPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={closeUserModal}>
                <Text style={styles.modalButtonText}>Annuller</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={submitUserModal}
                disabled={savingUser}>
                <Text style={styles.modalButtonText}>{savingUser ? 'Gemmer…' : 'Gem'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  monoText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 },
  storageTrack: { height: 8, backgroundColor: COLORS.card, borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  storageFill: { height: 8, backgroundColor: COLORS.accent },
  storageText: { color: COLORS.textMuted, fontSize: 12 },
  errorText: { color: COLORS.red, fontSize: 12, marginBottom: 4 },
  statsRow: { flexDirection: 'row', gap: 20 },
  statItem: { color: COLORS.text, fontSize: 15 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  linkText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
  deleteLinkText: { color: COLORS.red },
  userRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  userRowActions: { flexDirection: 'row', gap: 16 },
  button: {
    backgroundColor: COLORS.accentDark, padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 12,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  logoutButton: { backgroundColor: COLORS.red },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.sidebar, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: { backgroundColor: COLORS.card, color: COLORS.text, padding: 12, borderRadius: 10, fontSize: 15 },
  inputSpaced: { marginTop: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  modalButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  modalButtonPrimary: { backgroundColor: COLORS.accentDark },
  modalButtonText: { color: COLORS.text, fontWeight: '600' },
});
