export const LOCAL_URL = 'http://192.168.8.142';
export const REMOTE_URL = 'https://mcloud.taile49ac8.ts.net';

const PROBE_TIMEOUT_MS = 1500;

let activeUrl = REMOTE_URL;
let inFlight: Promise<string> | null = null;
const listeners = new Set<(url: string) => void>();

/** Synchronous read of the currently active base URL. Safe to call at render time. */
export function getServerUrl(): string {
  return activeUrl;
}

/** Notified whenever the resolved base URL changes (e.g. arriving home / leaving home). */
export function subscribeServerUrl(listener: (url: string) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setActiveUrl(url: string) {
  if (url === activeUrl) return;
  activeUrl = url;
  listeners.forEach(listener => listener(url));
}

async function isReachable(base: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    // Any response at all (even 401/404) means the host answered — that's enough.
    await fetch(base, { signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Prefers the local-network address (fast, no VPN needed while on home WiFi),
 * falling back to the Tailscale hostname when the local address isn't reachable
 * (away from home, or Tailscale-only network setup). Safe to call repeatedly —
 * concurrent calls share the same in-flight probe.
 */
export function resolveServerUrl(): Promise<string> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const url = (await isReachable(LOCAL_URL)) ? LOCAL_URL : REMOTE_URL;
    setActiveUrl(url);
    return url;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}
