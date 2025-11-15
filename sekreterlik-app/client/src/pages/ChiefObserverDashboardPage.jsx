import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Bu sayfa geçici olarak devre dışı - Redirect döngüsü sorunu nedeniyle
const ChiefObserverDashboardPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Ana sayfaya yönlendir
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Yönlendiriliyor...</p>
      </div>
    </div>
  );
};

export default ChiefObserverDashboardPage;
