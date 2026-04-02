import { getPendingResults, markResultSynced, markResultFailed } from './offlineQueue';
import ApiService from './ApiService';

let syncInProgress = false;
let onSyncStatusChange = null;

export function setSyncStatusCallback(callback) {
  onSyncStatusChange = callback;
}

export async function syncPendingResults() {
  if (syncInProgress) return;
  if (!navigator.onLine) return;

  syncInProgress = true;
  onSyncStatusChange?.('syncing');

  try {
    const pending = await getPendingResults();
    let synced = 0;
    let failed = 0;

    for (const entry of pending) {
      // Max retry aşıldı — kalıcı olarak başarısız olan kayıtları sonsuz döngüde deneme
      if ((entry.retryCount || 0) >= 5) {
        continue;
      }
      try {
        const { localId, status, createdAt, retryCount, lastError, ...data } = entry;
        const result = await ApiService.createElectionResult(data);
        if (result.success || result.id) {
          await markResultSynced(localId);
          synced++;
        } else {
          await markResultFailed(localId);
          failed++;
        }
      } catch (err) {
        await markResultFailed(entry.localId);
        failed++;
      }
    }

    onSyncStatusChange?.(failed > 0 ? 'partial' : 'done', { synced, failed, total: pending.length });
  } catch (err) {
    onSyncStatusChange?.('error');
  } finally {
    syncInProgress = false;
  }
}

// Auto-sync when online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    setTimeout(syncPendingResults, 2000);
  });
}
