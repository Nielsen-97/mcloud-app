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

/** Fetches every photo AND video in the camera roll (paged), newest first. */
async function getAllPhotos(): Promise<PhotoIdentifier[]> {
  const all: PhotoIdentifier[] = [];
  let after: string | undefined;
  for (;;) {
    const page = await CameraRoll.getPhotos({
      first: 200,
      after,
      assetType: 'All',
      include: ['filename', 'fileExtension', 'imageSize', 'fileSize'],
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

const VIDEO_MIME_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
};

function mimeTypeFor(asset: PhotoIdentifier): string {
  const ext = asset.node.image.extension?.toLowerCase();
  if (asset.node.type === 'video') {
    return (ext && VIDEO_MIME_TYPES[ext]) || 'video/mp4';
  }
  if (ext === 'png') return 'image/png';
  if (ext === 'heic') return 'image/heic';
  return 'image/jpeg';
}

// There are five independent ways syncNewPhotos() can be triggered (manual
// button, app-foreground, network-reconnect, the WiFi listener, and the
// background-fetch task) and only three of them share a guard in
// SyncContext. Without a lock at THIS layer, two overlapping runs both read
// the same "already uploaded" set before either has persisted anything, and
// both upload the same batch — this was the actual cause of the duplicate
// uploads (3580 -> 6006) and the erratic progress counter (two runs writing
// into the same UI state). A single-flight lock here guarantees only one
// real sync ever executes, no matter which caller (or how many at once)
// asked for one.
let syncInFlight: Promise<SyncProgress> | null = null;

export function syncNewPhotos(onProgress?: SyncProgressListener): Promise<SyncProgress> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = runSync(onProgress).finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

/**
 * Scans the camera roll, uploads every photo whose localIdentifier hasn't
 * been uploaded before, and persists the identifier the moment the upload
 * succeeds so a crash/kill mid-sync can never cause a re-upload.
 */
async function runSync(onProgress?: SyncProgressListener): Promise<SyncProgress> {
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

  await runQueue({
    items: pending.map(photo => ({ id: photo.node.id, data: photo })),
    concurrency: 2,
    run: async photo => {
      const filename = photo.node.image.filename ?? `${photo.node.id}.jpg`;
      await api.uploadFile({
        uri: photo.node.image.uri,
        name: filename,
        type: mimeTypeFor(photo),
        sizeBytes: photo.node.image.fileSize,
      });
    },
    onItemDone: async id => {
      uploadedIds.add(id);
      result.uploaded += 1;
      onProgress?.({ ...result });
      // Persist after every single item, not batched — background-fetch
      // runs are frequently cut off by the OS mid-sync, and any upload
      // whose id wasn't yet flushed gets silently re-uploaded next run.
      await saveUploadedIds(uploadedIds);
    },
    onItemFailed: (id, error) => {
      // Left out of uploadedIds on purpose — will retry on next sync pass.
      const message = error instanceof Error ? error.message : String(error);
      result.failed += 1;
      result.lastError = message;
      console.warn(`MCloud sync: upload failed for ${id}`, error);
      onProgress?.({ ...result });
    },
  });

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
