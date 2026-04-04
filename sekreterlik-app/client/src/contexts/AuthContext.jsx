import React, { createContext, useState, useContext, useEffect } from 'react';
import ApiService from '../utils/ApiService';

// Firebase kullanımı kontrolü
const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true' || 
                     import.meta.env.VITE_USE_FIREBASE === true ||
                     String(import.meta.env.VITE_USE_FIREBASE).toLowerCase() === 'true';

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
        setTimeout(async () => {
          try {
            console.log('[PUSH DEBUG] Step 1: Checking Notification API...');
            if (typeof Notification !== 'undefined' && Notification.permission !== 'denied') {
              console.log('[PUSH DEBUG] Step 2: Requesting permission...');
              const perm = await Notification.requestPermission();
              console.log('[PUSH DEBUG] Step 3: Permission result:', perm);
              if (perm === 'granted' && 'serviceWorker' in navigator) {
                console.log('[PUSH DEBUG] Step 4: Getting SW registration...');
                const reg = await navigator.serviceWorker.ready;
                console.log('[PUSH DEBUG] Step 5: SW ready, subscribing...');
                const vapidKey = 'BJjc4yxeV5_GZkrrk70VPsvGoFJ6x3aSwRoxD5mtWOlNxJhkq99DcB56cJmzX7O-VRTlXpPJAZLEan7b_VpDtEE';
                const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
                const b64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
                const raw = window.atob(b64);
                const arr = new Uint8Array(raw.length);
                for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
                const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: arr.buffer });
                console.log('[PUSH DEBUG] Step 6: Subscription created:', sub ? 'YES' : 'NO');
                const userId = response.user.id || response.user.uid || '';
                console.log('[PUSH DEBUG] Step 7: userId:', userId);
                if (userId) {
                  const { doc, setDoc } = await import('firebase/firestore');
                  const { db } = await import('../config/firebase');
                  console.log('[PUSH DEBUG] Step 8: db exists:', !!db);
                  if (db) {
                    await setDoc(doc(db, 'push_tokens', userId), {
                      subscription: JSON.stringify(sub),
                      userId: userId,
                      updatedAt: new Date().toISOString(),
                      isActive: true
                    });
                    console.log('[PUSH DEBUG] Step 9: Token SAVED to Firestore!');
                  }
                }
              } else {
                console.log('[PUSH DEBUG] Permission denied or no SW');
              }
            } else {
              console.log('[PUSH DEBUG] Notification API not available or denied');
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
    setUser(null);
    setIsLoggedIn(false);
    setError(null);
    // localStorage'dan kullanıcı bilgilerini temizle (centralized)
    localStorage.removeItem('token');
    saveToLocalStorage(null, false);
  };

  // Set user directly (for loginChiefObserver and similar cases)
  const setUserFromLogin = (userData, token) => {
    if (token) { localStorage.setItem('token', token); }
    setUser(userData);
    setIsLoggedIn(true);
    saveToLocalStorage(userData, true);
  };

  const value = {
    user,
    isLoggedIn,
    loading,
    error,
    userRole: getUserRole(), // Computed property for userRole
    login,
    verify2FA,
    logout,
    setUserFromLogin // For direct user setting (e.g., chief observer login)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};