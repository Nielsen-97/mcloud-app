import BackgroundFetch from 'react-native-background-fetch';
import NetInfo from '@react-native-community/netinfo';
import { syncNewPhotos } from './photoSync';

let netInfoUnsubscribe: (() => void) | null = null;
let wasOnWifi = false;

/** Registers the OS-level periodic background fetch task (~every 15 min, OS-throttled). */
export async function configureBackgroundFetch(
  onProgress?: (uploaded: number, total: number) => void,
): Promise<void> {
  await BackgroundFetch.configure(
    {
      minimumFetchInterval: 15,
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
    },
    async taskId => {
      try {
        await syncNewPhotos(progress => onProgress?.(progress.uploaded, progress.total));
      } catch (error) {
        console.warn('MCloud background sync failed', error);
      } finally {
        BackgroundFetch.finish(taskId);
      }
    },
    error => {
      console.warn('MCloud background fetch failed to configure', error);
    },
  );
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
