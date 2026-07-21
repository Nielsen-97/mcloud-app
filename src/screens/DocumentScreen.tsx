import React, { useCallback, useEffect, useState } from 'react';
import {
  View, FlatList, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  RefreshControl, Alert,
} from 'react-native';
import RNFS from 'react-native-fs';
import FileViewer from 'react-native-file-viewer';
import * as api from '../api/client';
import { authHeaders, downloadUrl } from '../api/client';
import { COLORS } from '../config';
import { iconForFilename, formatBytes } from '../utils/fileIcons';
import { parseServerDate } from '../utils/date';
import type { MCloudFile } from '../types';

export default function DocumentScreen() {
  const [files, setFiles] = useState<MCloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openingId, setOpeningId] = useState<number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      setFiles(await api.getFiles({ type: 'dokument' }));
    } catch {
      Alert.alert('Fejl', 'Kunne ikke hente dokumenter');
    }
    isRefresh ? setRefreshing(false) : setLoading(false);
  }, []);

  useEffect(() => {
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={files}
      keyExtractor={item => item.id.toString()}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.accent} />
      }
      ListEmptyComponent={<Text style={styles.emptyText}>Ingen dokumenter endnu</Text>}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
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
