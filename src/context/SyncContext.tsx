import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { getLastSyncTime, syncNewPhotos } from '../services/photoSync';
import { configureBackgroundFetch, startWifiSyncTrigger } from '../services/backgroundSync';

interface SyncContextValue {
  syncing: boolean;
  uploaded: number;
  total: number;
  failed: number;
  lastError: string | null;
  lastSync: Date | null;
  isOffline: boolean;
  triggerSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [syncing, setSyncing] = useState(false);
  const [uploaded, setUploaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const syncingRef = useRef(false);
  const wasOfflineRef = useRef(false);

  const triggerSync = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setUploaded(0);
    setTotal(0);
    setFailed(0);
    setLastError(null);
    try {
      await syncNewPhotos(progress => {
        setUploaded(progress.uploaded);
        setTotal(progress.total);
        setFailed(progress.failed);
        setLastError(progress.lastError);
      });
      setLastSync(await getLastSyncTime());
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    getLastSyncTime().then(setLastSync);

    const unsubscribeNet = NetInfo.addEventListener(state => {
      const offline = state.isConnected === false;
      setIsOffline(offline);
      if (!offline && wasOfflineRef.current) {
        triggerSync();
      }
      wasOfflineRef.current = offline;
    });

    configureBackgroundFetch((u, t) => {
      setUploaded(u);
      setTotal(t);
    });
    const unsubscribeWifi = startWifiSyncTrigger((u, t) => {
      setUploaded(u);
      setTotal(t);
    });

    const appStateSub = AppState.addEventListener('change', state => {
      if (state === 'active') triggerSync();
    });

    return () => {
      unsubscribeNet();
      unsubscribeWifi();
      appStateSub.remove();
    };
  }, [triggerSync]);

  const value = useMemo(
    () => ({ syncing, uploaded, total, failed, lastError, lastSync, isOffline, triggerSync }),
    [syncing, uploaded, total, failed, lastError, lastSync, isOffline, triggerSync],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}
