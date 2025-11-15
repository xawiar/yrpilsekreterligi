import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiService from '../utils/ApiService';

const ChiefObserverLoginPage = () => {
  const [ballotNumber, setBallotNumber] = useState('');
  const [tc, setTc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Zaten giriş yapılmışsa dashboard'a yönlendir (tek seferlik - sadece mount'ta)
  // NOT: useRef ile bir kez kontrol et - sonsuz döngüyü önle
  const hasCheckedAuth = React.useRef(false);
  
  useEffect(() => {
    // Sadece bir kez çalışsın - hasCheckedAuth flag ile
    if (hasCheckedAuth.current) {
      return; // Zaten kontrol edildi
    }
    
    hasCheckedAuth.current = true;
    
    const userRole = localStorage.getItem('userRole');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const savedUser = localStorage.getItem('user');
    const currentPath = window.location.pathname;
    
    // Sadece gerçekten giriş yapılmışsa ve login sayfasındaysak yönlendir
    if (userRole === 'chief_observer' && isLoggedIn && savedUser && currentPath === '/chief-observer-login') {
      try {
        // savedUser'ın geçerli JSON olduğunu kontrol et
        JSON.parse(savedUser);
        // Yönlendirme yap - replace ile (geri butonu çalışmasın)
        navigate('/chief-observer-dashboard', { replace: true });
      } catch (e) {
        // JSON parse hatası varsa yönlendirme yapma
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Boş dependency array - sadece component mount olduğunda çalışır

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await ApiService.loginChiefObserver(ballotNumber.trim(), tc.trim());
      
      if (result.success) {
        // Kullanıcı bilgilerini localStorage'a kaydet
        localStorage.setItem('user', JSON.stringify(result.user));
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userRole', 'chief_observer');
        
        // Dashboard'a yönlendir - replace ile
        navigate('/chief-observer-dashboard', { replace: true });
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Başmüşahit Girişi</h1>
          <p className="mt-2 text-sm text-gray-600">
            Sandık numaranız ve TC kimlik numaranız ile giriş yapın
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="ballotNumber" className="block text-sm font-medium text-gray-700 mb-2">
              Sandık Numarası
            </label>
            <input
              id="ballotNumber"
              type="text"
              value={ballotNumber}
              onChange={(e) => setBallotNumber(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900"
              placeholder="Örn: 1001"
              required
            />
          </div>

          <div>
            <label htmlFor="tc" className="block text-sm font-medium text-gray-700 mb-2">
              TC Kimlik Numarası
            </label>
            <input
              id="tc"
              type="text"
              value={tc}
              onChange={(e) => setTc(e.target.value.replace(/\D/g, '').slice(0, 11))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900"
              placeholder="11 haneli TC kimlik numaranız"
              maxLength={11}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Giriş yapılıyor...
              </>
            ) : (
              'Giriş Yap'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChiefObserverLoginPage;

