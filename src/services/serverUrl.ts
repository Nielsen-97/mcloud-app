export const LOCAL_URL = 'http://192.168.8.142';
export const REMOTE_URL = 'https://mcloud.taile49ac8.ts.net';

const PROBE_TIMEOUT_MS = 1500;

let activeUrl = REMOTE_URL;
let inFlight: Promise<string> | null = null;
let hasResolvedOnce = false;
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
    hasResolvedOnce = true;
    return url;
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * Resolves once the first probe (ever) has completed — instantly if one
 * already has, otherwise piggybacking on whichever resolveServerUrl() call
 * is in flight. App.tsx intentionally doesn't block rendering on the probe
 * (so the UI paints immediately), but that meant a screen's very first
 * network call could fire before the probe settled and use the stale
 * default (Tailscale) URL — if Tailscale wasn't actually connected while on
 * home WiFi, that first request would fail and flash the offline banner
 * even though the network was fine. Callers that are about to make the
 * FIRST real network request of the app's lifetime should await this;
 * every call after the first resolves immediately and adds no latency.
 */
export function waitForInitialResolution(): Promise<void> {
  if (hasResolvedOnce) return Promise.resolve();
  return resolveServerUrl().then(() => undefined);
}
