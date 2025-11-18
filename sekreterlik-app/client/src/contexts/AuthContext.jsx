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
        setUser(response.user);
        setIsLoggedIn(true);
        // localStorage'a kullanıcı bilgilerini kaydet (centralized)
        saveToLocalStorage(response.user, true);
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

  const logout = () => {
    setUser(null);
    setIsLoggedIn(false);
    setError(null);
    // localStorage'dan kullanıcı bilgilerini temizle (centralized)
    saveToLocalStorage(null, false);
  };

  // Set user directly (for loginChiefObserver and similar cases)
  const setUserFromLogin = (userData) => {
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
    logout,
    setUserFromLogin // For direct user setting (e.g., chief observer login)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};