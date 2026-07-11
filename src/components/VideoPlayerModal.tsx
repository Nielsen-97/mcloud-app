import React from 'react';
import { Modal, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import Video from 'react-native-video';
import { viewUrl } from '../api/client';
import { COLORS } from '../config';
import type { MCloudFile } from '../types';

interface Props {
  file: MCloudFile | null;
  onClose: () => void;
}

export default function VideoPlayerModal({ file, onClose }: Props) {
  if (!file) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <Video
          source={{ uri: viewUrl(file.filename) }}
          style={styles.video}
          resizeMode="contain"
          controls
          onError={onClose}
        />
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeText}>Luk</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  video: { width: '100%', height: '100%' },
  closeButton: { position: 'absolute', top: 48, left: 16, padding: 8 },
  closeText: { color: COLORS.text, fontWeight: '600', fontSize: 16 },
});
