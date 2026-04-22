import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../utils/ApiService';
import LoadingSpinner from './LoadingSpinner';
import LoginHeader from './LoginHeader';
import LoginForm from './LoginForm';
import { motion, AnimatePresence } from 'framer-motion';
import { isMobile } from '../../utils/capacitorUtils';
import { getBrandingSettings, getThemeSettingsCached } from '../../utils/brandingLoader';

const TABS = [
  { key: 'admin-member', label: 'Yönetici / Üye' },
  { key: 'chief-observer', label: 'Başmüşahit' },
  { key: 'coordinator', label: 'Sorumlu' },
];

const LoginEnhanced = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('admin-member');
  const [branding, setBranding] = useState(null);
  const [theme, setTheme] = useState(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const { login, verify2FA, setUserFromLogin } = useAuth();
  const navigate = useNavigate();

  const [show2FA, setShow2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [tempToken, setTempToken] = useState('');

  const [ballotNumber, setBallotNumber] = useState('');
  const [tc, setTc] = useState('');
  const [chiefObserverLoading, setChiefObserverLoading] = useState(false);
  const [chiefObserverError, setChiefObserverError] = useState('');
  const [rememberChiefObserver, setRememberChiefObserver] = useState(false);

  const [coordinatorTc, setCoordinatorTc] = useState('');
  const [coordinatorPhone, setCoordinatorPhone] = useState('');
  const [coordinatorLoading, setCoordinatorLoading] = useState(false);
  const [coordinatorError, setCoordinatorError] = useState('');
  const [rememberCoordinator, setRememberCoordinator] = useState(false);

  useEffect(() => {
    setBranding(getBrandingSettings());
    setTheme(getThemeSettingsCached());
    const handleUpdate = () => {
      setBranding(getBrandingSettings());
      setTheme(getThemeSettingsCached());
    };
    window.addEventListener('brandingUpdated', handleUpdate);
    window.addEventListener('themeUpdated', handleUpdate);
    return () => {
      window.removeEventListener('brandingUpdated', handleUpdate);
      window.removeEventListener('themeUpdated', handleUpdate);
    };
  }, []);

  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'chief-observer') setActiveTab('chief-observer');
    else if (type === 'coordinator') setActiveTab('coordinator');
    else setActiveTab('admin-member');
  }, [searchParams]);

  const handleAdminMemberSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const success = await login(username, password);
      if (success && typeof success === 'object' && success.requires2FA) {
        setTempToken(success.tempToken);
        setShow2FA(true);
        return;
      }
      if (success) {
        setShowSuccess(true);
        const savedUser = localStorage.getItem('user');
        let role = null;
        if (savedUser) {
          const userData = JSON.parse(savedUser);
          role = userData.role || userData.userRole || userData.user_type;
        }
        setTimeout(() => {
          switch (role) {
            case 'admin': navigate('/'); break;
            case 'member': navigate('/member-dashboard'); break;
            case 'district_president': navigate('/district-president-dashboard'); break;
            case 'chief_observer': navigate('/chief-observer-dashboard'); break;
            default: navigate('/'); break;
          }
        }, 1000);
      } else {
        setError('Geçersiz kullanıcı adı veya şifre');
      }
    } catch (err) {
      setError('Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChiefObserverSubmit = async (e) => {
    e.preventDefault();
    setChiefObserverError('');
    setChiefObserverLoading(true);
    try {
      const res = await ApiService.loginChiefObserver(ballotNumber, tc);
      if (res?.success && res?.user) {
        setUserFromLogin(res.user);
        if (res.token) localStorage.setItem('token', res.token);
        setShowSuccess(true);
        setTimeout(() => navigate('/chief-observer-dashboard'), 800);
      } else {
        setChiefObserverError(res?.message || 'Başmüşahit girişi başarısız');
      }
    } catch (err) {
      setChiefObserverError('Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.');
    } finally {
      setChiefObserverLoading(false);
    }
  };

  const handleCoordinatorSubmit = async (e) => {
    e.preventDefault();
    setCoordinatorError('');
    setCoordinatorLoading(true);
    try {
      const res = await ApiService.loginCoordinator(coordinatorTc, coordinatorPhone);
      if (res?.success && res?.user) {
        setUserFromLogin(res.user);
        if (res.token) localStorage.setItem('token', res.token);
        setShowSuccess(true);
        setTimeout(() => navigate('/coordinator-dashboard'), 800);
      } else {
        setCoordinatorError(res?.message || 'Sorumlu girişi başarısız');
      }
    } catch (err) {
      setCoordinatorError('Giriş yapılamadı. Lütfen bilgilerinizi kontrol edin.');
    } finally {
      setCoordinatorLoading(false);
    }
  };

  const switchTab = (key) => {
    setActiveTab(key);
    setSearchParams(key === 'admin-member' ? {} : { type: key });
  };

  const currentYear = new Date().getFullYear();
  const footerCompanyName = theme?.footerCompanyName || 'DAT Dijital';

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Subtle Corporate Background Detail */}
      <div className="absolute inset-0 z-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
        <svg width="100%" height="100%"><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/></pattern><rect width="100%" height="100%" fill="url(#grid)" /></svg>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-[440px] z-10"
      >
        <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-gray-100 dark:border-gray-800 overflow-hidden">
          
          <div className="p-8 pb-4">
            <LoginHeader />
          </div>

          <div className="px-8 pb-8">
            {/* Professional Segmented Control */}
            <div className="flex p-1 bg-gray-100/80 dark:bg-gray-900/50 rounded-xl mb-8">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => switchTab(tab.key)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-200 ${
                    activeTab === tab.key
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'admin-member' && (
                <motion.div key="admin" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <LoginForm
                    username={username} setUsername={setUsername}
                    password={password} setPassword={setPassword}
                    error={error} isLoading={isLoading}
                    handleSubmit={handleAdminMemberSubmit}
                    rememberMe={rememberMe} setRememberMe={setRememberMe}
                  />
                </motion.div>
              )}

              {activeTab === 'chief-observer' && (
                <motion.div key="chief" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <form onSubmit={handleChiefObserverSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Sandık Numarası</label>
                      <input
                        type="text"
                        value={ballotNumber}
                        onChange={(e) => setBallotNumber(e.target.value)}
                        required
                        placeholder="Örn: 1234"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">TC Kimlik No</label>
                      <input
                        type="text"
                        value={tc}
                        onChange={(e) => setTc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        required
                        maxLength={11}
                        placeholder="11 haneli TC"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                    {chiefObserverError && (
                      <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                        {chiefObserverError}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={chiefObserverLoading}
                      className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-semibold transition-colors"
                    >
                      {chiefObserverLoading ? 'Giriş yapılıyor...' : 'Başmüşahit Girişi'}
                    </button>
                  </form>
                </motion.div>
              )}

              {activeTab === 'coordinator' && (
                <motion.div key="coord" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                  <form onSubmit={handleCoordinatorSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">TC Kimlik No</label>
                      <input
                        type="text"
                        value={coordinatorTc}
                        onChange={(e) => setCoordinatorTc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        required
                        maxLength={11}
                        placeholder="11 haneli TC"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Telefon</label>
                      <input
                        type="tel"
                        value={coordinatorPhone}
                        onChange={(e) => setCoordinatorPhone(e.target.value)}
                        required
                        placeholder="05XX XXX XX XX"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 dark:text-white"
                      />
                    </div>
                    {coordinatorError && (
                      <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                        {coordinatorError}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={coordinatorLoading}
                      className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white font-semibold transition-colors"
                    >
                      {coordinatorLoading ? 'Giriş yapılıyor...' : 'Sorumlu Girişi'}
                    </button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-8 pt-6 border-t border-gray-50 dark:border-gray-800 text-center">
               <Link to="/public/apply" className="text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors">
                Yönetime Başvuru Yap
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
          © {currentYear} {footerCompanyName} • Profesyonel Sekreterlik Çözümleri
        </p>
      </motion.div>
    </div>
  );
};

export default LoginEnhanced;
