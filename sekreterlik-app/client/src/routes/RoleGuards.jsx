import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Loading component
const LoadingScreen = () => (
  <div className="flex items-center justify-center min-h-screen">Yükleniyor...</div>
);

// Protected route component - requires authentication
export const ProtectedRoute = ({ children }) => {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return isLoggedIn ? children : <Navigate to="/login" />;
};

// Admin only route component
export const AdminRoute = ({ children }) => {
  const { isLoggedIn, user, userRole, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isLoggedIn) return <Navigate to="/login" />;
  
  // Başmüşahit kullanıcısını kendi dashboard'ına yönlendir
  if (userRole === 'chief_observer') {
    return <Navigate to="/chief-observer-dashboard" replace />;
  }
  
  // Coordinator kullanıcılarını kendi dashboard'ına yönlendir
  const coordinatorRoles = ['provincial_coordinator', 'district_supervisor', 'region_supervisor', 'institution_supervisor'];
  if (coordinatorRoles.includes(userRole)) {
    return <Navigate to="/coordinator-dashboard" replace />;
  }
  
  if (user?.role !== 'admin') return <Navigate to="/member-dashboard" />;
  return children;
};

// Member route component (for members only)
export const MemberRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isLoggedIn) return <Navigate to="/login" />;
  if (user?.role !== 'member') return <Navigate to="/" />;
  return children;
};

// District President route component
export const DistrictPresidentRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isLoggedIn) return <Navigate to="/login" />;
  if (user?.role !== 'district_president') return <Navigate to="/" />;
  return children;
};

// Town President route component
export const TownPresidentRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isLoggedIn) return <Navigate to="/login" />;
  if (user?.role !== 'town_president') return <Navigate to="/" />;
  return children;
};

// STK Manager route component (for STK management permission)
export const STKManagerRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isLoggedIn) return <Navigate to="/login" />;
  // İleri seviye: İzin kontrolü yapılabilir (grantedPermissions)
  // Şu an için admin, member veya district_president'a izin ver
  if (user?.role === 'admin' || user?.role === 'member' || user?.role === 'district_president') {
    return children;
  }
  return <Navigate to="/" />;
};

// Public Institution Manager route component
export const PublicInstitutionManagerRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isLoggedIn) return <Navigate to="/login" />;
  // İleri seviye: İzin kontrolü yapılabilir (grantedPermissions)
  // Şu an için admin, member veya district_president'a izin ver
  if (user?.role === 'admin' || user?.role === 'member' || user?.role === 'district_president') {
    return children;
  }
  return <Navigate to="/" />;
};

// Mosque Manager route component
export const MosqueManagerRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isLoggedIn) return <Navigate to="/login" />;
  // İleri seviye: İzin kontrolü yapılabilir (grantedPermissions)
  // Şu an için admin, member veya district_president'a izin ver
  if (user?.role === 'admin' || user?.role === 'member' || user?.role === 'district_president') {
    return children;
  }
  return <Navigate to="/" />;
};

// Town President role-based route
export const TownPresidentRoleRoute = ({ children }) => {
  const { isLoggedIn, user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isLoggedIn) return <Navigate to="/login" />;
  if (user?.role === 'town_president') return children;
  return <Navigate to="/login" />;
};

// Public route component - Sadece loading kontrolü yapar
// NOT: Yönlendirme yapmıyor - login sayfası kendi içinde kontrol edecek
export const PublicRoute = ({ children }) => {
  const { loading, isLoggedIn, userRole, user } = useAuth();
  const location = useLocation();
  
  // Sadece loading kontrolü
  if (loading) {
    return <LoadingScreen />;
  }
  
  // Login sayfasındaysak ve zaten giriş yapılmışsa yönlendir
  if (location.pathname === '/login') {
    if (userRole === 'chief_observer' && isLoggedIn && user) {
      return <Navigate to="/chief-observer-dashboard" replace />;
    }
  }
  
  // Children'ı göster - yönlendirme yapmadan
  return children;
};

// Chief Observer için özel route guard
export const ChiefObserverRoute = ({ children }) => {
  const { loading, isLoggedIn, userRole, user } = useAuth();
  
  // Loading state
  if (loading) {
    return <LoadingScreen />;
  }
  
  // Authentication kontrolü
  if (!isLoggedIn || userRole !== 'chief_observer' || !user) {
    return <Navigate to="/login?type=chief-observer" replace />;
  }
  
  // Tüm kontroller geçti - dashboard'ı göster
  return children;
};

// Coordinator route component - allows both admin and coordinator users
export const CoordinatorRoute = ({ children }) => {
  const { isLoggedIn, user, userRole, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!isLoggedIn) return <Navigate to="/login" />;
  
  // Admin ve coordinator kullanıcıları erişebilir
  const coordinatorRoles = ['provincial_coordinator', 'district_supervisor', 'region_supervisor', 'institution_supervisor'];
  if (user?.role === 'admin' || coordinatorRoles.includes(userRole)) {
    return children;
  }
  
  return <Navigate to="/login" />;
};

