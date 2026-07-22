import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraRoll, type PhotoIdentifier } from '@react-native-camera-roll/camera-roll';
import { STORAGE_KEYS } from '../config';
import * as api from '../api/client';
import { runQueue } from './uploadQueue';

export interface SyncProgress {
  uploaded: number;
  total: number;
  failed: number;
  lastError: string | null;
}

export type SyncProgressListener = (progress: SyncProgress) => void;

async function loadUploadedIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.uploadedLocalIds);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

async function saveUploadedIds(ids: Set<string>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.uploadedLocalIds, JSON.stringify([...ids]));
}

/** Fetches every photo in the camera roll (paged), newest first. */
async function getAllPhotos(): Promise<PhotoIdentifier[]> {
  const all: PhotoIdentifier[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await CameraRoll.getPhotos({
      first: 200,
      after,
      assetType: 'Photos',
      include: ['filename', 'fileExtension', 'imageSize'],
    });
    all.push(...page.edges);
    if (!page.page_info.has_next_page) break;
    after = page.page_info.end_cursor;
  }
  return all;
}

export function isLivePhoto(asset: PhotoIdentifier): boolean {
  return asset.node.subTypes === 'PhotoLive';
}

function mimeTypeFor(asset: PhotoIdentifier): string {
  const ext = asset.node.image.extension?.toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'heic') return 'image/heic';
  return 'image/jpeg';
}

/**
 * Scans the camera roll, uploads every photo whose localIdentifier hasn't
 * been uploaded before, and persists the identifier the moment the upload
 * succeeds so a crash/kill mid-sync can never cause a re-upload.
 */
export async function syncNewPhotos(onProgress?: SyncProgressListener): Promise<SyncProgress> {
  const uploadedIds = await loadUploadedIds();
  const allPhotos = await getAllPhotos();
  const pending = allPhotos.filter(photo => !uploadedIds.has(photo.node.id));

  const result: SyncProgress = {
    uploaded: 0,
    total: pending.length,
    failed: 0,
    lastError: null,
  };
  onProgress?.(result);

  if (pending.length === 0) {
    await AsyncStorage.setItem(STORAGE_KEYS.lastSync, new Date().toISOString());
    return result;
  }

  let sinceLastFlush = 0;

  await runQueue({
    items: pending.map(photo => ({ id: photo.node.id, data: photo })),
    concurrency: 2,
    run: async photo => {
      const filename = photo.node.image.filename ?? `${photo.node.id}.jpg`;
      await api.uploadFile({
        uri: photo.node.image.uri,
        name: filename,
        type: mimeTypeFor(photo),
      });
    },
    onItemDone: id => {
      uploadedIds.add(id);
      result.uploaded += 1;
      sinceLastFlush += 1;
      onProgress?.({ ...result });
    },
    onItemFailed: (id, error) => {
      // Left out of uploadedIds on purpose — will retry on next sync pass.
      const message = error instanceof Error ? error.message : String(error);
      result.failed += 1;
      result.lastError = message;
      console.warn(`MCloud sync: upload failed for ${id}`, error);
      onProgress?.({ ...result });
    },
    onOverallProgress: async () => {
      if (sinceLastFlush >= 10) {
        sinceLastFlush = 0;
        await saveUploadedIds(uploadedIds);
      }
    },
  });

  await saveUploadedIds(uploadedIds);
  await AsyncStorage.setItem(STORAGE_KEYS.lastSync, new Date().toISOString());
  return result;
}

export async function getLastSyncTime(): Promise<Date | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.lastSync);
  return raw ? new Date(raw) : null;
}

export async function getPendingSyncCount(): Promise<number> {
  const uploadedIds = await loadUploadedIds();
  const allPhotos = await getAllPhotos();
  return allPhotos.filter(photo => !uploadedIds.has(photo.node.id)).length;
}
