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
        const savedUser = localStorage.getItem('user');
        const savedIsLoggedIn = localStorage.getItem('isLoggedIn');
        
        if (savedUser && savedIsLoggedIn === 'true') {
          try {
            const userData = JSON.parse(savedUser);
            setUser(userData);
            setIsLoggedIn(true);
            setLoading(false); // Set loading to false immediately
          } catch (error) {
            console.error('Error parsing saved user data:', error);
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
        
        // Then, listen to Firebase auth state changes (for real-time updates)
        unsubscribe = onAuthStateChanged(authInstance, async (firebaseUser) => {
          if (firebaseUser) {
            // Firebase user varsa, kullanıcı bilgilerini localStorage'dan al
            const savedUser = localStorage.getItem('user');
            const savedIsLoggedIn = localStorage.getItem('isLoggedIn');
            
            if (savedUser && savedIsLoggedIn === 'true') {
              try {
                const userData = JSON.parse(savedUser);
                // Firebase UID ile eşleşiyorsa kullanıcıyı ayarla
                if (userData.id === firebaseUser.uid || userData.uid === firebaseUser.uid) {
                  setUser(userData);
                  setIsLoggedIn(true);
                  // localStorage'ı güncelle (yeniden kaydet)
                  localStorage.setItem('user', JSON.stringify(userData));
                  localStorage.setItem('isLoggedIn', 'true');
                } else {
                  // UID eşleşmiyorsa, ancak localStorage'da user varsa ve isLoggedIn true ise
                  // Kullanıcı manuel logout yapmadıysa, localStorage'daki user'ı kullan
                  // (Firebase auth state değişikliği bazen yanlış logout'a neden olabilir)
                  console.warn('Firebase UID mismatch, but keeping localStorage user');
                  setUser(userData);
                  setIsLoggedIn(true);
                }
              } catch (error) {
                console.error('Error parsing saved user data:', error);
                // Hata durumunda bile localStorage'daki user'ı kullan
                const savedUserRaw = localStorage.getItem('user');
                if (savedUserRaw && savedIsLoggedIn === 'true') {
                  try {
                    const userData = JSON.parse(savedUserRaw);
                    setUser(userData);
                    setIsLoggedIn(true);
                  } catch (e) {
                    // Parse hatası varsa logout yap
                    setUser(null);
                    setIsLoggedIn(false);
                    localStorage.removeItem('user');
                    localStorage.removeItem('isLoggedIn');
                  }
                }
              }
            } else if (savedUser) {
              // localStorage'da user var ama isLoggedIn false/null
              // Bu durumda user'ı yükle (sayfa yenileme sonrası)
              try {
                const userData = JSON.parse(savedUser);
                setUser(userData);
                setIsLoggedIn(true);
                localStorage.setItem('isLoggedIn', 'true');
              } catch (error) {
                console.error('Error parsing saved user data:', error);
              }
            }
          } else {
            // Firebase user yoksa, ancak localStorage'da user varsa ve isLoggedIn true ise
            // Kullanıcı manuel logout yapmadıysa, localStorage'daki user'ı kullan
            const savedUser = localStorage.getItem('user');
            const savedIsLoggedIn = localStorage.getItem('isLoggedIn');
            
            if (savedUser && savedIsLoggedIn === 'true') {
              // Firebase auth state değişikliği bazen yanlış logout'a neden olabilir
              // Bu durumda localStorage'daki user'ı kullan
              console.warn('Firebase user not found, but keeping localStorage user');
              try {
                const userData = JSON.parse(savedUser);
                setUser(userData);
                setIsLoggedIn(true);
              } catch (error) {
                console.error('Error parsing saved user data:', error);
                // Parse hatası varsa logout yap
                setUser(null);
                setIsLoggedIn(false);
                localStorage.removeItem('user');
                localStorage.removeItem('isLoggedIn');
              }
            } else {
              // Gerçekten logout yapılmalı
              setUser(null);
              setIsLoggedIn(false);
              localStorage.removeItem('user');
              localStorage.removeItem('isLoggedIn');
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
      const savedUser = localStorage.getItem('user');
      const savedIsLoggedIn = localStorage.getItem('isLoggedIn');
      
      if (savedUser && savedIsLoggedIn === 'true') {
        try {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setIsLoggedIn(true);
          setLoading(false); // Set loading to false immediately
        } catch (error) {
          console.error('Error parsing saved user data:', error);
          localStorage.removeItem('user');
          localStorage.removeItem('isLoggedIn');
          setLoading(false);
        }
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
        // localStorage'a kullanıcı bilgilerini kaydet
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('isLoggedIn', 'true');
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
    // localStorage'dan kullanıcı bilgilerini temizle
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
  };

  const value = {
    user,
    isLoggedIn,
    loading,
    error,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};