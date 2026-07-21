import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../config';

// The server's session cookie is scoped to whichever host set it (Tailscale
// hostname or LAN IP) — the OS cookie jar will never forward it to the other
// host, since that's correct, unavoidable platform behavior for cookies. We
// therefore manage the session cookie ourselves: capture it from the login
// response, persist it, and attach it as an explicit header on every request
// (JSON API calls, image/video loads, and file downloads alike) regardless of
// which host is currently active.

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

/** Extracts the `name=value` pair(s) from a raw Set-Cookie response header, dropping attributes like Path/Expires/HttpOnly. */
export function parseSetCookieHeader(rawSetCookie: string): string | null {
  // A single Set-Cookie header looks like "session=abc123; Path=/; HttpOnly".
  // We only need the name=value part to send back as the Cookie header.
  const pair = rawSetCookie.split(';')[0]?.trim();
  return pair && pair.includes('=') ? pair : null;
}

/** Headers to spread onto any request/Image/Video source that needs the session cookie. */
export function authHeaders(): Record<string, string> {
  const cookie = getSessionCookie();
  return cookie ? { Cookie: cookie } : {};
}
