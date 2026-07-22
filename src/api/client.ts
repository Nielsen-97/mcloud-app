import { getServerUrl } from '../services/serverUrl';
import { authHeaders, captureCookiesFromStore, setSessionCookie } from '../services/sessionCookie';
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

const REQUEST_TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 30000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${getServerUrl()}${path}`, {
      credentials: 'include',
      ...init,
      headers: { ...authHeaders(), ...init?.headers },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Tidsudløb: ${path} svarede ikke inden for ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) {
    throw new ApiError(res.status, `${init?.method ?? 'GET'} ${path} failed (${res.status})`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  return undefined as unknown as T;
}

export { authHeaders } from '../services/sessionCookie';

export function downloadUrl(filename: string): string {
  return `${getServerUrl()}/download/${filename}`;
}

export function viewUrl(filename: string): string {
  return `${getServerUrl()}/view/${filename}`;
}

/**
 * After a successful login, the session cookie is captured from the OS's own
 * cookie store rather than from the response object — Set-Cookie is a
 * forbidden response header per the fetch/XHR spec, so response.headers
 * never exposes it to JS on any platform. The captured value is then
 * re-attached manually to every subsequent request, since it won't be
 * forwarded automatically once the active host switches between the LAN IP
 * and the Tailscale hostname.
 */
export async function login(username: string, password: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const loginUrl = getServerUrl();
  try {
    const res = await fetch(`${loginUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
      credentials: 'include',
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ApiError(res.status, 'Forkert brugernavn eller password');
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Tidsudløb: login svarede ikke inden for ${REQUEST_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
  const captured = await captureCookiesFromStore(loginUrl);
  if (!captured) {
    throw new Error(
      `Login blev accepteret af serveren, men appen kunne ikke læse session-cookien fra ${loginUrl} bagefter. Efterfølgende kald vil fejle med 401.`,
    );
  }
}

export async function logout(): Promise<void> {
  try {
    await request('/logout');
  } finally {
    await setSessionCookie(null);
  }
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
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    const cookie = authHeaders().Cookie;
    if (cookie) xhr.setRequestHeader('Cookie', cookie);
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
    xhr.ontimeout = () => reject(new Error(`Tidsudløb: upload svarede ikke inden for ${UPLOAD_TIMEOUT_MS / 1000}s`));

    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    if (albumId != null) form.append('album_id', String(albumId));
    xhr.send(form);
  });
}
