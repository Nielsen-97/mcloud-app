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

// Maps localIdentifier -> the modificationTimestamp it had when last
// uploaded. `null` means "uploaded, but we don't know what its
// modificationTimestamp was at the time" — used only for entries migrated
// from the old format below, so an edit made before this update shipped
// isn't retroactively (and incorrectly) treated as needing a re-upload.
type UploadedMap = Record<string, number | null>;

async function loadUploadedMap(): Promise<UploadedMap> {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.uploadedLocalIds);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Old format: a plain array of localIdentifiers, no modification
      // timestamp recorded. We can't know what each photo looked like at
      // upload time, so mark these "synced, baseline unknown" instead of
      // treating a missing baseline as "needs re-upload" — the latter would
      // mass re-upload the user's entire existing library on the first
      // sync after this update, which is exactly the duplicate-upload bug
      // this app already had and fixed once. Edits made *before* this
      // update shipped won't be caught retroactively; every upload from now
      // on records a real timestamp and will be.
      const migrated: UploadedMap = {};
      for (const id of parsed as string[]) migrated[id] = null;
      return migrated;
    }
    return parsed as UploadedMap;
  } catch {
    return {};
  }
}

async function saveUploadedMap(map: UploadedMap): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.uploadedLocalIds, JSON.stringify(map));
}

/** True if this asset has never been uploaded, or was edited (modificationTimestamp changed) since. */
function needsUpload(uploadedMap: UploadedMap, photo: PhotoIdentifier): boolean {
  if (!(photo.node.id in uploadedMap)) return true;
  const uploadedAt = uploadedMap[photo.node.id];
  if (uploadedAt === null) return false;
  return uploadedAt !== photo.node.modificationTimestamp;
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
 * Scans the camera roll, uploads every photo that's either never been
 * uploaded or has been edited since its last upload (same localIdentifier,
 * changed modificationTimestamp — e.g. edited in the Photos app), and
 * persists the moment each upload succeeds so a crash/kill mid-sync can
 * never cause a re-upload.
 */
async function runSync(onProgress?: SyncProgressListener): Promise<SyncProgress> {
  const uploadedMap = await loadUploadedMap();
  const allPhotos = await getAllPhotos();
  const pending = allPhotos.filter(photo => needsUpload(uploadedMap, photo));
  const modTimestampById = new Map(pending.map(photo => [photo.node.id, photo.node.modificationTimestamp]));

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
        localIdentifier: photo.node.id,
      });
    },
    onItemDone: async id => {
      uploadedMap[id] = modTimestampById.get(id) ?? null;
      result.uploaded += 1;
      onProgress?.({ ...result });
      // Persist after every single item, not batched — background-fetch
      // runs are frequently cut off by the OS mid-sync, and any upload
      // whose id wasn't yet flushed gets silently re-uploaded next run.
      await saveUploadedMap(uploadedMap);
    },
    onItemFailed: (id, error) => {
      // Left out of uploadedMap on purpose — will retry on next sync pass.
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
  const uploadedMap = await loadUploadedMap();
  const allPhotos = await getAllPhotos();
  return allPhotos.filter(photo => needsUpload(uploadedMap, photo)).length;
}
