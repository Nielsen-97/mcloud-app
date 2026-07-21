import React, { useCallback, useEffect, useState } from 'react';
import {
  View, StyleSheet, ActivityIndicator, TouchableOpacity, Text, Modal,
  FlatList, Image, Alert, Share as RNShare,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '../api/client';
import { authHeaders, downloadUrl } from '../api/client';
import { COLORS } from '../config';
import DateGroupedGrid, { GRID_THUMB_SIZE } from '../components/DateGroupedGrid';
import Lightbox from '../components/Lightbox';
import type { MCloudFile } from '../types';
import type { AlbumStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AlbumStackParamList, 'AlbumDetail'>;

export default function AlbumDetailScreen({ route, navigation }: Props) {
  const { album } = route.params;
  const [files, setFiles] = useState<MCloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MCloudFile | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [allPhotos, setAllPhotos] = useState<MCloudFile[]>([]);
  const [adding, setAdding] = useState(false);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFiles(await api.getFiles({ albumId: album.id }));
    } catch {
      Alert.alert('Fejl', 'Kunne ikke hente billeder i album');
    }
    setLoading(false);
  }, [album.id]);

  useEffect(() => {
    navigation.setOptions({ title: album.name });
    load();
  }, [load, navigation, album.name]);

  const openPicker = async () => {
    try {
      const photos = await api.getFiles({ type: 'billede' });
      setAllPhotos(photos.filter(p => p.album_id !== album.id));
      setPickerVisible(true);
    } catch {
      Alert.alert('Fejl', 'Kunne ikke hente billeder');
    }
  };

  const addPhoto = async (file: MCloudFile) => {
    setAdding(true);
    try {
      await api.moveToAlbum(file.id, album.id);
      setAllPhotos(prev => prev.filter(p => p.id !== file.id));
      await load();
    } catch {
      Alert.alert('Fejl', 'Kunne ikke tilføje billede til album');
    }
    setAdding(false);
  };

  const shareAlbum = async () => {
    setSharing(true);
    try {
      const url = await api.generateAlbumShareLink(album.id);
      await RNShare.share({ message: url, url });
    } catch {
      Alert.alert(
        'Ikke tilgængelig',
        'Serveren understøtter endnu ikke offentlige delelinks til albums.',
      );
    }
    setSharing(false);
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
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarButton} onPress={openPicker}>
          <Text style={styles.toolbarButtonText}>Tilføj billeder</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.toolbarButton} onPress={shareAlbum} disabled={sharing}>
          <Text style={styles.toolbarButtonText}>{sharing ? 'Genererer…' : 'Del link'}</Text>
        </TouchableOpacity>
      </View>

      <DateGroupedGrid
        files={files}
        thumbnailUri={file => downloadUrl(file.filename)}
        onPress={setSelected}
        refreshing={false}
        onRefresh={load}
      />
      <Lightbox file={selected} onClose={() => setSelected(null)} />

      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Vælg billeder</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)}>
              <Text style={styles.toolbarButtonText}>Luk</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={allPhotos}
            keyExtractor={item => item.id.toString()}
            numColumns={3}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => addPhoto(item)} disabled={adding} style={styles.pickerTile}>
                <Image
                  source={{ uri: downloadUrl(item.filename), headers: authHeaders() }}
                  style={styles.pickerImage}
                />
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>Ingen flere billeder at tilføje</Text>}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  toolbar: {
    flexDirection: 'row', justifyContent: 'space-between', padding: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  toolbarButton: { backgroundColor: COLORS.sidebar, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  toolbarButtonText: { color: COLORS.text, fontWeight: '600', fontSize: 13 },
  pickerContainer: { flex: 1, backgroundColor: COLORS.background },
  pickerHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  pickerTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  pickerTile: { width: GRID_THUMB_SIZE, height: GRID_THUMB_SIZE, margin: 1 },
  pickerImage: { width: '100%', height: '100%', backgroundColor: COLORS.card },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
});
