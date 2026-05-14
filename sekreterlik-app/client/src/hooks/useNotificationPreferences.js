import { useState, useCallback, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';

const PREFS_KEY = 'notificationPreferences';
const defaultPrefs = { meeting: true, event: true, election: true, member: true };

/**
 * Bildirim tercihlerini hem localStorage hem Firestore'da yöneten hook.
 * - localStorage: hızlı render (offline çalışır)
 * - Firestore (`notification_preferences/{userId}`): server-side filter,
 *   admin "Tüm Üyeler"e bildirim gönderdiğinde NotificationService.filterByPreferences
 *   bu doc'u okuyup opt-out edenleri çıkarır.
 */
const useNotificationPreferences = () => {
  const { user } = useAuth();
  const userId = user?.memberId || user?.id || user?.uid || null;

  const [preferences, setPreferences] = useState(() => {
    try {
      const stored = localStorage.getItem(PREFS_KEY);
      if (stored) {
        return { ...defaultPrefs, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Error reading notification preferences:', e);
    }
    return { ...defaultPrefs };
  });

  // Firestore'dan en güncel tercihleri çek (revalidate)
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'notification_preferences', String(userId)));
        if (snap.exists() && !cancelled) {
          const data = snap.data();
          const merged = { ...defaultPrefs, ...data };
          // type/__meta vs ekstraları temizle
          const clean = {
            meeting: merged.meeting !== false,
            event: merged.event !== false,
            election: merged.election !== false,
            member: merged.member !== false,
          };
          setPreferences(clean);
          try { localStorage.setItem(PREFS_KEY, JSON.stringify(clean)); } catch (_) { /* ignore */ }
        }
      } catch (err) {
        // sessizce devam — localStorage zaten dolu
        console.warn('[Preferences] Firestore read error:', err.message);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const persistToFirestore = useCallback(async (next) => {
    if (!userId) return;
    try {
      await setDoc(
        doc(db, 'notification_preferences', String(userId)),
        { ...next, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.warn('[Preferences] Firestore write error:', err.message);
    }
  }, [userId]);

  const updatePreference = useCallback((key, value) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Error saving notification preferences:', e);
      }
      // Async Firestore yazma (non-blocking)
      persistToFirestore(next);
      return next;
    });
  }, [persistToFirestore]);

  const resetPreferences = useCallback(() => {
    setPreferences({ ...defaultPrefs });
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(defaultPrefs));
    } catch (e) {
      console.warn('Error resetting notification preferences:', e);
    }
    persistToFirestore({ ...defaultPrefs });
  }, [persistToFirestore]);

  return { preferences, updatePreference, resetPreferences };
};

/**
 * Bildirim tipine gore tercihlerin izin verip vermedigini kontrol eder.
 */
export const getPreferenceKeyForType = (type) => {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t === 'meeting' || t === 'meeting_reminder') return 'meeting';
  if (t === 'event' || t === 'event_reminder') return 'event';
  if (t === 'election' || t === 'election_result') return 'election';
  if (t === 'member' || t === 'new_member') return 'member';
  return null;
};

export const isNotificationAllowed = (type, preferences) => {
  const key = getPreferenceKeyForType(type);
  if (key === null) return true;
  return preferences[key] !== false;
};

export const getStoredPreferences = () => {
  try {
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      return { ...defaultPrefs, ...JSON.parse(stored) };
    }
  } catch (e) {
    // sessizce devam
  }
  return { ...defaultPrefs };
};

export default useNotificationPreferences;
