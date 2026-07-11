import React, { useEffect, useState } from 'react';
import {
  View, FlatList, Image, StyleSheet,
  Text, ActivityIndicator, Dimensions
} from 'react-native';

const SERVER_URL = 'https://mcloud.taile49ac8.ts.net';
const SCREEN_WIDTH = Dimensions.get('window').width;
const IMAGE_SIZE = SCREEN_WIDTH / 3 - 2;

interface MCloudFile {
  id: number;
  filename: string;
  original_name: string;
  upload_date: string;
  filetype: string;
}

export default function GalleryScreen() {
  const [files, setFiles] = useState<MCloudFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/files?type=billede`, {
        credentials: 'include',
      });
      const data = await res.json();
      setFiles(data);
    } catch (e) {
      console.error('Kunne ikke hente filer:', e);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4ade80" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Billeder ({files.length})</Text>
      <FlatList
        data={files}
        keyExtractor={item => item.id.toString()}
        numColumns={3}
        renderItem={({ item }) => (
          <Image
            source={{ uri: `${SERVER_URL}/download/${item.filename}` }}
            style={styles.image}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f11' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f11' },
  header: { color: '#e8e8ea', fontSize: 18, fontWeight: '600', padding: 16 },
  image: { width: IMAGE_SIZE, height: IMAGE_SIZE, margin: 1, backgroundColor: '#1e1e21' },
});