import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ApiService from '../utils/ApiService';
import LandingPageSettings from '../components/LandingPageSettings';

const LandingPageManagerPage = () => {
  const { user } = useAuth();
  const [grantedPermissions, setGrantedPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user || user.role === 'admin') {
        setLoading(false);
        return;
      }
      if (user.role === 'member' && user.position) {
        try {
          const perms = await ApiService.getPermissionsForPosition(user.position);
          setGrantedPermissions(Array.isArray(perms) ? perms : []);
        } catch {
          setGrantedPermissions([]);
        }
      }
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const isAdmin = user?.role === 'admin';
  const allowed = isAdmin || grantedPermissions.includes('manage_landing_page');

  if (!allowed) {
    return <Navigate to="/member-dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tanıtım Sayfası Yönetimi</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Halka açık landing sayfası içeriğini düzenleyin
            </p>
          </div>
          <Link
            to={isAdmin ? '/admin' : '/member-dashboard'}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            ← Dashboard
          </Link>
        </div>
        <LandingPageSettings />
      </div>
    </div>
  );
};

export default LandingPageManagerPage;
