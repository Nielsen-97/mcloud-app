import { getServerUrl, waitForInitialResolution } from '../services/serverUrl';
import { authHeaders, captureCookiesFromStore, setSessionCookie } from '../services/sessionCookie';
import type {
  Album,
  AdminStats,
  BackupStatus,
  FileStats,
  FileType,
  MCloudFile,
  Recipe,
  RecipeTag,
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
// Videos are now included in background sync and can be well over 30s worth
// of upload time on a home network — the old 30s timeout was very likely
// why only small photos were making it over and larger videos silently
// failed as "timed out" every single attempt.
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  await waitForInitialResolution();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${getServerUrl()}${path}`, {
      // 'omit', not 'include': we attach the session cookie ourselves via
      // authHeaders() below. Letting the OS also auto-attach its own stored
      // cookie caused Flask to receive two comma-joined `session=` values in
      // one Cookie header, which fails signature verification and silently
      // resets to an empty session — a stale/no-op cookie colliding with the
      // correct one is worse than sending no automatic cookie at all.
      credentials: 'omit',
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
 *
 * This request keeps credentials: 'include' — unlike every other call, this
 * one needs the OS to actually persist the response's Set-Cookie so
 * captureCookiesFromStore() has something to read back afterward. It's safe
 * here specifically because we don't also attach a manual Cookie header on
 * this one request, so there's nothing for the OS's cookie to collide with.
 */
export async function login(username: string, password: string): Promise<void> {
  await waitForInitialResolution();
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

export async function getUsers(): Promise<string[]> {
  return request<string[]>('/users');
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

/**
 * Not in the documented API — new endpoints needed for the recipes feature.
 * See the server changes description for the exact contract these expect.
 */
export async function getRecipes(): Promise<Recipe[]> {
  return request<Recipe[]>('/recipes');
}

export interface RecipePreview {
  title: string;
  domain: string;
  image_url: string | null;
}

export async function previewRecipeTitle(url: string): Promise<RecipePreview> {
  return request<RecipePreview>('/recipes/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
}

export async function createRecipe(
  url: string,
  title: string,
  tags: RecipeTag[],
  imageUrl?: string | null,
): Promise<Recipe> {
  return request<Recipe>('/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, title, tags, image_url: imageUrl ?? null }),
  });
}

export async function deleteRecipe(id: number): Promise<void> {
  await request(`/recipes/${id}`, { method: 'DELETE' });
}

export function recipeSnapshotUrl(id: number): string {
  return `${getServerUrl()}/recipes/${id}/snapshot`;
}

// Real /admin/* contract, confirmed against app.py — mathias-only,
// enforced server-side by admin_required() (same session check as
// api_login_required, plus username === 'mathias').

export async function getAdminStats(): Promise<AdminStats> {
  return request<AdminStats>('/admin/stats');
}

export async function getAdminUsers(): Promise<string[]> {
  return request<string[]>('/admin/users');
}

export async function createUser(username: string, password: string): Promise<void> {
  await request('/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export async function deleteUser(username: string): Promise<void> {
  await request(`/admin/users/${encodeURIComponent(username)}`, { method: 'DELETE' });
}

export async function resetPassword(username: string, password: string): Promise<void> {
  await request('/admin/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export async function getBackupStatus(): Promise<BackupStatus> {
  return request<BackupStatus>('/admin/backup/status');
}

export interface UploadFileInput {
  uri: string;
  name: string;
  type: string;
}

/**
 * Uses fetch(), not XMLHttpRequest — XHR's setRequestHeader('Cookie', ...)
 * isn't reliably honored by React Native's networking bridge even though the
 * identical header works fine through fetch(), which is how uploads ended up
 * still 401ing here after every other request (which all go through fetch()
 * via request()) started working. Per-byte upload progress was the one thing
 * XHR gave us that fetch() can't easily replicate in RN, but nothing in the
 * app actually consumed it — only per-file progress (via runQueue) is used —
 * so dropping it costs nothing.
 */
export async function uploadFile(file: UploadFileInput, albumId?: number): Promise<void> {
  await waitForInitialResolution();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
  try {
    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    if (albumId != null) form.append('album_id', String(albumId));

    const res = await fetch(`${getServerUrl()}/upload`, {
      method: 'POST',
      credentials: 'omit',
      headers: authHeaders(),
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ApiError(res.status, `Upload fejlede (${res.status})`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Tidsudløb: upload svarede ikke inden for ${UPLOAD_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
