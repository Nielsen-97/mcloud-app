import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import { createThumbnail } from 'react-native-create-thumbnail';
import { authHeaders, viewUrl } from '../api/client';
import { COLORS } from '../config';

const thumbnailCache = new Map<string, string>();

interface Props {
  filename: string;
  size: number;
}

export default function VideoThumbnail({ filename, size }: Props) {
  const [path, setPath] = useState<string | null>(thumbnailCache.get(filename) ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (path) return;
    let cancelled = false;
    createThumbnail({ url: viewUrl(filename), headers: authHeaders(), timeStamp: 1000 })
      .then(result => {
        if (cancelled) return;
        thumbnailCache.set(filename, result.path);
        setPath(result.path);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [filename, path]);

  if (path) {
    return <Image source={{ uri: path }} style={{ width: size, height: size, backgroundColor: COLORS.card }} />;
  }

  return (
    <View style={[styles.placeholder, { width: size, height: size }]}>
      <Text style={styles.icon}>{failed ? '🎬' : '⏳'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: { fontSize: 22 },
});
