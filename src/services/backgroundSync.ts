import BackgroundFetch from 'react-native-background-fetch';
import NetInfo from '@react-native-community/netinfo';
import { syncNewPhotos } from './photoSync';

let netInfoUnsubscribe: (() => void) | null = null;
let wasOnWifi = false;

type ProgressListener = (uploaded: number, total: number) => void;
let progressListener: ProgressListener | null = null;
let configured = false;

/**
 * SyncContext only exists (and can report progress) once the user is
 * logged in, but the OS-level task must be registered unconditionally at
 * true app launch regardless of auth state — see configureBackgroundFetch()
 * below for why. This lets whichever listener is currently mounted (or
 * none, before login) receive progress updates from a background-triggered
 * sync without configure() needing to be called again to rebind it.
 */
export function setBackgroundSyncProgressListener(listener: ProgressListener | null): void {
  progressListener = listener;
}

/**
 * Registers the OS-level periodic background fetch task. On iOS this is a
 * `BGAppRefreshTask`: the OS decides the actual cadence (a "15 min" request
 * is a floor, not a guarantee) based on usage patterns, battery, and Low
 * Power Mode — and critically, iOS will NOT relaunch a force-quit app for
 * this at all. Backgrounding the app (home button) allows it; swiping it
 * away in the app switcher does not, and no app-level config can change
 * that — it's an OS policy, not a bug in this code.
 *
 * Must be called unconditionally, once, as early as possible in the app's
 * lifecycle — iOS's BGTaskScheduler expects every permitted task identifier
 * to be registered essentially at launch, and a registration gated behind
 * app state (e.g. only after the user logs in) can simply never happen for
 * a given process lifetime if that gate is never reached. syncNewPhotos()
 * already fails harmlessly (caught below) if there's no valid session yet,
 * so there's no downside to registering before login.
 */
export async function configureBackgroundFetch(): Promise<void> {
  if (configured) return;
  configured = true;
  await BackgroundFetch.configure(
    {
      minimumFetchInterval: 15,
      stopOnTerminate: false,
      startOnBoot: true,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
    },
    async taskId => {
      try {
        await syncNewPhotos(progress => progressListener?.(progress.uploaded, progress.total));
      } catch (error) {
        console.warn('MCloud background sync failed', error);
      } finally {
        BackgroundFetch.finish(taskId);
      }
    },
    // onTimeout: fired when the OS is about to reclaim background time.
    // Must call finish() immediately — previously this callback only logged
    // a warning and never did, which can cause iOS to throttle future
    // background time for not completing tasks promptly.
    taskId => {
      console.warn('MCloud background fetch timed out before finishing, taskId:', taskId);
      BackgroundFetch.finish(taskId);
    },
  );
}

/** Reflects the OS-level Background App Refresh setting for this app. */
export async function getBackgroundFetchStatus(): Promise<
  'available' | 'denied' | 'restricted' | 'unknown'
> {
  try {
    const status = await BackgroundFetch.status();
    if (status === BackgroundFetch.STATUS_AVAILABLE) return 'available';
    if (status === BackgroundFetch.STATUS_DENIED) return 'denied';
    if (status === BackgroundFetch.STATUS_RESTRICTED) return 'restricted';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Triggers a sync every time the device transitions onto a WiFi network. */
export function startWifiSyncTrigger(
  onProgress?: (uploaded: number, total: number) => void,
): () => void {
  netInfoUnsubscribe?.();
  netInfoUnsubscribe = NetInfo.addEventListener(state => {
    const onWifi = state.type === 'wifi' && state.isConnected === true;
    if (onWifi && !wasOnWifi) {
      syncNewPhotos(progress => onProgress?.(progress.uploaded, progress.total)).catch(error =>
        console.warn('MCloud WiFi-triggered sync failed', error),
      );
    }
    wasOnWifi = onWifi;
  });
  return netInfoUnsubscribe;
}
