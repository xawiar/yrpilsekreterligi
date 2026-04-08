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

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                    */
/* ------------------------------------------------------------------ */
const TABS = [
  { key: 'admin-member', label: 'Yonetici/Uye' },
  { key: 'chief-observer', label: 'Basmusahit' },
  { key: 'coordinator', label: 'Sorumlu' },
];

/* ==================================================================
   MAIN COMPONENT
   ================================================================== */
const LoginEnhanced = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('admin-member');

  // Branding
  const [branding, setBranding] = useState(null);
  const [theme, setTheme] = useState(null);

  // Admin/Uye form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login, verify2FA, user, setUserFromLogin } = useAuth();
  const navigate = useNavigate();

  // 2FA state
  const [show2FA, setShow2FA] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');
  const [tempToken, setTempToken] = useState('');

  // Basmusahit form state
  const [ballotNumber, setBallotNumber] = useState('');
  const [tc, setTc] = useState('');
  const [chiefObserverLoading, setChiefObserverLoading] = useState(false);
  const [chiefObserverError, setChiefObserverError] = useState('');
  const [rememberChiefObserver, setRememberChiefObserver] = useState(false);

  // Sorumlu form state
  const [coordinatorTc, setCoordinatorTc] = useState('');
  const [coordinatorPhone, setCoordinatorPhone] = useState('');
  const [coordinatorLoading, setCoordinatorLoading] = useState(false);
  const [coordinatorError, setCoordinatorError] = useState('');
  const [rememberCoordinator, setRememberCoordinator] = useState(false);

  const mobileView = isMobile();

  // --- Load branding ---
  useEffect(() => {
    setBranding(getBrandingSettings());
    setTheme(getThemeSettingsCached());

    const handleUpdate = () => {
      setBranding(getBrandingSettings());
      setTheme(getThemeSettingsCached());
    };
    window.addEventListener('brandingUpdated', handleUpdate);
    window.addEventListener('themeUpdated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('brandingUpdated', handleUpdate);
      window.removeEventListener('themeUpdated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // --- URL tab param ---
  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'chief-observer') setActiveTab('chief-observer');
    else if (type === 'coordinator') setActiveTab('coordinator');
    else setActiveTab('admin-member');
  }, [searchParams]);

  // --- Load saved credentials ---
  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    const savedRememberMe = localStorage.getItem('rememberMe') === 'true';
    localStorage.removeItem('rememberedPassword');

    if (savedRememberMe && savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }

    const savedBallotNumber = sessionStorage.getItem('rememberedBallotNumber');
    const savedTc = sessionStorage.getItem('rememberedTc');
    const savedRememberChiefObserver = sessionStorage.getItem('rememberChiefObserver') === 'true';
    localStorage.removeItem('rememberedBallotNumber');
    localStorage.removeItem('rememberedTc');
    localStorage.removeItem('rememberChiefObserver');

    if (savedRememberChiefObserver && savedBallotNumber && savedTc) {
      setBallotNumber(savedBallotNumber);
      setTc(savedTc);
      setRememberChiefObserver(true);
    }

    const savedCoordinatorTc = sessionStorage.getItem('rememberedCoordinatorTc');
    const savedRememberCoordinator = sessionStorage.getItem('rememberCoordinator') === 'true';
    localStorage.removeItem('rememberedCoordinatorTc');
    localStorage.removeItem('rememberCoordinator');
    localStorage.removeItem('rememberedCoordinatorPhone');

    if (savedRememberCoordinator && savedCoordinatorTc) {
      setCoordinatorTc(savedCoordinatorTc);
      setRememberCoordinator(true);
    }
  }, []);

  /* ----------------------------------------------------------------
     Submit handlers (unchanged logic)
     ---------------------------------------------------------------- */
  const handleAdminMemberSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Kullanici adi alani bos birakilamaz');
      document.getElementById('username')?.focus();
      return;
    }
    if (!password) {
      setError('Sifre alani bos birakilamaz');
      document.getElementById('password')?.focus();
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(username, password);

      if (success && typeof success === 'object' && success.requires2FA) {
        setTempToken(success.tempToken);
        setShow2FA(true);
        setIsLoading(false);
        return;
      }

      if (success) {
        if (rememberMe) {
          localStorage.setItem('rememberedUsername', username);
          localStorage.setItem('rememberMe', 'true');
        } else {
          localStorage.removeItem('rememberedUsername');
          localStorage.removeItem('rememberMe');
        }
        localStorage.removeItem('rememberedPassword');

        setShowSuccess(true);

        const savedUser = localStorage.getItem('user');
        let role = null;
        if (savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            role = userData.role || userData.userRole || userData.user_type;
          } catch (_) { /* ignore */ }
        }
        switch (role) {
          case 'admin': navigate('/', { replace: true }); break;
          case 'member': navigate('/member-dashboard', { replace: true }); break;
          case 'district_president': navigate('/district-president-dashboard', { replace: true }); break;
          case 'town_president': navigate('/town-president-dashboard', { replace: true }); break;
          case 'chief_observer': navigate('/chief-observer-dashboard', { replace: true }); break;
          case 'provincial_coordinator':
          case 'district_supervisor':
          case 'region_supervisor':
          case 'institution_supervisor':
            navigate('/coordinator-dashboard', { replace: true }); break;
          default: navigate('/', { replace: true }); break;
        }
      } else {
        setError('Gecersiz kullanici adi veya sifre');
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('timeout')) {
        setError('Istek zaman asimina ugradi. Lutfen tekrar deneyin.');
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('Network request failed')) {
        setError('Sunucuya baglanilamadi. Internet baglantinizi kontrol edin.');
      } else {
        setError('Giris sirasinda bir hata olustu. Lutfen tekrar deneyin.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChiefObserverSubmit = async (e) => {
    e.preventDefault();
    setChiefObserverError('');
    setChiefObserverLoading(true);

    try {
      const result = await ApiService.loginChiefObserver(ballotNumber.trim(), tc.trim());
      if (result.success) {
        if (rememberChiefObserver) {
          sessionStorage.setItem('rememberedBallotNumber', ballotNumber.trim());
          sessionStorage.setItem('rememberedTc', tc.trim());
          sessionStorage.setItem('rememberChiefObserver', 'true');
        } else {
          sessionStorage.removeItem('rememberedBallotNumber');
          sessionStorage.removeItem('rememberedTc');
          sessionStorage.removeItem('rememberChiefObserver');
        }
        setUserFromLogin(result.user);
        navigate('/chief-observer-dashboard', { replace: true });
      } else {
        setChiefObserverError(result.message || 'Sandik numarasi veya TC kimlik numarasi hatali.');
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('timeout')) {
        setChiefObserverError('Istek zaman asimina ugradi. Lutfen tekrar deneyin.');
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('Network request failed')) {
        setChiefObserverError('Sunucuya baglanilamadi. Internet baglantinizi kontrol edin.');
      } else if (err.message?.includes('500')) {
        setChiefObserverError('Sunucu hatasi. Lutfen daha sonra tekrar deneyin.');
      } else if (err.message?.includes('401')) {
        setChiefObserverError('Sandik numarasi veya TC kimlik numarasi hatali.');
      } else {
        setChiefObserverError('Giris sirasinda bir hata olustu. Lutfen tekrar deneyin.');
      }
    } finally {
      setChiefObserverLoading(false);
    }
  };

  const handleCoordinatorSubmit = async (e) => {
    e.preventDefault();
    setCoordinatorError('');
    setCoordinatorLoading(true);

    try {
      const result = await ApiService.loginCoordinator(coordinatorTc.trim(), coordinatorPhone.trim());
      if (result.success) {
        if (rememberCoordinator) {
          sessionStorage.setItem('rememberedCoordinatorTc', coordinatorTc.trim());
          sessionStorage.setItem('rememberCoordinator', 'true');
        } else {
          sessionStorage.removeItem('rememberedCoordinatorTc');
          sessionStorage.removeItem('rememberCoordinator');
        }
        setUserFromLogin(result.user);
        navigate('/coordinator-dashboard', { replace: true });
      } else {
        setCoordinatorError(result.message || 'TC kimlik numarasi veya telefon numarasi hatali.');
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.message?.includes('timeout')) {
        setCoordinatorError('Istek zaman asimina ugradi. Lutfen tekrar deneyin.');
      } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || err.message?.includes('Network request failed')) {
        setCoordinatorError('Sunucuya baglanilamadi. Internet baglantinizi kontrol edin.');
      } else if (err.message?.includes('500')) {
        setCoordinatorError('Sunucu hatasi. Lutfen daha sonra tekrar deneyin.');
      } else if (err.message?.includes('401')) {
        setCoordinatorError('TC kimlik numarasi veya telefon numarasi hatali.');
      } else {
        setCoordinatorError('Giris sirasinda bir hata olustu. Lutfen tekrar deneyin.');
      }
    } finally {
      setCoordinatorLoading(false);
    }
  };

  /* ----------------------------------------------------------------
     Branding values
     ---------------------------------------------------------------- */
  const footerCompanyName = theme?.footerCompanyName || 'DAT Dijital';
  const footerCompanyUrl = theme?.footerCompanyUrl || 'https://www.datdijital.com/';
  const currentYear = new Date().getFullYear();

  /* ----------------------------------------------------------------
     Tab switching helper
     ---------------------------------------------------------------- */
  const switchTab = (key) => {
    setActiveTab(key);
    const param = key === 'admin-member' ? null : key;
    setSearchParams(param ? { type: param } : {});
    setError('');
    setChiefObserverError('');
    setCoordinatorError('');
  };

  /* ----------------------------------------------------------------
     Shared input style for chief-observer / coordinator forms
     ---------------------------------------------------------------- */
  const inputClass = "appearance-none block w-full pl-10 pr-3 py-3 border border-gray-200/60 dark:border-gray-600 rounded-xl placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 focus:shadow-lg focus:shadow-primary-500/20 text-sm transition-all bg-white/90 dark:bg-gray-700 text-gray-900 dark:text-gray-100 backdrop-blur-sm";
  const inputShadow = { boxShadow: '0 2px 8px rgba(0,0,0,0.05), 0 0 0 1px rgba(255,255,255,0.5) inset' };

  /* ==================================================================
     RENDER
     ================================================================== */
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-primary-50 to-primary-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />

      {/* Login card */}
      <div className="relative bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl shadow-2xl p-8 w-full max-w-md z-10">

        {/* LoginHeader: 3D animated logo + party name + slogan */}
        <LoginHeader />

        {/* Tab navigation - compact pill-shaped segmented control */}
        <div className="flex justify-center gap-1 mb-6 bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => switchTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-gray-600 text-primary-700 dark:text-primary-300 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ---- Success state ---- */}
        {showSuccess && activeTab === 'admin-member' ? (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-center py-12"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-4">
              <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Giris Basarili!</h3>
            <p className="text-gray-500 dark:text-gray-400">Yonlendiriliyorsunuz...</p>
          </motion.div>

        /* ---- 2FA state ---- */
        ) : show2FA ? (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Iki Faktorlu Dogrulama</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Authenticator uygulamanizdan 6 haneli kodu girin
              </p>
            </div>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
            <form onSubmit={async (e) => {
              e.preventDefault();
              setIsLoading(true);
              setError('');
              const result = await verify2FA(twoFACode, tempToken);
              if (result) {
                setShowSuccess(true);
                setTimeout(() => navigate('/', { replace: true }), 500);
              } else {
                setError('Gecersiz dogrulama kodu');
              }
              setIsLoading(false);
            }} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={twoFACode}
                onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full text-center text-2xl tracking-[0.5em] px-4 py-3 border border-gray-200/60 dark:border-gray-600 rounded-xl bg-white/90 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500"
                style={inputShadow}
                autoFocus
              />
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98, y: 0 }}
                type="submit"
                disabled={isLoading || twoFACode.length !== 6}
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed relative overflow-hidden"
                style={{
                  boxShadow: '0 10px 30px -10px rgba(16, 185, 129, 0.5), 0 0 0 1px rgba(255,255,255,0.1) inset, 0 1px 0 rgba(255,255,255,0.2) inset'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
                <span className="relative z-10">{isLoading ? 'Dogrulaniyor...' : 'Dogrula'}</span>
              </motion.button>
            </form>
            <button
              onClick={() => { setShow2FA(false); setTwoFACode(''); setTempToken(''); setError(''); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              Geri Don
            </button>
          </div>

        /* ---- Admin/Member form (uses LoginForm component) ---- */
        ) : activeTab === 'admin-member' ? (
          <>
            <LoginForm
              username={username}
              setUsername={setUsername}
              password={password}
              setPassword={setPassword}
              error={error}
              isLoading={isLoading}
              handleSubmit={handleAdminMemberSubmit}
              rememberMe={rememberMe}
              setRememberMe={setRememberMe}
            />
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-col items-center gap-2">
              <Link
                to="/public/apply"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Yonetime Basvur
              </Link>
              <Link
                to="/privacy-policy"
                className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 hover:underline transition-colors"
              >
                Kisisel Verilerin Korunmasi Hakkinda Aydinlatma Metni
              </Link>
            </div>
          </>

        /* ---- Chief Observer form ---- */
        ) : activeTab === 'chief-observer' ? (
          <form className="space-y-6" onSubmit={handleChiefObserverSubmit} autoComplete="off">
            <AnimatePresence>
              {chiefObserverError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-start">
                    <svg className="h-5 w-5 text-red-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="ml-3 text-sm font-medium text-red-800">{chiefObserverError}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sandik Numarasi */}
            <div>
              <label htmlFor="ballotNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sandik Numarasi
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 9.5h5v-2h-5v2zm0 7h5v-2h-5v2zm6 4.5H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2zM6 11h5V6H6v5zm1-4h3v3H7V7zM6 18h5v-5H6v5zm1-4h3v3H7v-3z" />
                  </svg>
                </div>
                <input
                  id="ballotNumber"
                  name="ballotNumber"
                  type="text"
                  autoComplete="off"
                  required
                  autoFocus
                  value={ballotNumber}
                  onChange={(e) => setBallotNumber(e.target.value)}
                  className={inputClass}
                  style={inputShadow}
                  placeholder="Orn: 1001"
                />
              </div>
            </div>

            {/* TC Kimlik */}
            <div>
              <label htmlFor="tc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                TC Kimlik Numarasi
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6v-2zm0 4h8v2H6v-2zm10-4h2v2h-2v-2z" />
                  </svg>
                </div>
                <input
                  id="tc"
                  name="tc"
                  type="text"
                  autoComplete="off"
                  required
                  value={tc}
                  onChange={(e) => setTc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  maxLength={11}
                  className={inputClass}
                  style={inputShadow}
                  placeholder="11 haneli TC kimlik numaraniz"
                />
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center">
              <input
                id="remember-chief-observer"
                name="remember-chief-observer"
                type="checkbox"
                checked={rememberChiefObserver}
                onChange={(e) => setRememberChiefObserver(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded-full"
              />
              <label htmlFor="remember-chief-observer" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Beni hatirla
              </label>
            </div>

            {/* Submit */}
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98, y: 0 }}
              type="submit"
              disabled={chiefObserverLoading}
              className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed relative overflow-hidden"
              style={{
                boxShadow: '0 10px 30px -10px rgba(16, 185, 129, 0.5), 0 0 0 1px rgba(255,255,255,0.1) inset, 0 1px 0 rgba(255,255,255,0.2) inset'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
              <span className="relative z-10">
                {chiefObserverLoading ? (
                  <div className="flex items-center">
                    <LoadingSpinner />
                    <span className="ml-2">Giris yapiliyor...</span>
                  </div>
                ) : (
                  "Giris Yap"
                )}
              </span>
            </motion.button>
          </form>

        /* ---- Coordinator form ---- */
        ) : (
          <form className="space-y-6" onSubmit={handleCoordinatorSubmit} autoComplete="off">
            <AnimatePresence>
              {coordinatorError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-start">
                    <svg className="h-5 w-5 text-red-400 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="ml-3 text-sm font-medium text-red-800">{coordinatorError}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* TC Kimlik */}
            <div>
              <label htmlFor="coordinatorTc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                TC Kimlik Numarasi
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6v-2zm0 4h8v2H6v-2zm10-4h2v2h-2v-2z" />
                  </svg>
                </div>
                <input
                  id="coordinatorTc"
                  name="coordinatorTc"
                  type="text"
                  autoComplete="off"
                  required
                  autoFocus
                  value={coordinatorTc}
                  onChange={(e) => setCoordinatorTc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  maxLength={11}
                  className={inputClass}
                  style={inputShadow}
                  placeholder="11 haneli TC kimlik numaraniz"
                />
              </div>
            </div>

            {/* Telefon */}
            <div>
              <label htmlFor="coordinatorPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Telefon Numarasi
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                  <svg className="h-5 w-5 text-gray-400 dark:text-gray-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                  </svg>
                </div>
                <input
                  id="coordinatorPhone"
                  name="coordinatorPhone"
                  type="tel"
                  autoComplete="off"
                  required
                  value={coordinatorPhone}
                  onChange={(e) => setCoordinatorPhone(e.target.value.replace(/\D/g, ''))}
                  className={inputClass}
                  style={inputShadow}
                  placeholder="Telefon numaraniz"
                />
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center">
              <input
                id="remember-coordinator"
                name="remember-coordinator"
                type="checkbox"
                checked={rememberCoordinator}
                onChange={(e) => setRememberCoordinator(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-gray-600 rounded-full"
              />
              <label htmlFor="remember-coordinator" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                Beni hatirla
              </label>
            </div>

            {/* Submit */}
            <motion.button
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98, y: 0 }}
              type="submit"
              disabled={coordinatorLoading}
              className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed relative overflow-hidden"
              style={{
                boxShadow: '0 10px 30px -10px rgba(16, 185, 129, 0.5), 0 0 0 1px rgba(255,255,255,0.1) inset, 0 1px 0 rgba(255,255,255,0.2) inset'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none"></div>
              <span className="relative z-10">
                {coordinatorLoading ? (
                  <div className="flex items-center">
                    <LoadingSpinner />
                    <span className="ml-2">Giris yapiliyor...</span>
                  </div>
                ) : (
                  "Giris Yap"
                )}
              </span>
            </motion.button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Il Sekreterlik Yonetim Paneli v4.0 &middot; &copy; {currentYear}{' '}
            <a
              href={footerCompanyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              {footerCompanyName}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginEnhanced;
