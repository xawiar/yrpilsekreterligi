import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import { useAuth } from '../contexts/AuthContext';

const CoordinatorLoginPage = () => {
  const [tc, setTc] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const { isLoggedIn, userRole, user, setUserFromLogin } = useAuth();
  
  // Zaten giriş yapılmışsa dashboard'a yönlendir
  const hasCheckedAuth = React.useRef(false);
  
  useEffect(() => {
    if (hasCheckedAuth.current) {
      return;
    }
    
    hasCheckedAuth.current = true;
    const currentPath = window.location.pathname;
    
    // Coordinator rolleri kontrolü
    const coordinatorRoles = ['provincial_coordinator', 'district_supervisor', 'region_supervisor', 'institution_supervisor'];
    if (coordinatorRoles.includes(userRole) && isLoggedIn && user && currentPath === '/coordinator-login') {
      navigate('/coordinator-dashboard', { replace: true });
    }
  }, [isLoggedIn, userRole, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await ApiService.loginCoordinator(tc.trim(), phone.trim());
      
      if (result.success) {
        // Set user in AuthContext
        setUserFromLogin(result.user);
        // Dashboard'a yönlendir
        navigate('/coordinator-dashboard', { replace: true });
      } else {
        setError(result.message || 'Giriş başarısız');
      }
    } catch (err) {
      setError(err.message || 'Giriş sırasında bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Sorumlu Girişi</h1>
          <p className="mt-2 text-sm text-gray-600">
            TC kimlik numaranız ve telefon numaranız ile giriş yapın
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="tc" className="block text-sm font-medium text-gray-700 mb-2">
              TC Kimlik Numarası
            </label>
            <input
              id="tc"
              type="text"
              value={tc}
              onChange={(e) => setTc(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900"
              placeholder="11 haneli TC kimlik numaranız"
              maxLength={11}
              required
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Telefon Numarası
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900"
              placeholder="5XX XXX XX XX"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CoordinatorLoginPage;

