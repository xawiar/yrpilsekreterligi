import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';
import ApiService from '../utils/ApiService';
import { VAPID_KEY } from '../config/firebase';
import { USE_FIREBASE } from '../utils/constants';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true); // Başlangıçta loading true
  const [error, setError] = useState(null);
  
  // Helper function to get userRole from user object
  const getUserRole = () => {
    if (!user) return null;
    // Check multiple possible fields for role
    return user.role || user.userRole || user.user_type || user.userType || null;
  };
  
  // Helper function to save to localStorage (centralized)
  const saveToLocalStorage = (userData, loggedIn) => {
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('isLoggedIn', loggedIn ? 'true' : 'false');
      // Also save userRole separately for backward compatibility (will be removed later)
      const role = userData.role || userData.userRole || userData.user_type || userData.userType || null;
      if (role) {
        localStorage.setItem('userRole', role);
      }
    } else {
      localStorage.removeItem('user');
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userRole');
    }
  };
  
  // Helper function to load from localStorage (centralized)
  const loadFromLocalStorage = () => {
    const savedUser = localStorage.getItem('user');
    const savedIsLoggedIn = localStorage.getItem('isLoggedIn');
    
    if (savedUser && savedIsLoggedIn === 'true') {
      try {
        const userData = JSON.parse(savedUser);
        return { user: userData, isLoggedIn: true };
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        return { user: null, isLoggedIn: false };
      }
    }
    return { user: null, isLoggedIn: false };
  };

  // Sayfa yüklendiğinde kullanıcı bilgilerini yükle
  useEffect(() => {
    let unsubscribe = null;
    
    // Firebase kullanılıyorsa, Firebase auth state'ini dinle
    if (USE_FIREBASE) {
      // Dynamic import ile Firebase'i yükle - browser-safe
      Promise.all([
        import('firebase/auth'),
        import('../config/firebase')
      ]).then((modules) => {
        const { onAuthStateChanged } = modules[0];
        const { auth: authInstance } = modules[1];
        
        if (!authInstance || !onAuthStateChanged) {
          console.warn('Firebase auth not available');
          setLoading(false);
          return;
        }
        
        // First, try to load user from localStorage immediately (for faster initial load)
        const { user: savedUserData, isLoggedIn: savedIsLoggedIn } = loadFromLocalStorage();
        
        if (savedUserData && savedIsLoggedIn) {
          setUser(savedUserData);
          setIsLoggedIn(true);
          setLoading(false); // Set loading to false immediately
        } else {
          setLoading(false);
        }
        
        // Then, listen to Firebase auth state changes (for real-time updates)
        unsubscribe = onAuthStateChanged(authInstance, async (firebaseUser) => {
          if (firebaseUser) {
            // Firebase user varsa, kullanıcı bilgilerini localStorage'dan al
            const { user: savedUserData, isLoggedIn: savedIsLoggedIn } = loadFromLocalStorage();
            
            if (savedUserData && savedIsLoggedIn) {
              // Firebase UID ile eşleşiyorsa kullanıcıyı ayarla
              if (savedUserData.id === firebaseUser.uid || savedUserData.uid === firebaseUser.uid) {
                setUser(savedUserData);
                setIsLoggedIn(true);
                // localStorage'ı güncelle (yeniden kaydet)
                saveToLocalStorage(savedUserData, true);
              } else {
                // UID eşleşmiyorsa, ancak localStorage'da user varsa ve isLoggedIn true ise
                // Kullanıcı manuel logout yapmadıysa, localStorage'daki user'ı kullan
                // (Firebase auth state değişikliği bazen yanlış logout'a neden olabilir)
                console.warn('Firebase UID mismatch, but keeping localStorage user');
                setUser(savedUserData);
                setIsLoggedIn(true);
              }
            } else {
              // localStorage'da user var ama isLoggedIn false/null
              // Bu durumda user'ı yükle (sayfa yenileme sonrası)
              const { user: fallbackUser } = loadFromLocalStorage();
              if (fallbackUser) {
                setUser(fallbackUser);
                setIsLoggedIn(true);
                saveToLocalStorage(fallbackUser, true);
              }
            }
          } else {
            // Firebase user yoksa, ancak localStorage'da user varsa ve isLoggedIn true ise
            // Kullanıcı manuel logout yapmadıysa, localStorage'daki user'ı kullan
            const { user: savedUserData, isLoggedIn: savedIsLoggedIn } = loadFromLocalStorage();
            
            if (savedUserData && savedIsLoggedIn) {
              // Firebase auth state değişikliği bazen yanlış logout'a neden olabilir
              // Bu durumda localStorage'daki user'ı kullan
              console.warn('Firebase user not found, but keeping localStorage user');
              setUser(savedUserData);
              setIsLoggedIn(true);
            } else {
              // Gerçekten logout yapılmalı
              setUser(null);
              setIsLoggedIn(false);
              saveToLocalStorage(null, false);
            }
          }
          // Don't set loading to false here - it's already set above
        });
      }).catch((error) => {
        console.error('Firebase initialization error:', error);
        setLoading(false);
      });
      
      // Cleanup function - unsubscribe'u çağır
      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    } else {
      // Firebase kullanılmıyorsa, localStorage'dan yükle
      const { user: savedUserData, isLoggedIn: savedIsLoggedIn } = loadFromLocalStorage();
      
      if (savedUserData && savedIsLoggedIn) {
        setUser(savedUserData);
        setIsLoggedIn(true);
        setLoading(false); // Set loading to false immediately
      } else {
        setLoading(false);
      }
    }
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    setError(null);

    try {
      const response = await ApiService.login(username, password);

      if (response.success) {
        // 2FA gerekiyorsa ozel response dondur
        if (response.requires2FA) {
          return { requires2FA: true, tempToken: response.tempToken };
        }

        if (response.token) { localStorage.setItem('token', response.token); }
        setUser(response.user);
        setIsLoggedIn(true);
        saveToLocalStorage(response.user, true);

        // Login sonrasi otomatik push subscription (maliisler pattern)
        // + Anonim push aboneliği user'a "claim" edilir (account linking)
        setTimeout(async () => {
          try {
            const userId = response.user.id || response.user.uid || '';

            // ADIM 1: Anonim push aboneliği varsa user'a bağla
            // (Login öncesi banner'dan abone olmuş ziyaretçi → şimdi user oldu)
            if (userId) {
              try {
                const anonId = localStorage.getItem('anon_push_id');
                if (anonId) {
                  const { doc, getDoc, setDoc, updateDoc } = await import('firebase/firestore');
                  const { db } = await import('../config/firebase');
                  if (db) {
                    const anonDocRef = doc(db, 'push_tokens', anonId);
                    const anonSnap = await getDoc(anonDocRef);
                    if (anonSnap.exists()) {
                      const anonData = anonSnap.data();
                      // User doc'u oluştur (anonim subscription'la)
                      if (anonData.subscription) {
                        await setDoc(doc(db, 'push_tokens', userId), {
                          subscription: anonData.subscription,
                          userId: userId,
                          linkedFromAnonId: anonId,
                          linkedAt: new Date().toISOString(),
                          isActive: true,
                          isAnonymous: false,
                          updatedAt: new Date().toISOString(),
                        }, { merge: true });
                      }
                      // Anonim doc'u deaktive et — anonim sorgusundan düşsün
                      // (Delete yerine update; rules permission konusu olmasın)
                      try {
                        await updateDoc(anonDocRef, {
                          isActive: false,
                          isAnonymous: false,
                          linkedToUid: userId,
                          linkedAt: new Date().toISOString(),
                        });
                      } catch (_) { /* update başarısızsa zarar yok */ }
                    }
                  }
                  // Anonim ID'yi temizle — artık user'a bağlı
                  try { localStorage.removeItem('anon_push_id'); } catch (_) {}
                  try { localStorage.removeItem('anon_push_dismissed'); } catch (_) {}
                }
              } catch (claimErr) {
                console.warn('[PUSH] Anonim claim hatası:', claimErr);
              }
            }

            // ADIM 2: Normal push subscription akışı
            if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
              const perm = await Notification.requestPermission();
              if (perm === 'granted' && 'serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                const vapidKey = VAPID_KEY;
                const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
                const b64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
                const raw = window.atob(b64);
                const arr = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
                // Mevcut subscription farklı applicationServerKey ile kayıtlıysa unsubscribe et
                // (VAPID key değiştiğinde InvalidStateError alınmaması için)
                try {
                  const existing = await reg.pushManager.getSubscription();
                  if (existing) {
                    const existingKey = existing.options?.applicationServerKey;
                    let mismatch = true;
                    if (existingKey) {
                      const existingArr = new Uint8Array(existingKey);
                      mismatch = existingArr.length !== arr.length ||
                        !existingArr.every((v, i) => v === arr[i]);
                    }
                    if (mismatch) await existing.unsubscribe();
                  }
                } catch (unsubErr) {
                  console.warn('[PUSH] Old subscription cleanup skipped:', unsubErr);
                }
                const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: arr.buffer });
                if (userId) {
                  const { doc, setDoc } = await import('firebase/firestore');
                  const { db } = await import('../config/firebase');
                  if (db) {
                    await setDoc(doc(db, 'push_tokens', userId), {
                      subscription: JSON.stringify(sub),
                      userId: userId,
                      updatedAt: new Date().toISOString(),
                      isActive: true,
                      isAnonymous: false,
                    }, { merge: true });
                  }
                }
              }
            }
          } catch (pushErr) {
            console.error('[PUSH DEBUG] Push subscription error:', pushErr);
          }
        }, 2000);

        return true;
      } else {
        setError(response.message || 'Giriş başarısız');
        return false;
      }
    } catch (err) {
      setError('Giriş sırasında bir hata oluştu');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // 2FA dogrulama
  const verify2FA = async (code, tempToken) => {
    setLoading(true);
    setError(null);
    try {
      const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${API_URL}/api/auth/2fa/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, tempToken })
      });
      const data = await response.json();
      if (data.success && data.token) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setIsLoggedIn(true);
        saveToLocalStorage(data.user, true);
        return true;
      } else {
        setError(data.message || 'Dogrulama basarisiz');
        return false;
      }
    } catch (err) {
      setError('Dogrulama sirasinda bir hata olustu');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Önceki user ID'yi sakla (logout sonrası push doc'unu deaktive etmek için)
    const previousUserId = user?.id || user?.uid || null;

    setUser(null);
    setIsLoggedIn(false);
    setError(null);
    // localStorage'dan kullanıcı bilgilerini temizle (centralized)
    localStorage.removeItem('token');
    saveToLocalStorage(null, false);

    // FAZ 2.4 fix v4: Logout sonrası
    //   1) push_tokens/{userId} ZORLA isActive:true yenile (eski deaktivasyonları düzelt)
    //      → Üye-bazlı (SINGLE/Tüm Üyeler) bildirim cihaza gelmeye devam eder
    //   2) push_tokens/{anonId} oluştur (isAnonymous:true)
    //      → Anonim bildirim de cihaza gelir
    // Çift kayıt — aynı endpoint için iki doc, her iki türden bildirim ulaşır.
    (async () => {
      console.log('[LOGOUT-PUSH] Logout fix v4 başlıyor...', { previousUserId });
      try {
        const { doc, setDoc, getDoc } = await import('firebase/firestore');
        const { db } = await import('../config/firebase');
        if (!db) {
          console.warn('[LOGOUT-PUSH] Firestore db yok');
          return;
        }

        // Push permission + service worker kontrolü
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
          console.warn('[LOGOUT-PUSH] Bildirim izni yok, atlanıyor');
          return;
        }
        if (!('serviceWorker' in navigator)) return;
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          console.warn('[LOGOUT-PUSH] Subscription yok — subscribeAnonymousPush çağrılıyor');
          const { subscribeAnonymousPush } = await import('../services/NotificationService');
          const r = await subscribeAnonymousPush();
          console.log('[LOGOUT-PUSH] subscribeAnonymousPush sonucu:', r);
          return;
        }
        const subJson = JSON.parse(JSON.stringify(subscription));

        // 1) USER DOC YENİLE — isActive: true zorla
        //    Önceki logout fix'lerinin kalıntısı: bazı user doc'lar isActive:false
        //    → SINGLE target / Tüm Üyeler hedefi bildirim göndermiyor.
        //    Burada zorla true ile setDoc merge:true → düzeltiyoruz.
        if (previousUserId) {
          try {
            const userDocRef = doc(db, 'push_tokens', String(previousUserId));
            const existing = await getDoc(userDocRef);
            const baseData = existing.exists() ? existing.data() : {};
            await setDoc(userDocRef, {
              ...baseData,
              subscription: subJson,
              userId: String(previousUserId),
              isActive: true,             // ← KRİTİK: deaktif olmuş olsa bile aktive et
              isAnonymous: false,
              updatedAt: new Date().toISOString(),
              loggedOutAt: new Date().toISOString(),
              userLoggedIn: false,        // bilgilendirme — bildirim gönderimini engellemez
            }, { merge: true });
            console.log('[LOGOUT-PUSH] User doc isActive:true ile yenilendi:', previousUserId);
          } catch (e) {
            console.warn('[LOGOUT-PUSH] User doc yenileme hatası:', e.message);
          }
        }

        // 2) ANONIM DOC OLUŞTUR
        const ANON_KEY = 'anon_push_id';
        let anonId = null;
        try { anonId = localStorage.getItem(ANON_KEY); } catch (_) {}
        if (!anonId) {
          const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          anonId = `anon_${uuid}`;
          try { localStorage.setItem(ANON_KEY, anonId); } catch (_) {}
        }

        await setDoc(doc(db, 'push_tokens', anonId), {
          subscription: subJson,
          isActive: true,
          isAnonymous: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdFrom: 'logout',
          previousUserId: previousUserId || null,
          userAgent: navigator.userAgent || '',
        });
        console.log('[LOGOUT-PUSH] Anonim doc oluşturuldu:', anonId,
          '— ÇİFT KAYIT: user doc + anon doc, her iki türden bildirim de gelir');
      } catch (anonErr) {
        console.error('[LOGOUT-PUSH] HATA:', anonErr);
      }
    })();
  };

  // Set user directly (for loginChiefObserver and similar cases)
  const setUserFromLogin = (userData, token) => {
    if (token) { localStorage.setItem('token', token); }
    setUser(userData);
    setIsLoggedIn(true);
    saveToLocalStorage(userData, true);
  };

  const value = useMemo(() => ({
    user,
    isLoggedIn,
    loading,
    error,
    userRole: getUserRole(), // Computed property for userRole
    login,
    verify2FA,
    logout,
    setUserFromLogin // For direct user setting (e.g., chief observer login)
  }), [user, isLoggedIn, loading, error]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};