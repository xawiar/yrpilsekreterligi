import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import ApiService from '../../utils/ApiService';
import LoginHeader from './LoginHeader';
import LoginForm from './LoginForm';
import LoginFooter from './LoginFooter';
import LoadingSpinner from './LoadingSpinner';
import { motion } from 'framer-motion';
import { isMobile } from '../../utils/capacitorUtils';

const LoginEnhanced = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('admin-member'); // 'admin-member', 'chief-observer' veya 'coordinator'
  
  // Admin/Üye form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { login, user, setUserFromLogin } = useAuth();
  const navigate = useNavigate();
  
  // Başmüşahit form state
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

  // URL'den type parametresini al ve sekmeyi ayarla
  useEffect(() => {
    const type = searchParams.get('type');
    if (type === 'chief-observer') {
      setActiveTab('chief-observer');
    } else if (type === 'coordinator') {
      setActiveTab('coordinator');
    } else {
      setActiveTab('admin-member');
    }
  }, [searchParams]);

  // Load saved credentials on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    const savedPassword = localStorage.getItem('rememberedPassword');
    const savedRememberMe = localStorage.getItem('rememberMe') === 'true';
    
    if (savedRememberMe && savedUsername && savedPassword) {
      setUsername(savedUsername);
      setPassword(savedPassword);
      setRememberMe(true);
    }
    
    // Load saved Chief Observer credentials
    const savedBallotNumber = localStorage.getItem('rememberedBallotNumber');
    const savedTc = localStorage.getItem('rememberedTc');
    const savedRememberChiefObserver = localStorage.getItem('rememberChiefObserver') === 'true';
    
    if (savedRememberChiefObserver && savedBallotNumber && savedTc) {
      setBallotNumber(savedBallotNumber);
      setTc(savedTc);
      setRememberChiefObserver(true);
    }
    
    // Load saved Coordinator credentials
    const savedCoordinatorTc = localStorage.getItem('rememberedCoordinatorTc');
    const savedCoordinatorPhone = localStorage.getItem('rememberedCoordinatorPhone');
    const savedRememberCoordinator = localStorage.getItem('rememberCoordinator') === 'true';
    
    if (savedRememberCoordinator && savedCoordinatorTc && savedCoordinatorPhone) {
      setCoordinatorTc(savedCoordinatorTc);
      setCoordinatorPhone(savedCoordinatorPhone);
      setRememberCoordinator(true);
    }
    
    // Auto-focus username field on mount (sadece admin-member sekmesinde)
    if (activeTab === 'admin-member') {
      const usernameInput = document.getElementById('username');
      if (usernameInput) {
        usernameInput.focus();
      }
    }
  }, [activeTab]);

  // Handle Admin/Üye form submission
  const handleAdminMemberSubmit = async (e) => {
    e.preventDefault();
    
    // Clear previous errors
    setError('');
    
    // Validate inputs
    if (!username.trim()) {
      setError('Kullanıcı adı alanı boş bırakılamaz');
      document.getElementById('username')?.focus();
      return;
    }
    
    if (!password) {
      setError('Şifre alanı boş bırakılamaz');
      document.getElementById('password')?.focus();
      return;
    }
    
    // Show loading state
    setIsLoading(true);
    
    try {
      // Attempt to login
      const success = await login(username, password);
      
      if (success) {
        // Handle remember me functionality
        if (rememberMe) {
          localStorage.setItem('rememberedUsername', username);
          localStorage.setItem('rememberedPassword', password);
          localStorage.setItem('rememberMe', 'true');
        } else {
          localStorage.removeItem('rememberedUsername');
          localStorage.removeItem('rememberedPassword');
          localStorage.removeItem('rememberMe');
        }
        
        // Show success animation
        setShowSuccess(true);
        
        // Wait a moment to show success animation, then navigate
        setTimeout(() => {
          const savedUser = localStorage.getItem('user');
          if (savedUser) {
            try {
              const userData = JSON.parse(savedUser);
              if (userData.role === 'admin') {
                navigate('/', { replace: true });
              } else if (userData.role === 'member') {
                navigate('/member-dashboard', { replace: true });
              } else if (userData.role === 'district_president') {
                navigate('/district-president-dashboard', { replace: true });
              } else if (userData.role === 'town_president') {
                navigate('/town-president-dashboard', { replace: true });
              } else {
                navigate('/', { replace: true });
              }
            } catch (e) {
              navigate('/', { replace: true });
            }
          } else {
            navigate('/', { replace: true });
          }
        }, 500);
      } else {
        setError('Geçersiz kullanıcı adı veya şifre');
      }
    } catch (err) {
      setError('Giriş sırasında bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Başmüşahit form submission
  const handleChiefObserverSubmit = async (e) => {
    e.preventDefault();
    setChiefObserverError('');
    setChiefObserverLoading(true);

    try {
      const result = await ApiService.loginChiefObserver(ballotNumber.trim(), tc.trim());
      
      if (result.success) {
        // Handle remember me functionality
        if (rememberChiefObserver) {
          localStorage.setItem('rememberedBallotNumber', ballotNumber.trim());
          localStorage.setItem('rememberedTc', tc.trim());
          localStorage.setItem('rememberChiefObserver', 'true');
        } else {
          localStorage.removeItem('rememberedBallotNumber');
          localStorage.removeItem('rememberedTc');
          localStorage.removeItem('rememberChiefObserver');
        }
        
        // Set user in AuthContext (localStorage is managed automatically)
        setUserFromLogin(result.user);
        // Dashboard'a yönlendir
        navigate('/chief-observer-dashboard', { replace: true });
      } else {
        setChiefObserverError(result.message || 'Giriş başarısız');
      }
    } catch (err) {
      setChiefObserverError(err.message || 'Giriş sırasında bir hata oluştu');
    } finally {
      setChiefObserverLoading(false);
    }
  };

  // Handle Sorumlu form submission
  const handleCoordinatorSubmit = async (e) => {
    e.preventDefault();
    setCoordinatorError('');
    setCoordinatorLoading(true);

    try {
      const result = await ApiService.loginCoordinator(coordinatorTc.trim(), coordinatorPhone.trim());
      
      if (result.success) {
        // Handle remember me functionality
        if (rememberCoordinator) {
          localStorage.setItem('rememberedCoordinatorTc', coordinatorTc.trim());
          localStorage.setItem('rememberedCoordinatorPhone', coordinatorPhone.trim());
          localStorage.setItem('rememberCoordinator', 'true');
        } else {
          localStorage.removeItem('rememberedCoordinatorTc');
          localStorage.removeItem('rememberedCoordinatorPhone');
          localStorage.removeItem('rememberCoordinator');
        }
        
        // Set user in AuthContext (localStorage is managed automatically)
        setUserFromLogin(result.user);
        // Dashboard'a yönlendir
        navigate('/coordinator-dashboard', { replace: true });
      } else {
        setCoordinatorError(result.message || 'Giriş başarısız');
      }
    } catch (err) {
      setCoordinatorError(err.message || 'Giriş sırasında bir hata oluştu');
    } finally {
      setCoordinatorLoading(false);
    }
  };

  const mobileView = isMobile();
  
  return (
    <div className={`${mobileView ? 'h-screen' : 'min-h-screen'} bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center ${mobileView ? 'p-0' : 'py-8 px-4 sm:px-6 lg:px-8'}`}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`w-full ${mobileView ? 'h-full' : 'max-w-md'} mx-auto ${mobileView ? 'flex flex-col' : ''}`}
      >
        <LoginHeader />
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className={`${mobileView ? 'flex-1 flex flex-col mt-0 rounded-none border-0 shadow-none' : 'mt-8'} bg-white ${mobileView ? 'py-6 px-4' : 'py-8 px-6'} ${mobileView ? '' : 'shadow-xl rounded-2xl border border-gray-200'} sm:px-10 relative overflow-hidden`}
        >
            {/* Animated background elements */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
            <div className="absolute -bottom-12 -left-20 w-40 h-40 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
            <div className="absolute top-10 left-20 w-40 h-40 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
            
            {/* Tab Navigation */}
            <div className="mb-6 flex space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('admin-member');
                  setSearchParams({});
                  setError('');
                  setChiefObserverError('');
                  setCoordinatorError('');
                }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'admin-member'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Admin / Üye
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('chief-observer');
                  setSearchParams({ type: 'chief-observer' });
                  setError('');
                  setChiefObserverError('');
                  setCoordinatorError('');
                }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'chief-observer'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Başmüşahit
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('coordinator');
                  setSearchParams({ type: 'coordinator' });
                  setError('');
                  setChiefObserverError('');
                  setCoordinatorError('');
                }}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'coordinator'
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Sorumlu
              </button>
            </div>
            
            {showSuccess && activeTab === 'admin-member' ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-10"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Giriş Başarılı!</h3>
                <p className="text-gray-600">Yönlendiriliyorsunuz...</p>
              </motion.div>
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
                
                <LoginFooter />
              </>
            ) : activeTab === 'chief-observer' ? (
              /* Başmüşahit Form */
              <form onSubmit={handleChiefObserverSubmit} className="space-y-6">
                {chiefObserverError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">
                          {chiefObserverError}
                        </h3>
                      </div>
                    </div>
                  </div>
                )}
                
                <div>
                  <label htmlFor="ballotNumber" className="block text-sm font-medium text-gray-700 mb-1">
                    Sandık Numarası
                  </label>
                  <div className="mt-1 relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <input
                      id="ballotNumber"
                      type="text"
                      value={ballotNumber}
                      onChange={(e) => setBallotNumber(e.target.value)}
                      className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all bg-white"
                      placeholder="Örn: 1001"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="tc" className="block text-sm font-medium text-gray-700 mb-1">
                    TC Kimlik Numarası
                  </label>
                  <div className="mt-1 relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                    </div>
                    <input
                      id="tc"
                      type="text"
                      value={tc}
                      onChange={(e) => setTc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all bg-white"
                      placeholder="11 haneli TC kimlik numaranız"
                      maxLength={11}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-chief-observer"
                      name="remember-chief-observer"
                      type="checkbox"
                      checked={rememberChiefObserver}
                      onChange={(e) => setRememberChiefObserver(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="remember-chief-observer" className="ml-2 block text-sm text-gray-900">
                      Beni hatırla
                    </label>
                  </div>
                </div>

                <div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={chiefObserverLoading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {chiefObserverLoading ? (
                      <div className="flex items-center">
                        <LoadingSpinner />
                        <span className="ml-2">Giriş yapılıyor...</span>
                      </div>
                    ) : (
                      "Giriş Yap"
                    )}
                  </motion.button>
                </div>
              </form>
            ) : (
              /* Sorumlu Form */
              <form onSubmit={handleCoordinatorSubmit} className="space-y-6">
                {coordinatorError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-red-800">
                          {coordinatorError}
                        </h3>
                      </div>
                    </div>
                  </div>
                )}
                
                <div>
                  <label htmlFor="coordinatorTc" className="block text-sm font-medium text-gray-700 mb-1">
                    TC Kimlik Numarası
                  </label>
                  <div className="mt-1 relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                      </svg>
                    </div>
                    <input
                      id="coordinatorTc"
                      type="text"
                      value={coordinatorTc}
                      onChange={(e) => setCoordinatorTc(e.target.value.replace(/\D/g, '').slice(0, 11))}
                      className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all bg-white"
                      placeholder="11 haneli TC kimlik numaranız"
                      maxLength={11}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="coordinatorPhone" className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon Numarası
                  </label>
                  <div className="mt-1 relative rounded-xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <input
                      id="coordinatorPhone"
                      type="tel"
                      value={coordinatorPhone}
                      onChange={(e) => setCoordinatorPhone(e.target.value.replace(/\D/g, ''))}
                      className="appearance-none block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all bg-white"
                      placeholder="Telefon numaranız"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input
                      id="remember-coordinator"
                      name="remember-coordinator"
                      type="checkbox"
                      checked={rememberCoordinator}
                      onChange={(e) => setRememberCoordinator(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <label htmlFor="remember-coordinator" className="ml-2 block text-sm text-gray-900">
                      Beni hatırla
                    </label>
                  </div>
                </div>

                <div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={coordinatorLoading}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {coordinatorLoading ? (
                      <div className="flex items-center">
                        <LoadingSpinner />
                        <span className="ml-2">Giriş yapılıyor...</span>
                      </div>
                    ) : (
                      "Giriş Yap"
                    )}
                  </motion.button>
                </div>
              </form>
            )}
          </motion.div>
      </motion.div>
    </div>
  );
};

export default LoginEnhanced;