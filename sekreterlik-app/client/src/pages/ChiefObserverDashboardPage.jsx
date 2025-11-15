import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ApiService from '../utils/ApiService';
import ElectionResultForm from '../components/ElectionResultForm';

const ChiefObserverDashboardPage = () => {
  const [user, setUser] = useState(null);
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedElection, setSelectedElection] = useState(null);
  const [showResultForm, setShowResultForm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Kullanıcı bilgilerini kontrol et - sadece bir kez çalışsın (mount'ta)
    // NOT: ChiefObserverRoute zaten bu kontrolü yapıyor, burada sadece state'i set ediyoruz
    const savedUser = localStorage.getItem('user');
    const userRole = localStorage.getItem('userRole');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const currentPath = window.location.pathname;
    
    // Eğer kullanıcı bilgisi yoksa veya role yanlışsa - ChiefObserverRoute zaten yönlendirecek
    if (!savedUser || userRole !== 'chief_observer' || !isLoggedIn) {
      // ChiefObserverRoute zaten login'e yönlendirecek, burada sadece return
      return;
    }

    // Kullanıcı bilgisi varsa parse et ve state'e set et
    try {
      const userData = JSON.parse(savedUser);
      setUser(userData);
      fetchElections();
    } catch (error) {
      console.error('Error parsing user data:', error);
      // Parse hatası varsa - ChiefObserverRoute zaten yönlendirecek
      // navigate çağrısını kaldırdık - ChiefObserverRoute'a bıraktık
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Boş dependency array - sadece component mount olduğunda çalışır

  const fetchElections = async () => {
    try {
      setLoading(true);
      const allElections = await ApiService.getElections();
      
      // Sadece gelecek veya bugünkü seçimleri göster
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const activeElections = allElections.filter(election => {
        if (!election.date) return false;
        const electionDate = new Date(election.date);
        electionDate.setHours(0, 0, 0, 0);
        return electionDate >= today;
      }).sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateA - dateB;
      });
      
      setElections(activeElections);
    } catch (error) {
      console.error('Error fetching elections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleElectionClick = (election) => {
    setSelectedElection(election);
    setShowResultForm(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    navigate('/chief-observer-login');
  };

  const getTypeLabel = (type) => {
    const labels = {
      'yerel': 'Yerel Seçim',
      'genel': 'Genel Seçim',
      'cb': 'CB Seçimi'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Başmüşahit Dashboard
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {user?.name} - Sandık No: {user?.ballot_number}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Çıkış Yap
            </button>
          </div>
        </div>

        {/* Elections List */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Güncel Seçimler
          </h2>

          {elections.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="mt-4 text-gray-500 dark:text-gray-400">Henüz aktif seçim bulunmuyor</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {elections.map((election) => (
                <div
                  key={election.id}
                  onClick={() => handleElectionClick(election)}
                  className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                        {election.name}
                      </h3>
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span className="flex items-center">
                          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {election.date ? new Date(election.date).toLocaleDateString('tr-TR') : '-'}
                        </span>
                        <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded text-xs font-medium">
                          {getTypeLabel(election.type)}
                        </span>
                      </div>
                    </div>
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      {showResultForm && selectedElection && (
        <ElectionResultForm
          election={selectedElection}
          ballotBoxId={user?.ballot_box_id}
          ballotNumber={user?.ballot_number}
          onClose={() => {
            setShowResultForm(false);
            setSelectedElection(null);
          }}
          onSuccess={() => {
            setShowResultForm(false);
            setSelectedElection(null);
            // Başarı mesajı gösterilebilir
          }}
        />
      )}
    </div>
  );
};

export default ChiefObserverDashboardPage;

