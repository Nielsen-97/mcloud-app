import { getServerUrl } from '../services/serverUrl';
import type {
  Album,
  FileStats,
  FileType,
  MCloudFile,
  MCloudUser,
  StorageStats,
} from '../types';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getServerUrl()}${path}`, {
    credentials: 'include',
    ...init,
  });
  if (!res.ok) {
    throw new ApiError(res.status, `${init?.method ?? 'GET'} ${path} failed (${res.status})`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  return undefined as unknown as T;
}

export function downloadUrl(filename: string): string {
  return `${getServerUrl()}/download/${filename}`;
}

export function viewUrl(filename: string): string {
  return `${getServerUrl()}/view/${filename}`;
}

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(`${getServerUrl()}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
    credentials: 'include',
  });
  if (!res.ok) {
    throw new ApiError(res.status, 'Forkert brugernavn eller password');
  }
}

export async function logout(): Promise<void> {
  await request('/logout');
}

export async function getFiles(params?: {
  type?: FileType;
  albumId?: number;
}): Promise<MCloudFile[]> {
  const query = new URLSearchParams();
  if (params?.type) query.set('type', params.type);
  if (params?.albumId != null) query.set('album_id', String(params.albumId));
  const qs = query.toString();
  return request<MCloudFile[]>(`/files${qs ? `?${qs}` : ''}`);
}

export async function deleteFile(id: number): Promise<void> {
  await request(`/delete/${id}`, { method: 'DELETE' });
}

export async function renameFile(id: number, name: string): Promise<void> {
  await request(`/rename/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export async function moveToAlbum(fileId: number, albumId: number): Promise<void> {
  await request(`/move-to-album/${fileId}/${albumId}`, { method: 'POST' });
}

export async function getAlbums(): Promise<Album[]> {
  return request<Album[]>('/albums');
}

export async function createAlbum(
  name: string,
  isShared = false,
  sharedWith: string[] = [],
): Promise<Album> {
  return request<Album>('/albums', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, is_shared: isShared, shared_with: sharedWith }),
  });
}

export async function deleteAlbum(id: number): Promise<void> {
  await request(`/albums/${id}`, { method: 'DELETE' });
}

export async function getStats(): Promise<FileStats> {
  return request<FileStats>('/stats');
}

export async function getStorage(): Promise<StorageStats> {
  return request<StorageStats>('/storage');
}

export async function getUsers(): Promise<MCloudUser[]> {
  return request<MCloudUser[]>('/users');
}

/**
 * Not in the documented API — assumes the server exposes a share-link endpoint.
 * Confirm/add server-side before relying on this in production.
 */
export async function generateAlbumShareLink(albumId: number): Promise<string> {
  const result = await request<{ url: string }>(`/albums/${albumId}/share`, {
    method: 'POST',
  });
  return result.url;
}

export interface UploadFileInput {
  uri: string;
  name: string;
  type: string;
}

export async function uploadFile(
  file: UploadFileInput,
  albumId?: number,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getServerUrl()}/upload`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = event => {
      if (onProgress && event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new ApiError(xhr.status, `Upload fejlede (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Netværksfejl under upload'));

    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    if (albumId != null) form.append('album_id', String(albumId));
    xhr.send(form);
  });
}
