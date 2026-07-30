import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../api/client';
import { downloadUrl } from '../api/client';
import { STORAGE_KEYS, COLORS } from '../config';
import DateGroupedGrid from '../components/DateGroupedGrid';
import Lightbox from '../components/Lightbox';
import type { MCloudFile } from '../types';

const CACHE_KEY = STORAGE_KEYS.cachedFiles('billede');

export default function GalleryScreen() {
  const [files, setFiles] = useState<MCloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState<MCloudFile | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.getFiles({ type: 'billede' });
      setFiles(data);
      setOffline(false);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      setOffline(true);
      // keep whatever's already shown (cache loaded on mount, or the last successful fetch)
    }
    setLoading(false);
    if (isRefresh) setRefreshing(false);
  }, []);

  useEffect(() => {
    // Show cached data the instant it's read (no network round-trip needed
    // for that), instead of blocking the first paint on the network fetch —
    // the fetch below still runs immediately after and silently replaces it.
    AsyncStorage.getItem(CACHE_KEY).then(cached => {
      if (cached) {
        setFiles(JSON.parse(cached));
        setLoading(false);
      }
    });
    load();
  }, [load]);

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
          <Text style={styles.offlineText}>Offline — viser cachede billeder</Text>
        </View>
      )}
      <DateGroupedGrid
        files={files}
        thumbnailUri={file => downloadUrl(file.filename)}
        onPress={setSelected}
        refreshing={refreshing}
        onRefresh={() => load(true)}
      />
      <Lightbox file={selected} onClose={() => setSelected(null)} />
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
});
