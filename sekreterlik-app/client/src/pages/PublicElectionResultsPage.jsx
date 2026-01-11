import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useParams } from 'react-router-dom';

// Lazy load ElectionResultsPage content component
const ElectionResultsContent = lazy(() => import('./ElectionResultsPage').then(module => ({
  default: () => {
    // ElectionResultsPage'i readOnly modda render et
    const ElectionResultsPage = module.default;
    return <ElectionResultsPage readOnly={true} />;
  }
})));

/**
 * Public Election Results Page
 * Herkesin erişebileceği, read-only seçim sonuçları sayfası
 * Visitor tracking ile anlık izleyen kişi sayısı takip edilir
 * TAMAMEN BAĞIMSIZ - Hiçbir admin panel layout'u yok
 */
const PublicElectionResultsPage = () => {
  const { electionId } = useParams();
  const [visitorCount, setVisitorCount] = useState(0);
  const visitorIdRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const countIntervalRef = useRef(null);
  const isUnmountingRef = useRef(false);

  useEffect(() => {
    // Visitor ID oluştur (localStorage'da sakla)
    let visitorId = localStorage.getItem('public_election_visitor_id');
    if (!visitorId) {
      visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('public_election_visitor_id', visitorId);
    }
    visitorIdRef.current = visitorId;

    // Visitor'ı kaydet ve heartbeat başlat
    registerVisitor();
    startHeartbeat();

    // Cleanup
    return () => {
      isUnmountingRef.current = true;
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (countIntervalRef.current) {
        clearInterval(countIntervalRef.current);
      }
      unregisterVisitor();
    };
  }, [electionId]);

  // Visitor'ı kaydet
  const registerVisitor = async () => {
    try {
      // Ensure API_BASE_URL always ends with /api
      let API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sekreterlik-backend.onrender.com/api';
      if (!API_BASE_URL.endsWith('/api')) {
        API_BASE_URL = API_BASE_URL.endsWith('/') ? `${API_BASE_URL}api` : `${API_BASE_URL}/api`;
      }
      const response = await fetch(`${API_BASE_URL}/public/visitors/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          electionId: electionId,
          visitorId: visitorIdRef.current,
          timestamp: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.count !== undefined) {
          setVisitorCount(data.count);
        }
      }
    } catch (error) {
      console.error('Error registering visitor:', error);
    }
  };

  // Visitor'ı kaldır
  const unregisterVisitor = async () => {
    try {
      // Ensure API_BASE_URL always ends with /api
      let API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sekreterlik-backend.onrender.com/api';
      if (!API_BASE_URL.endsWith('/api')) {
        API_BASE_URL = API_BASE_URL.endsWith('/') ? `${API_BASE_URL}api` : `${API_BASE_URL}/api`;
      }
      await fetch(`${API_BASE_URL}/public/visitors/unregister`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          electionId: electionId,
          visitorId: visitorIdRef.current,
        }),
      });
    } catch (error) {
      console.error('Error unregistering visitor:', error);
    }
  };

  // Heartbeat - visitor'ın hala aktif olduğunu bildir
  const startHeartbeat = () => {
    heartbeatIntervalRef.current = setInterval(async () => {
      if (isUnmountingRef.current) return;

      try {
        // Ensure API_BASE_URL always ends with /api
        let API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sekreterlik-backend.onrender.com/api';
        if (!API_BASE_URL.endsWith('/api')) {
          API_BASE_URL = API_BASE_URL.endsWith('/') ? `${API_BASE_URL}api` : `${API_BASE_URL}/api`;
        }
        const response = await fetch(`${API_BASE_URL}/public/visitors/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            electionId: electionId,
            visitorId: visitorIdRef.current,
            timestamp: new Date().toISOString(),
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.count !== undefined) {
            setVisitorCount(data.count);
          }
        }
      } catch (error) {
        console.error('Error sending heartbeat:', error);
      }
    }, 30000); // Her 30 saniyede bir heartbeat gönder

    // Visitor count'u periyodik olarak güncelle
    countIntervalRef.current = setInterval(async () => {
      if (isUnmountingRef.current) return;

      try {
        // Ensure API_BASE_URL always ends with /api
        let API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sekreterlik-backend.onrender.com/api';
        if (!API_BASE_URL.endsWith('/api')) {
          API_BASE_URL = API_BASE_URL.endsWith('/') ? `${API_BASE_URL}api` : `${API_BASE_URL}/api`;
        }
        const response = await fetch(`${API_BASE_URL}/public/visitors/count?electionId=${electionId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.count !== undefined) {
            setVisitorCount(data.count);
          }
        }
      } catch (error) {
        console.error('Error fetching visitor count:', error);
      }
    }, 10000); // Her 10 saniyede bir count güncelle
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Visitor Count Badge */}
      <div className="fixed top-4 right-4 z-50 bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span className="font-semibold">{visitorCount} kişi izliyor</span>
      </div>

      {/* Read-only Election Results Content - No layout, no sidebar, no header */}
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      }>
        <ElectionResultsContent />
      </Suspense>
    </div>
  );
};

export default PublicElectionResultsPage;
