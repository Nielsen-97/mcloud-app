import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, SectionList, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import FileViewer from 'react-native-file-viewer';
import * as api from '../api/client';
import { authHeaders, downloadUrl } from '../api/client';
import { COLORS, STORAGE_KEYS } from '../config';
import {
  iconForFilename, formatBytes, categoryForFilename, DOCUMENT_CATEGORY_ORDER,
} from '../utils/fileIcons';
import { parseServerDate } from '../utils/date';
import type { MCloudFile } from '../types';

const CACHE_KEY = STORAGE_KEYS.cachedFiles('dokument');

export default function DocumentScreen() {
  const [files, setFiles] = useState<MCloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [openingId, setOpeningId] = useState<number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.getFiles({ type: 'dokument' });
      setFiles(data);
      setOffline(false);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      setOffline(true);
    }
    setLoading(false);
    if (isRefresh) setRefreshing(false);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then(cached => {
      if (cached) {
        setFiles(JSON.parse(cached));
        setLoading(false);
      }
    });
    load();
  }, [load]);

  const openFile = async (file: MCloudFile) => {
    setOpeningId(file.id);
    try {
      const dest = `${RNFS.TemporaryDirectoryPath}/${file.original_name}`;
      await RNFS.downloadFile({
        fromUrl: downloadUrl(file.filename),
        toFile: dest,
        headers: authHeaders(),
      }).promise;
      await FileViewer.open(dest);
    } catch {
      Alert.alert('Fejl', 'Kunne ikke åbne filen');
    }
    setOpeningId(null);
  };

  const sections = useMemo(() => {
    const byCategory = new Map<string, MCloudFile[]>();
    for (const file of files) {
      const category = categoryForFilename(file.original_name);
      const list = byCategory.get(category) ?? [];
      list.push(file);
      byCategory.set(category, list);
    }
    return DOCUMENT_CATEGORY_ORDER
      .filter(category => byCategory.has(category))
      .map(category => ({ title: category, data: byCategory.get(category)! }));
  }, [files]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {offline && files.length > 0 && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline — viser cachede dokumenter</Text>
        </View>
      )}
      <SectionList
        sections={sections}
        keyExtractor={item => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.accent} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>Ingen dokumenter endnu</Text>}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => openFile(item)} disabled={openingId === item.id}>
            <Text style={styles.icon}>{iconForFilename(item.original_name)}</Text>
            <View style={styles.info}>
              <Text style={styles.filename} numberOfLines={1}>{item.original_name}</Text>
              <Text style={styles.meta}>
                {formatBytes(item.size)} · {parseServerDate(item.upload_date).toLocaleDateString('da-DK')}
              </Text>
            </View>
            {openingId === item.id && <ActivityIndicator color={COLORS.accent} />}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  offlineBanner: {
    backgroundColor: '#3a2020', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  offlineText: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  sectionHeader: {
    color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase',
    backgroundColor: COLORS.background, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  icon: { fontSize: 28, marginRight: 14 },
  info: { flex: 1 },
  filename: { color: COLORS.text, fontSize: 15, fontWeight: '500' },
  meta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  emptyText: { color: COLORS.textMuted, fontSize: 14, textAlign: 'center', marginTop: 40 },
});
