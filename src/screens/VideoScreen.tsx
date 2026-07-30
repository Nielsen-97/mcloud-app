import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as api from '../api/client';
import { STORAGE_KEYS, COLORS } from '../config';
import DateGroupedGrid, { GRID_THUMB_SIZE } from '../components/DateGroupedGrid';
import VideoPlayerModal from '../components/VideoPlayerModal';
import VideoThumbnail from '../components/VideoThumbnail';
import type { MCloudFile } from '../types';

const CACHE_KEY = STORAGE_KEYS.cachedFiles('video');

export default function VideoScreen() {
  const [files, setFiles] = useState<MCloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState<MCloudFile | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.getFiles({ type: 'video' });
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
          <Text style={styles.offlineText}>Offline — viser cachede videoer</Text>
        </View>
      )}
      <DateGroupedGrid
        files={files}
        renderThumbnail={file => (
          <View style={styles.videoTile}>
            <VideoThumbnail filename={file.filename} size={GRID_THUMB_SIZE} />
            <View style={styles.playIconOverlay}>
              <Text style={styles.playIcon}>▶</Text>
            </View>
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
  offlineBanner: {
    backgroundColor: '#3a2020', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  offlineText: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  videoTile: {
    width: GRID_THUMB_SIZE,
    height: GRID_THUMB_SIZE,
  },
  playIconOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    color: '#fff',
    fontSize: 20,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
});
