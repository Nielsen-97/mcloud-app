import React, { useCallback, useEffect, useState } from 'react';
import {
  View, FlatList, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  Image, Modal, TextInput, Switch, Alert, RefreshControl,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '../api/client';
import { downloadUrl } from '../api/client';
import { COLORS } from '../config';
import type { Album, MCloudUser } from '../types';
import type { AlbumStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AlbumStackParamList, 'AlbumList'>;

export default function AlbumListScreen({ navigation }: Props) {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [users, setUsers] = useState<MCloudUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [isShared, setIsShared] = useState(false);
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const [albumData, userData] = await Promise.all([api.getAlbums(), api.getUsers()]);
      setAlbums(albumData);
      setUsers(userData);
    } catch {
      Alert.alert('Fejl', 'Kunne ikke hente albums');
    }
    isRefresh ? setRefreshing(false) : setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSharedUser = (username: string) => {
    setSharedWith(prev =>
      prev.includes(username) ? prev.filter(u => u !== username) : [...prev, username],
    );
  };

  const createAlbum = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await api.createAlbum(name.trim(), isShared, isShared ? sharedWith : []);
      setModalVisible(false);
      setName('');
      setIsShared(false);
      setSharedWith([]);
      await load();
    } catch {
      Alert.alert('Fejl', 'Kunne ikke oprette album');
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={albums}
        keyExtractor={item => item.id.toString()}
        numColumns={2}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.accent} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>Ingen albums endnu</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('AlbumDetail', { album: item })}>
            {item.cover_filename ? (
              <Image source={{ uri: downloadUrl(item.cover_filename) }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverPlaceholder]}>
                <Text style={styles.coverPlaceholderText}>📁</Text>
              </View>
            )}
            <Text style={styles.albumName} numberOfLines={1}>{item.name}</Text>
            {item.is_shared && <Text style={styles.sharedLabel}>Delt</Text>}
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nyt album</Text>
            <TextInput
              style={styles.input}
              placeholder="Navn"
              placeholderTextColor={COLORS.textMuted}
              value={name}
              onChangeText={setName}
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Delt album</Text>
              <Switch value={isShared} onValueChange={setIsShared} trackColor={{ true: COLORS.accentDark }} />
            </View>
            {isShared && (
              <View style={styles.userList}>
                {users.map(u => (
                  <TouchableOpacity
                    key={u.username}
                    style={styles.userRow}
                    onPress={() => toggleSharedUser(u.username)}>
                    <Text style={styles.userName}>{u.username}</Text>
                    <Text style={styles.checkbox}>
                      {sharedWith.includes(u.username) ? '☑' : '☐'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalButtonText}>Annuller</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={createAlbum}
                disabled={creating}>
                <Text style={styles.modalButtonText}>{creating ? 'Opretter…' : 'Opret'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  list: { padding: 8 },
  card: { flex: 1, margin: 6, maxWidth: '46%' },
  cover: { width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: COLORS.card },
  coverPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  coverPlaceholderText: { fontSize: 32 },
  albumName: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginTop: 6 },
  sharedLabel: { color: COLORS.blue, fontSize: 11, marginTop: 2 },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
  fab: {
    position: 'absolute', right: 20, bottom: 24, width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.accentDark, justifyContent: 'center', alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 28, marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: COLORS.sidebar, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: {
    backgroundColor: COLORS.card, color: COLORS.text, padding: 12, borderRadius: 10, fontSize: 15,
  },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  switchLabel: { color: COLORS.text, fontSize: 15 },
  userList: { marginTop: 12, maxHeight: 200 },
  userRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  userName: { color: COLORS.text, fontSize: 14 },
  checkbox: { color: COLORS.accent, fontSize: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  modalButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  modalButtonPrimary: { backgroundColor: COLORS.accentDark },
  modalButtonText: { color: COLORS.text, fontWeight: '600' },
});
