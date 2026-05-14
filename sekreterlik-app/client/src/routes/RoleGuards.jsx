import React from 'react';
import { Navigate } from 'react-router-dom';
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

  // Capabilities Model: aktif görev varsa o panele yönlendir
  if (user?.role !== 'admin' && user?.observerId) {
    return <Navigate to="/chief-observer-dashboard" replace />;
  }
  if (user?.role !== 'admin' && user?.coordinatorId) {
    return <Navigate to="/coordinator-dashboard" replace />;
  }

  // Müşahit (saf veya legacy) → müşahit panel
  if (userRole === 'chief_observer' || userRole === 'musahit') {
    return <Navigate to="/chief-observer-dashboard" replace />;
  }

  // Coordinator kullanıcılarını kendi dashboard'ına yönlendir
  const coordinatorRoles = ['coordinator', 'provincial_coordinator', 'district_supervisor', 'region_supervisor', 'institution_supervisor'];
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

// Public route component - Redirects all logged-in users to their appropriate dashboard
export const PublicRoute = ({ children }) => {
  const { loading, isLoggedIn, userRole, user } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (isLoggedIn) {
    // Capabilities Model: aktif görev (observerId/coordinatorId) öncelikli
    if (userRole !== 'admin' && user?.observerId) {
      return <Navigate to="/chief-observer-dashboard" replace />;
    }
    if (userRole !== 'admin' && user?.coordinatorId) {
      return <Navigate to="/coordinator-dashboard" replace />;
    }
    switch (userRole) {
      case 'admin':
        return <Navigate to="/" replace />;
      case 'member':
        return <Navigate to="/member-dashboard" replace />;
      case 'district_president':
        return <Navigate to="/district-president-dashboard" replace />;
      case 'town_president':
        return <Navigate to="/town-president-dashboard" replace />;
      case 'chief_observer':
      case 'musahit':
        return <Navigate to="/chief-observer-dashboard" replace />;
      case 'coordinator':
      case 'provincial_coordinator':
      case 'district_supervisor':
      case 'region_supervisor':
      case 'institution_supervisor':
        return <Navigate to="/coordinator-dashboard" replace />;
      default:
        return <Navigate to="/" replace />;
    }
  }

  return children;
};

// Chief Observer için özel route guard (Capabilities Model)
// Üç senaryoyu da kabul eder:
//  - Legacy login: userRole='chief_observer'
//  - Yeni saf müşahit: userRole/userType='musahit'
//  - Yeni hibrit (üye+müşahit): user.observerId dolu
export const ChiefObserverRoute = ({ children }) => {
  const { loading, isLoggedIn, userRole, user } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isLoggedIn || !user) {
    return <Navigate to="/login?type=chief-observer" replace />;
  }

  const hasObserverAccess =
    userRole === 'chief_observer' ||
    userRole === 'musahit' ||
    !!user?.observerId;

  if (!hasObserverAccess) {
    return <Navigate to="/login?type=chief-observer" replace />;
  }

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

