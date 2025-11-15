import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import ElectionResultForm from '../components/ElectionResultForm';

/**
 * Başmüşahit Dashboard Sayfası
 * 
 * NOT: Bu sayfa ChiefObserverRoute guard'ı ile korunuyor.
 * Route guard authentication kontrolü yapıyor, bu component sadece veriyi gösteriyor.
 * Sonsuz döngü önlemek için navigate kullanılmıyor - route guard'a bırakıldı.
 */
const ChiefObserverDashboardPage = () => {
  const navigate = useNavigate();
  
  // State management
  const [user, setUser] = useState(null);
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedElection, setSelectedElection] = useState(null);
  const [showResultForm, setShowResultForm] = useState(false);

  // Kullanıcı bilgilerini yükle - sadece mount'ta bir kez
  useEffect(() => {
    let isMounted = true;

    const loadUserData = () => {
      try {
        const savedUser = localStorage.getItem('user');
        const userRole = localStorage.getItem('userRole');
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

        // Route guard zaten kontrol etti, burada sadece parse et
        if (savedUser && userRole === 'chief_observer' && isLoggedIn) {
          const userData = JSON.parse(savedUser);
          if (isMounted) {
            setUser(userData);
          }
        }
      } catch (err) {
        console.error('Error loading user data:', err);
        if (isMounted) {
          setError('Kullanıcı bilgileri yüklenemedi');
        }
      }
    };

    loadUserData();

    return () => {
      isMounted = false;
    };
  }, []); // Sadece mount'ta çalışır - hiç dependency yok

  // Seçimleri yükle - sadece user yüklendikten sonra
  useEffect(() => {
    if (!user) return; // User yüklenene kadar bekle

    let isMounted = true;

    const loadElections = async () => {
      try {
        setLoading(true);
        setError(null);

        const allElections = await ApiService.getElections();

        if (!isMounted) return;

        // Sadece gelecek veya bugünkü seçimleri göster
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const activeElections = allElections
          .filter(election => {
            if (!election.date) return false;
            const electionDate = new Date(election.date);
            electionDate.setHours(0, 0, 0, 0);
            return electionDate >= today;
          })
          .sort((a, b) => {
            const dateA = new Date(a.date || 0);
            const dateB = new Date(b.date || 0);
            return dateA - dateB;
          });

        setElections(activeElections);
      } catch (err) {
        console.error('Error fetching elections:', err);
        if (isMounted) {
          setError('Seçimler yüklenirken hata oluştu');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadElections();

    return () => {
      isMounted = false;
    };
  }, [user]); // Sadece user değiştiğinde çalışır

  // Event handlers - useCallback ile optimize edildi
  const handleElectionClick = useCallback((election) => {
    setSelectedElection(election);
    setShowResultForm(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setShowResultForm(false);
    setSelectedElection(null);
  }, []);

  const handleFormSuccess = useCallback(() => {
    setShowResultForm(false);
    setSelectedElection(null);
    // Başarı mesajı gösterilebilir - şimdilik sadece kapat
  }, []);

  const handleLogout = useCallback(() => {
    // localStorage'ı temizle
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    
    // Login sayfasına yönlendir - replace ile (geri butonu çalışmasın)
    navigate('/chief-observer-login', { replace: true });
  }, [navigate]);

  // Seçim tipi etiketi - useMemo ile optimize edildi
  const getTypeLabel = useCallback((type) => {
    const labels = {
      'yerel': 'Yerel Seçim',
      'genel': 'Genel Seçim',
      'cb': 'Cumhurbaşkanlığı Seçimi'
    };
    return labels[type] || type;
  }, []);

  // Tarih formatı - useMemo ile optimize edildi
  const formatDate = useCallback((dateString) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('tr-TR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return '-';
    }
  }, []);

  // Loading state
  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Hata</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            Tekrar Giriş Yap
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-4 sm:py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                Başmüşahit Dashboard
              </h1>
              {user && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">İsim:</span> {user.name || 'Bilinmiyor'}
                  </p>
                  {user.ballot_number && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Sandık No:</span> {user.ballot_number}
                    </p>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="w-full sm:w-auto px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Çıkış Yap
            </button>
          </div>
        </div>

        {/* Elections List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
              Güncel Seçimler
            </h2>
            {loading && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
            )}
          </div>

          {error && elections.length === 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {!loading && elections.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-4 text-gray-500 dark:text-gray-400">Henüz aktif seçim bulunmuyor</p>
            </div>
          )}

          {!loading && elections.length > 0 && (
            <div className="grid gap-3 sm:gap-4">
              {elections.map((election) => (
                <div
                  key={election.id}
                  onClick={() => handleElectionClick(election)}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-all duration-200 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-base sm:text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        {election.name || 'İsimsiz Seçim'}
                      </h3>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatDate(election.date)}
                        </span>
                        <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded text-xs font-medium">
                          {getTypeLabel(election.type)}
                        </span>
                      </div>
                    </div>
                    <svg className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Election Result Form Modal */}
      {showResultForm && selectedElection && user && (
        <ElectionResultForm
          election={selectedElection}
          ballotBoxId={user.ballot_box_id}
          ballotNumber={user.ballot_number}
          onClose={handleCloseForm}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
};

export default ChiefObserverDashboardPage;
