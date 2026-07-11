import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../api/client';
import { STORAGE_KEYS, COLORS } from '../config';
import DateGroupedGrid, { GRID_THUMB_SIZE } from '../components/DateGroupedGrid';
import VideoPlayerModal from '../components/VideoPlayerModal';
import type { MCloudFile } from '../types';

const CACHE_KEY = STORAGE_KEYS.cachedFiles('video');

export default function VideoScreen() {
  const [files, setFiles] = useState<MCloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<MCloudFile | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const data = await api.getFiles({ type: 'video' });
      setFiles(data);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) setFiles(JSON.parse(cached));
    }
    isRefresh ? setRefreshing(false) : setLoading(false);
  }, []);

  useEffect(() => {
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
      <DateGroupedGrid
        files={files}
        renderThumbnail={file => (
          <View style={styles.videoTile}>
            <Text style={styles.playIcon}>▶</Text>
            <Text style={styles.filename} numberOfLines={1}>{file.original_name}</Text>
          </View>
        )}
        onPress={setSelected}
        refreshing={refreshing}
        onRefresh={() => load(true)}
      />
      <VideoPlayerModal file={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  videoTile: {
    width: GRID_THUMB_SIZE,
    height: GRID_THUMB_SIZE,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  playIcon: { color: COLORS.accent, fontSize: 24, marginBottom: 4 },
  filename: { color: COLORS.textMuted, fontSize: 10, textAlign: 'center' },
});
