import React, { useRef, useState } from 'react';
import {
  Modal, View, Image, StyleSheet, TouchableOpacity, Text,
  PanResponder, Animated, Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authHeaders, downloadUrl } from '../api/client';
import { COLORS } from '../config';
import type { MCloudFile } from '../types';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface Props {
  file: MCloudFile | null;
  onClose: () => void;
}

export default function Lightbox({ file, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [busy, setBusy] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dy) > 10,
      onPanResponderMove: (_evt, gesture) => {
        translateY.setValue(gesture.dy);
        opacity.setValue(1 - Math.min(Math.abs(gesture.dy) / (SCREEN_HEIGHT / 2), 1));
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (Math.abs(gesture.dy) > SCREEN_HEIGHT * 0.2) {
          Animated.timing(translateY, {
            toValue: gesture.dy > 0 ? SCREEN_HEIGHT : -SCREEN_HEIGHT,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            opacity.setValue(1);
            onClose();
          });
        } else {
          Animated.parallel([
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
          ]).start();
        }
      },
    }),
  ).current;

  if (!file) return null;

  const uri = downloadUrl(file.filename);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const dest = `${RNFS.TemporaryDirectoryPath}/${file.original_name}`;
      await RNFS.downloadFile({ fromUrl: uri, toFile: dest, headers: authHeaders() }).promise;
      await CameraRoll.saveAsset(`file://${dest}`, { type: 'photo' });
      Alert.alert('Gemt', 'Billedet er gemt i dit fotobibliotek');
    } catch {
      Alert.alert('Fejl', 'Kunne ikke downloade billedet');
    }
    setBusy(false);
  };

  const handleShare = async () => {
    setBusy(true);
    try {
      const dest = `${RNFS.TemporaryDirectoryPath}/${file.original_name}`;
      await RNFS.downloadFile({ fromUrl: uri, toFile: dest, headers: authHeaders() }).promise;
      await Share.open({ url: `file://${dest}` });
    } catch (error: any) {
      if (error?.message !== 'User did not share') {
        Alert.alert('Fejl', 'Kunne ikke dele billedet');
      }
    }
    setBusy(false);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Animated.View style={[styles.container, { opacity }]}>
        <Animated.View
          style={[styles.imageWrap, { transform: [{ translateY }] }]}
          {...panResponder.panHandlers}>
          <Image
            source={{ uri, headers: authHeaders(), cache: 'force-cache' }}
            style={styles.image}
            resizeMode="contain"
            progressiveRenderingEnabled
          />
        </Animated.View>

        <TouchableOpacity style={[styles.closeButton, { top: insets.top + 8 }]} onPress={onClose}>
          <Text style={styles.actionText}>Luk</Text>
        </TouchableOpacity>

        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.actionButton} onPress={handleDownload} disabled={busy}>
            <Text style={styles.actionText}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare} disabled={busy}>
            <Text style={styles.actionText}>Del</Text>
          </TouchableOpacity>
        </View>

        {busy && (
          <View style={styles.busyOverlay}>
            <ActivityIndicator color={COLORS.accent} size="large" />
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  imageWrap: { flex: 1 },
  image: { flex: 1 },
  closeButton: { position: 'absolute', left: 16, padding: 8 },
  toolbar: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  actionButton: {
    backgroundColor: COLORS.sidebar,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  actionText: { color: COLORS.text, fontWeight: '600' },
  busyOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});
