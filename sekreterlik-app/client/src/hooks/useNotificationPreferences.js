import { useState, useCallback } from 'react';

const PREFS_KEY = 'notificationPreferences';
const defaultPrefs = { meeting: true, event: true, election: true, member: true };

/**
 * Bildirim tercihlerini localStorage'da yoneten hook.
 * Client tarafinda filtreleme icin kullanilir — backend'e gonderilmez.
 */
const useNotificationPreferences = () => {
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

  const updatePreference = useCallback((key, value) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch (e) {
        console.warn('Error saving notification preferences:', e);
      }
      return next;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences({ ...defaultPrefs });
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(defaultPrefs));
    } catch (e) {
      console.warn('Error resetting notification preferences:', e);
    }
  }, []);

  return { preferences, updatePreference, resetPreferences };
};

/**
 * Bildirim tipine gore tercihlerin izin verip vermedigini kontrol eder.
 * notification.type degerini preference key'ine esler.
 */
export const getPreferenceKeyForType = (type) => {
  if (!type) return null;
  const t = type.toLowerCase();
  if (t === 'meeting' || t === 'meeting_reminder') return 'meeting';
  if (t === 'event' || t === 'event_reminder') return 'event';
  if (t === 'election' || t === 'election_result') return 'election';
  if (t === 'member' || t === 'new_member') return 'member';
  return null; // bilinmeyen tip — filtrelenmez, gosterilir
};

export const isNotificationAllowed = (type, preferences) => {
  const key = getPreferenceKeyForType(type);
  if (key === null) return true; // eslesmez → goster
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
