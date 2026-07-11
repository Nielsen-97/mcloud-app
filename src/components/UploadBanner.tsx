import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSync } from '../context/SyncContext';
import { COLORS } from '../config';

export default function UploadBanner() {
  const { syncing, uploaded, total, isOffline } = useSync();

  if (!syncing && !isOffline) return null;

  return (
    <View style={[styles.banner, isOffline && styles.offline]}>
      <Text style={styles.text}>
        {isOffline
          ? 'Offline — viser cachede filer'
          : `Synkroniserer billeder… ${uploaded}/${total}`}
      </Text>
      {syncing && total > 0 && (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round((uploaded / total) * 100)}%` }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: COLORS.sidebar,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  offline: {
    backgroundColor: '#3a2020',
  },
  text: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  track: {
    height: 3,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    backgroundColor: COLORS.accent,
  },
});
