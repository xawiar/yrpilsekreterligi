import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../utils/ApiService';
import LoadingSpinner from './LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';
import { isMobile } from '../../utils/capacitorUtils';
import { getBrandingSettings, getThemeSettingsCached } from '../../utils/brandingLoader';

/* ------------------------------------------------------------------ */
/*  SVG Icon Components (inline to avoid external font dependency)    */
/* ------------------------------------------------------------------ */
const IconShield = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
);
const IconPerson = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
);
const IconLock = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z"/></svg>
);
const IconVisibility = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
);
const IconVisibilityOff = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/></svg>
);
const IconAdmin = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M17 11c.34 0 .67.04 1 .09V6.27L10.5 3 3 6.27v4.91c0 4.54 3.2 8.79 7.5 9.82.55-.13 1.08-.32 1.6-.55-.69-.98-1.1-2.17-1.1-3.45 0-3.31 2.69-6 6-6z"/><path d="M17 13c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 1.38c.62 0 1.12.51 1.12 1.12s-.51 1.12-1.12 1.12-1.12-.51-1.12-1.12.5-1.12 1.12-1.12zm0 5.37c-.93 0-1.74-.46-2.24-1.17.05-.72 1.51-1.08 2.24-1.08s2.19.36 2.24 1.08c-.5.71-1.31 1.17-2.24 1.17z"/></svg>
);
const IconBadge = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M20 7h-5V4c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm-9-3h2v5h-2V4zm1 14c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z"/></svg>
);
const IconBuilding = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M6.5 10h-2v7h2v-7zm6 0h-2v7h2v-7zm8.5 9H2v2h19v-2zm-2.5-9h-2v7h2v-7zM11.5 1L2 6v2h19V6l-9.5-5z"/></svg>
);
const IconBallot = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M13 9.5h5v-2h-5v2zm0 7h5v-2h-5v2zm6 4.5H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v14c0 1.1-.9 2-2 2zM6 11h5V6H6v5zm1-4h3v3H7V7zM6 18h5v-5H6v5zm1-4h3v3H7v-3z"/></svg>
);
const IconIdCard = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h2v2H6v-2zm0 4h8v2H6v-2zm10-4h2v2h-2v-2z"/></svg>
);
const IconPhone = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
);
const IconHelp = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/></svg>
);
const IconArrowForward = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>
);
const IconCheck = ({ className = '' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
);
const IconLock2FA = ({ className = '' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
);
const IconError = ({ className = '' }) => (
  <svg className={className} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
);
const IconUserAdd = ({ className = '' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
);

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                    */
/* ------------------------------------------------------------------ */
const TABS = [
  { key: 'admin-member', label: 'Yonetici/Uye', Icon: IconAdmin, param: null },
  { key: 'chief-observer', label: 'Basmusahit', Icon: IconBadge, param: 'chief-observer' },
  { key: 'coordinator', label: 'Sorumlu', Icon: IconBuilding, param: 'coordinator' },
];

/* ------------------------------------------------------------------ */
/*  Reusable form field                                                */
/* ------------------------------------------------------------------ */
const FormField = ({
  id, label, type = 'text', value, onChange, placeholder,
  icon: IconCmp, maxLength, required = true, autoFocus = false,
  showToggle = false, showPassword, onTogglePassword,
  onKeyDown, onKeyUp, capsLock,
  isDark = false,
}) => (
  <div className="group relative">
    <label
      htmlFor={id}
      className={`text-xs font-bold uppercase tracking-widest absolute -top-3 left-0 z-10 px-1 ${
        isDark
          ? 'text-gray-400 bg-gray-900'
          : 'text-gray-500 bg-white dark:text-gray-400 dark:bg-gray-900'
      }`}
      style={{ fontFamily: "'Public Sans', sans-serif" }}
    >
      {label}
    </label>
    <div className={`flex items-center border-b transition-all py-3 ${
      isDark
        ? 'border-gray-600 focus-within:border-yellow-600'
        : 'border-gray-300 dark:border-gray-600 focus-within:border-yellow-600 dark:focus-within:border-yellow-500'
    }`}>
      {IconCmp && (
        <IconCmp className={`w-5 h-5 mr-3 transition-colors flex-shrink-0 ${
          isDark
            ? 'text-gray-500 group-focus-within:text-yellow-600'
            : 'text-gray-400 dark:text-gray-500 group-focus-within:text-yellow-600'
        }`} />
      )}
      <input
        id={id}
        name={id}
        type={showToggle ? (showPassword ? 'text' : 'password') : type}
        autoComplete="off"
        data-form-type="other"
        required={required}
        autoFocus={autoFocus}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        maxLength={maxLength}
        placeholder={placeholder}
        className={`w-full bg-transparent border-none focus:ring-0 p-0 font-medium text-sm placeholder:opacity-50 ${
          isDark
            ? 'text-white placeholder:text-gray-500'
            : 'text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500'
        } ${showToggle ? 'tracking-widest' : ''}`}
      />
      {showToggle && (
        <button
          type="button"
          onClick={onTogglePassword}
          className={`transition-colors flex-shrink-0 ${
            isDark ? 'text-gray-500 hover:text-white' : 'text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300'
          }`}
        >
          {showPassword
            ? <IconVisibility className="w-5 h-5" />
            : <IconVisibilityOff className="w-5 h-5" />
          }
        </button>
      )}
    </div>
    {capsLock && <p className="text-amber-500 text-xs mt-1">Caps Lock acik</p>}
  </div>
);

/* ------------------------------------------------------------------ */
/*  Error alert                                                        */
/* ------------------------------------------------------------------ */
const ErrorAlert = ({ message }) => (
  <AnimatePresence>
    {message && (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4"
      >
        <div className="flex items-start">
          <IconError className="h-5 w-5 text-red-400 flex-shrink-0" />
          <p className="ml-3 text-sm font-medium text-red-800 dark:text-red-300">{message}</p>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

/* ------------------------------------------------------------------ */
/*  Gold gradient submit button                                        */
/* ------------------------------------------------------------------ */
const GoldButton = ({ isLoading, disabled, children }) => (
  <motion.button
    whileHover={{ scale: 1.01 }}
    whileTap={{ scale: 0.98 }}
    type="submit"
    disabled={disabled || isLoading}
    className="w-full py-4 rounded-lg text-white font-bold tracking-widest text-sm shadow-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed"
    style={{ background: 'linear-gradient(135deg, #745b00 0%, #e5c365 100%)' }}
  >
    {isLoading ? (
      <div className="flex items-center">
        <LoadingSpinner />
        <span className="ml-2">Giris yapiliyor...</span>
      </div>
    ) : (
      <>
        <span>{children}</span>
        <IconArrowForward className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </>
    )}
  </motion.button>
);

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

  // Caps Lock
  const [capsLock, setCapsLock] = useState(false);
  const handleCapsDown = (e) => setCapsLock(e.getModifierState('CapsLock'));
  const handleCapsUp = (e) => setCapsLock(e.getModifierState('CapsLock'));

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
  const logoUrl = branding?.logoUrl;
  const loginTitle = theme?.loginTitle || 'Yeniden Refah Partisi';
  const loginSlogan = theme?.loginSlogan || 'Yeniden Buyuk Turkiye';
  const footerCompanyName = theme?.footerCompanyName || 'DAT Dijital';
  const footerCompanyUrl = theme?.footerCompanyUrl || 'https://www.datdijital.com/';
  const currentYear = new Date().getFullYear();

  /* ----------------------------------------------------------------
     Tab switching helper
     ---------------------------------------------------------------- */
  const switchTab = (key, param) => {
    setActiveTab(key);
    setSearchParams(param ? { type: param } : {});
    setError('');
    setChiefObserverError('');
    setCoordinatorError('');
  };

  /* ==================================================================
     RENDER
     ================================================================== */
  return (
    <main className="flex h-screen w-full overflow-hidden bg-white dark:bg-gray-900">

      {/* ============================================================
          LEFT PANEL - Branding (hidden on mobile / small screens)
          ============================================================ */}
      <section
        className="hidden lg:flex flex-col justify-between w-1/2 relative overflow-hidden p-16"
        style={{ backgroundColor: '#101c2e' }}
      >
        {/* Shield watermark */}
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none flex items-center justify-center">
          <IconShield className="w-[40rem] h-[40rem] text-white" />
        </div>

        {/* Top: Identity */}
        <div className="relative z-10 space-y-6">
          {/* Logo row */}
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
              style={{ background: 'linear-gradient(135deg, #745b00 0%, #e5c365 100%)' }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded-full" loading="lazy" />
              ) : (
                <IconBuilding className="w-8 h-8 text-white" />
              )}
            </div>
            <div className="border-l border-white/20 pl-6">
              <h2
                className="text-xs tracking-[0.2em] uppercase font-semibold"
                style={{ color: '#e5c365', fontFamily: "'Public Sans', sans-serif" }}
              >
                T.C. Siyasi Parti Portali
              </h2>
            </div>
          </div>

          {/* Party name */}
          <div className="pt-24 max-w-lg">
            <h1
              className="text-6xl font-bold leading-tight tracking-tight"
              style={{ fontFamily: "'Noto Serif', serif", color: '#e5c365' }}
            >
              {loginTitle.toUpperCase()}
            </h1>
            <div className="h-1 w-24 mt-8 mb-4" style={{ backgroundColor: '#e5c365' }} />
            <p
              className="text-2xl text-white/80 font-light italic tracking-wide"
              style={{ fontFamily: "'Noto Serif', serif" }}
            >
              {loginSlogan}
            </p>
          </div>
        </div>

        {/* Bottom: Kurumsal Erisim box */}
        <div className="relative z-10">
          <div className="bg-white/5 backdrop-blur-md p-8 rounded-lg border border-white/10 max-w-sm">
            <p
              className="text-sm font-semibold tracking-widest mb-2 uppercase"
              style={{ color: '#ffe08d', fontFamily: "'Public Sans', sans-serif" }}
            >
              Kurumsal Erisim
            </p>
            <p className="text-white/60 text-sm leading-relaxed">
              Parti ici yonetim surecleri, uye takip ve teskilat koordinasyon sistemi resmi giris ekranidir.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================
          RIGHT PANEL - Login Form
          ============================================================ */}
      <section className="flex-1 flex flex-col bg-white dark:bg-gray-900 relative">

        {/* Tab navigation */}
        <nav className="flex justify-center items-end h-20 px-4 sm:px-12 space-x-4 sm:space-x-12 border-b border-gray-200 dark:border-gray-700">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key, key === 'admin-member' ? null : key)}
              className={`h-full flex items-center gap-2 border-b-2 text-sm tracking-tight transition-all ${
                activeTab === key
                  ? 'border-yellow-700 text-yellow-700 dark:text-yellow-500 dark:border-yellow-500 font-bold'
                  : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-semibold'
              }`}
              style={{ fontFamily: "'Public Sans', sans-serif" }}
            >
              <Icon className="w-5 h-5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
          <div className="w-full max-w-md">

            {/* Mobile logo (visible on small screens only) */}
            <div className="lg:hidden flex flex-col items-center mb-10 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg mb-4"
                style={{ background: 'linear-gradient(135deg, #745b00 0%, #e5c365 100%)' }}
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-10 w-10 object-contain rounded-full" loading="lazy" />
                ) : (
                  <IconBuilding className="w-8 h-8 text-white" />
                )}
              </div>
              <h1
                className="text-2xl font-bold"
                style={{ fontFamily: "'Noto Serif', serif", color: '#101c2e' }}
              >
                {loginTitle.toUpperCase()}
              </h1>
            </div>

            {/* ---- Success state ---- */}
            {showSuccess && activeTab === 'admin-member' ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-16"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" style={{ backgroundColor: '#e5c36530' }}>
                  <IconCheck className="w-8 h-8" style={{ color: '#745b00' }} />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2" style={{ fontFamily: "'Noto Serif', serif" }}>
                  Giris Basarili!
                </h3>
                <p className="text-gray-500 dark:text-gray-400">Yonlendiriliyorsunuz...</p>
              </motion.div>

            /* ---- 2FA state ---- */
            ) : show2FA ? (
              <div className="space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#e5c36530' }}>
                    <IconLock2FA className="w-8 h-8" style={{ color: '#745b00' }} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100" style={{ fontFamily: "'Noto Serif', serif" }}>
                    Iki Faktorlu Dogrulama
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Authenticator uygulamanizdan 6 haneli kodu girin
                  </p>
                </div>
                {error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
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
                    className="w-full text-center text-2xl tracking-[0.5em] px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-yellow-600"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={isLoading || twoFACode.length !== 6}
                    className="w-full py-3 text-white rounded-lg font-medium transition-all disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg, #745b00 0%, #e5c365 100%)' }}
                  >
                    {isLoading ? 'Dogrulaniyor...' : 'Dogrula'}
                  </button>
                </form>
                <button
                  onClick={() => { setShow2FA(false); setTwoFACode(''); setTempToken(''); setError(''); }}
                  className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  Geri Don
                </button>
              </div>

            /* ---- Admin/Member form ---- */
            ) : activeTab === 'admin-member' ? (
              <>
                <div className="mb-10">
                  <h3
                    className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100"
                    style={{ fontFamily: "'Noto Serif', serif" }}
                  >
                    Hos Geldiniz
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Lutfen kimlik bilgilerinizle sisteme giris yapin.
                  </p>
                </div>

                <form className="space-y-8" onSubmit={handleAdminMemberSubmit} autoComplete="off">
                  <ErrorAlert message={error} />

                  <FormField
                    id="username"
                    label="Kullanici Adi"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="T.C. Kimlik No veya E-posta"
                    icon={IconPerson}
                    autoFocus
                  />

                  <FormField
                    id="password"
                    label="Sifre"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sifrenizi girin"
                    icon={IconLock}
                    showToggle
                    showPassword={showPassword}
                    onTogglePassword={() => setShowPassword(!showPassword)}
                    onKeyDown={handleCapsDown}
                    onKeyUp={handleCapsUp}
                    capsLock={capsLock}
                  />

                  {/* Remember me + Forgot password */}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-yellow-700 focus:ring-yellow-600/20 transition-all"
                      />
                      <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors" style={{ fontFamily: "'Public Sans', sans-serif" }}>
                        Beni Hatirla
                      </span>
                    </label>
                    <a
                      href="#"
                      className="text-sm font-semibold transition-colors"
                      style={{ color: '#745b00', fontFamily: "'Public Sans', sans-serif" }}
                    >
                      Sifremi Unuttum
                    </a>
                  </div>

                  <GoldButton isLoading={isLoading}>GIRIS YAP</GoldButton>
                </form>

                {/* Support + footer links */}
                <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
                  <div className="flex flex-col items-center gap-3">
                    <Link
                      to="/public/apply"
                      className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline transition-colors"
                      style={{ color: '#745b00' }}
                    >
                      <IconUserAdd className="w-3.5 h-3.5" />
                      Yonetime Basvur
                    </Link>
                    <Link
                      to="/privacy-policy"
                      className="text-xs hover:underline transition-colors"
                      style={{ color: '#745b00' }}
                    >
                      Kisisel Verilerin Korunmasi Hakkinda Aydinlatma Metni
                    </Link>
                  </div>
                </div>
              </>

            /* ---- Chief Observer form ---- */
            ) : activeTab === 'chief-observer' ? (
              <>
                <div className="mb-10">
                  <h3
                    className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100"
                    style={{ fontFamily: "'Noto Serif', serif" }}
                  >
                    Basmusahit Girisi
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Sandik numaraniz ve TC kimlik numaraniz ile giris yapin.
                  </p>
                </div>

                <form className="space-y-8" onSubmit={handleChiefObserverSubmit} autoComplete="off" onKeyDown={handleCapsDown} onKeyUp={handleCapsUp}>
                  <ErrorAlert message={chiefObserverError} />

                  <FormField
                    id="ballotNumber"
                    label="Sandik Numarasi"
                    value={ballotNumber}
                    onChange={(e) => setBallotNumber(e.target.value)}
                    placeholder="Orn: 1001"
                    icon={IconBallot}
                    autoFocus
                  />

                  <FormField
                    id="tc"
                    label="TC Kimlik Numarasi"
                    value={tc}
                    onChange={(e) => setTc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="11 haneli TC kimlik numaraniz"
                    icon={IconIdCard}
                    maxLength={11}
                    capsLock={capsLock}
                  />

                  <div className="flex items-center">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        id="remember-chief-observer"
                        name="remember-chief-observer"
                        type="checkbox"
                        checked={rememberChiefObserver}
                        onChange={(e) => setRememberChiefObserver(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-yellow-700 focus:ring-yellow-600/20"
                      />
                      <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors" style={{ fontFamily: "'Public Sans', sans-serif" }}>
                        Beni Hatirla
                      </span>
                    </label>
                  </div>

                  <GoldButton isLoading={chiefObserverLoading}>GIRIS YAP</GoldButton>
                </form>
              </>

            /* ---- Coordinator form ---- */
            ) : (
              <>
                <div className="mb-10">
                  <h3
                    className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100"
                    style={{ fontFamily: "'Noto Serif', serif" }}
                  >
                    Sorumlu Girisi
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    TC kimlik numaraniz ve telefon numaraniz ile giris yapin.
                  </p>
                </div>

                <form className="space-y-8" onSubmit={handleCoordinatorSubmit} autoComplete="off" onKeyDown={handleCapsDown} onKeyUp={handleCapsUp}>
                  <ErrorAlert message={coordinatorError} />

                  <FormField
                    id="coordinatorTc"
                    label="TC Kimlik Numarasi"
                    value={coordinatorTc}
                    onChange={(e) => setCoordinatorTc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    placeholder="11 haneli TC kimlik numaraniz"
                    icon={IconIdCard}
                    maxLength={11}
                    autoFocus
                    capsLock={capsLock}
                  />

                  <FormField
                    id="coordinatorPhone"
                    label="Telefon Numarasi"
                    type="tel"
                    value={coordinatorPhone}
                    onChange={(e) => setCoordinatorPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="Telefon numaraniz"
                    icon={IconPhone}
                  />

                  <div className="flex items-center">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input
                        id="remember-coordinator"
                        name="remember-coordinator"
                        type="checkbox"
                        checked={rememberCoordinator}
                        onChange={(e) => setRememberCoordinator(e.target.checked)}
                        className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-yellow-700 focus:ring-yellow-600/20"
                      />
                      <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors" style={{ fontFamily: "'Public Sans', sans-serif" }}>
                        Beni Hatirla
                      </span>
                    </label>
                  </div>

                  <GoldButton isLoading={coordinatorLoading}>GIRIS YAP</GoldButton>
                </form>
              </>
            )}
          </div>
        </div>

        {/* Footer bar */}
        <footer className="h-14 flex items-center justify-between px-4 sm:px-12 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span
              className="text-[10px] text-gray-400 font-bold tracking-widest uppercase"
              style={{ fontFamily: "'Public Sans', sans-serif" }}
            >
              Il Sekreterlik Yonetim Paneli v4.0
            </span>
            <span className="h-1 w-1 bg-gray-400 rounded-full" />
            <span className="text-[10px] text-gray-400" style={{ fontFamily: "'Public Sans', sans-serif" }}>
              &copy; {currentYear}{' '}
              <a
                href={footerCompanyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-yellow-700 transition-colors"
              >
                {footerCompanyName}
              </a>
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-6">
            <Link
              to="/privacy-policy"
              className="text-[10px] text-gray-400 hover:text-yellow-700 uppercase transition-colors"
              style={{ fontFamily: "'Public Sans', sans-serif" }}
            >
              KVKK
            </Link>
            <span className="text-[10px] text-gray-400 font-bold" style={{ fontFamily: "'Public Sans', sans-serif" }}>TR</span>
          </div>
        </footer>
      </section>

      {/* Subtle crest watermark (top-right) */}
      <div className="fixed top-0 right-0 p-12 pointer-events-none opacity-[0.03]">
        <IconShield className="w-24 h-24 text-gray-900 dark:text-white" />
      </div>
    </main>
  );
};

export default LoginEnhanced;
