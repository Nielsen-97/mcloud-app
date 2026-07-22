import AsyncStorage from '@react-native-async-storage/async-storage';
import CookieManager from '@preeternal/react-native-cookie-manager';
import { STORAGE_KEYS } from '../config';

// The server's session cookie is scoped to whichever host set it (Tailscale
// hostname or LAN IP) — the OS cookie jar will never forward it to the other
// host, since that's correct, unavoidable platform behavior for cookies. We
// therefore manage the session cookie ourselves: capture it from the OS's own
// cookie store right after login (NSURLSession on iOS intercepts Set-Cookie
// response headers into its own store and doesn't reliably expose them back
// to JS via response.headers, so reading the response directly doesn't work —
// CookieManager reads what the OS actually captured instead), persist it, and
// attach it as an explicit header on every request (JSON API calls, image/
// video loads, and file downloads alike) regardless of which host is active.

let cachedCookie: string | null = null;
let loaded = false;
let loadPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (!loadPromise) {
    loadPromise = AsyncStorage.getItem(STORAGE_KEYS.sessionCookie).then(value => {
      cachedCookie = value;
      loaded = true;
    });
  }
  await loadPromise;
}

/** Synchronous read for building headers at render time. Call `loadSessionCookie()` once at startup first. */
export function getSessionCookie(): string | null {
  return cachedCookie;
}

/** Loads the persisted cookie into memory. Call once during app startup, before any authenticated request. */
export function loadSessionCookie(): Promise<void> {
  return ensureLoaded();
}

export async function setSessionCookie(cookie: string | null): Promise<void> {
  cachedCookie = cookie;
  loaded = true;
  if (cookie) {
    await AsyncStorage.setItem(STORAGE_KEYS.sessionCookie, cookie);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEYS.sessionCookie);
  }
}

/**
 * Reads whatever cookies the OS actually stored for `url` (populated by the
 * login response, even though that response's Set-Cookie header wasn't
 * JS-visible) and persists them as a single Cookie-header-ready string.
 */
export async function captureCookiesFromStore(url: string): Promise<void> {
  const cookies = await CookieManager.get(url);
  const pairs = Object.values(cookies).map(cookie => `${cookie.name}=${cookie.value}`);
  if (pairs.length > 0) {
    await setSessionCookie(pairs.join('; '));
  }
}

/** Headers to spread onto any request/Image/Video source that needs the session cookie. */
export function authHeaders(): Record<string, string> {
  const cookie = getSessionCookie();
  return cookie ? { Cookie: cookie } : {};
}
