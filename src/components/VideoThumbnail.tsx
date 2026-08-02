import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Text } from 'react-native';
import RNFS from 'react-native-fs';
import { createThumbnail } from 'react-native-create-thumbnail';
import { authHeaders, viewUrl } from '../api/client';
import { COLORS } from '../config';

const thumbnailCache = new Map<string, string>();

// react-native-create-thumbnail writes into a transient OS-managed cache dir
// that isn't guaranteed to survive an app restart, and the in-memory Map
// above never does — meaning every video's thumbnail was being regenerated
// (which means downloading enough of the remote video to decode a frame)
// on every single cold launch, for every video in the list. Copying the
// result into our own stable caches directory and checking for it there
// before regenerating means it only has to happen once per video, ever.
const THUMB_DIR = `${RNFS.CachesDirectoryPath}/video-thumbs`;

function localThumbPath(filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${THUMB_DIR}/${safe}.jpg`;
}

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
    (async () => {
      const dest = localThumbPath(filename);
      try {
        if (await RNFS.exists(dest)) {
          if (!cancelled) {
            thumbnailCache.set(filename, dest);
            setPath(dest);
          }
          return;
        }
      } catch {
        // fall through to regenerating below
      }
      try {
        const result = await createThumbnail({ url: viewUrl(filename), headers: authHeaders(), timeStamp: 1000 });
        if (cancelled) return;
        let finalPath = result.path;
        try {
          if (!(await RNFS.exists(THUMB_DIR))) {
            await RNFS.mkdir(THUMB_DIR);
          }
          await RNFS.copyFile(result.path, dest);
          finalPath = dest;
        } catch {
          // couldn't persist to our cache dir — still show the thumbnail
          // this once from wherever the library put it.
        }
        thumbnailCache.set(filename, finalPath);
        setPath(finalPath);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
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
