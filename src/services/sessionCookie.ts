import AsyncStorage from '@react-native-async-storage/async-storage';
import CookieManager from '@preeternal/react-native-cookie-manager';
import { STORAGE_KEYS } from '../config';

// The server's session cookie is scoped to whichever host set it (Tailscale
// hostname or LAN IP) — the OS cookie jar will never forward it to the other
// host, since that's correct, unavoidable platform behavior for cookies. We
// therefore manage the session cookie ourselves: capture it from the OS's own
// cookie store right after login (Set-Cookie is a forbidden response header
// per the fetch/XHR spec, so reading it off the response object directly
// isn't possible — CookieManager reads what the OS actually stored instead),
// persist it, and attach it as an explicit header on every request (JSON API
// calls, image/video loads, and file downloads alike) regardless of which
// host is currently active.

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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Reads whatever cookies the OS actually stored for `url` (populated by the
 * login response, even though that response's Set-Cookie header wasn't
 * JS-visible) and persists them as a single Cookie-header-ready string.
 * Retries briefly since native cookie-store writes aren't guaranteed to be
 * visible the instant the login fetch() promise resolves.
 *
 * Returns whether a cookie was actually found, so callers can surface a
 * clear failure instead of silently "succeeding" with nothing captured.
 */
export async function captureCookiesFromStore(url: string): Promise<boolean> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await delay(150 * attempt);
    const cookies = await CookieManager.get(url);
    const pairs = Object.values(cookies).map(cookie => `${cookie.name}=${cookie.value}`);
    if (pairs.length > 0) {
      await setSessionCookie(pairs.join('; '));
      return true;
    }
  }
  return false;
}

/** Headers to spread onto any request/Image/Video source that needs the session cookie. */
export function authHeaders(): Record<string, string> {
  const cookie = getSessionCookie();
  return cookie ? { Cookie: cookie } : {};
}

/** Names only (never values) of the currently stored cookie(s), for on-screen diagnostics. */
export function getSessionCookieNames(): string[] {
  return cachedCookie?.split('; ').map(pair => pair.split('=')[0]) ?? [];
}
