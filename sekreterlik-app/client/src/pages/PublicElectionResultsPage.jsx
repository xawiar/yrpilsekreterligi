import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { useParams } from 'react-router-dom';

const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true' ||
                     import.meta.env.VITE_USE_FIREBASE === true ||
                     String(import.meta.env.VITE_USE_FIREBASE).toLowerCase() === 'true';

// Lazy load ElectionResultsPage content component
const ElectionResultsContent = lazy(() => import('./ElectionResultsPage').then(module => ({
  default: () => {
    // ElectionResultsPage'i readOnly modda render et
    const ElectionResultsPage = module.default;
    return <ElectionResultsPage readOnly={true} />;
  }
})));

// Helper: Build API base URL for backend mode
const getApiBaseUrl = () => {
  let url = import.meta.env.VITE_API_BASE_URL || 'https://sekreterlik-backend.onrender.com/api';
  if (!url.endsWith('/api')) {
    url = url.endsWith('/') ? `${url}api` : `${url}/api`;
  }
  return url;
};

/**
 * Public Election Results Page
 * Herkesin erişebileceği, read-only seçim sonuçları sayfası
 * Visitor tracking ile anlık izleyen kişi sayısı takip edilir
 * TAMAMEN BAĞIMSIZ - Hiçbir admin panel layout'u yok
 */
const PublicElectionResultsPage = ({ electionIdProp }) => {
  const params = useParams();
  const electionId = electionIdProp || params.electionId;
  const [visitorCount, setVisitorCount] = useState(0);
  const visitorIdRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const countIntervalRef = useRef(null);
  const isUnmountingRef = useRef(false);
  const firestoreUnsubRef = useRef(null);

  useEffect(() => {
    // Visitor ID oluştur (localStorage'da sakla)
    let visitorId = localStorage.getItem('public_election_visitor_id');
    if (!visitorId) {
      visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('public_election_visitor_id', visitorId);
    }
    visitorIdRef.current = visitorId;

    if (USE_FIREBASE) {
      initFirebaseVisitorTracking();
    } else {
      // Backend modu: mevcut REST API kullan
      registerVisitorBackend();
      startHeartbeatBackend();
    }

    // Cleanup
    return () => {
      isUnmountingRef.current = true;
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (countIntervalRef.current) {
        clearInterval(countIntervalRef.current);
      }
      if (firestoreUnsubRef.current) {
        firestoreUnsubRef.current();
      }
      if (USE_FIREBASE) {
        unregisterVisitorFirebase();
      } else {
        unregisterVisitorBackend();
      }
    };
  }, [electionId]);

  // ==================== Firebase Mode ====================
  const initFirebaseVisitorTracking = async () => {
    try {
      const { doc, setDoc, deleteDoc, onSnapshot, collection, serverTimestamp, query, where } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      if (!db) return;

      const visitorDocRef = doc(db, 'election_visitors', `${electionId}_${visitorIdRef.current}`);

      // Register visitor
      await setDoc(visitorDocRef, {
        electionId,
        visitorId: visitorIdRef.current,
        lastSeen: serverTimestamp(),
      });

      // Heartbeat: update lastSeen periodically
      heartbeatIntervalRef.current = setInterval(async () => {
        if (isUnmountingRef.current) return;
        try {
          await setDoc(visitorDocRef, {
            electionId,
            visitorId: visitorIdRef.current,
            lastSeen: serverTimestamp(),
          });
        } catch (e) { /* sessiz */ }
      }, 30000);

      // Listen to active visitor count in real-time
      const visitorsQuery = query(
        collection(db, 'election_visitors'),
        where('electionId', '==', electionId)
      );
      firestoreUnsubRef.current = onSnapshot(visitorsQuery, (snapshot) => {
        setVisitorCount(snapshot.size);
      }, () => { /* sessiz */ });

    } catch (e) {
      console.error('Firebase visitor tracking error:', e);
    }
  };

  const unregisterVisitorFirebase = async () => {
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      if (!db) return;
      await deleteDoc(doc(db, 'election_visitors', `${electionId}_${visitorIdRef.current}`));
    } catch (e) { /* sessiz */ }
  };

  // ==================== Backend Mode ====================
  const registerVisitorBackend = async () => {
    try {
      const API_BASE_URL = getApiBaseUrl();
      const response = await fetch(`${API_BASE_URL}/public/visitors/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  const unregisterVisitorBackend = async () => {
    try {
      const API_BASE_URL = getApiBaseUrl();
      await fetch(`${API_BASE_URL}/public/visitors/unregister`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          electionId: electionId,
          visitorId: visitorIdRef.current,
        }),
      });
    } catch (error) {
      console.error('Error unregistering visitor:', error);
    }
  };

  const startHeartbeatBackend = () => {
    heartbeatIntervalRef.current = setInterval(async () => {
      if (isUnmountingRef.current) return;

      try {
        const API_BASE_URL = getApiBaseUrl();
        const response = await fetch(`${API_BASE_URL}/public/visitors/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    }, 30000);

    countIntervalRef.current = setInterval(async () => {
      if (isUnmountingRef.current) return;

      try {
        const API_BASE_URL = getApiBaseUrl();
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
    }, 10000);
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
