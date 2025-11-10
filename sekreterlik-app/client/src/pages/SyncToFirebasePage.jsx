import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import FirebaseService from '../services/FirebaseService';
import { useAuth } from '../contexts/AuthContext';

const SyncToFirebasePage = () => {
  const { user, isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, table: '' });
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [updatingMembers, setUpdatingMembers] = useState(false);
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0 });

  // Collections to sync
  const COLLECTIONS_TO_SYNC = [
    { name: 'regions', apiMethod: 'getRegions', firestoreCollection: 'regions' },
    { name: 'positions', apiMethod: 'getPositions', firestoreCollection: 'positions' },
    { name: 'districts', apiMethod: 'getDistricts', firestoreCollection: 'districts' },
    { name: 'towns', apiMethod: 'getTowns', firestoreCollection: 'towns' },
    { name: 'members', apiMethod: 'getMembers', firestoreCollection: 'members' },
    { name: 'meetings', apiMethod: 'getMeetings', firestoreCollection: 'meetings' },
    { name: 'events', apiMethod: 'getEvents', firestoreCollection: 'events' },
    { name: 'neighborhoods', apiMethod: 'getNeighborhoods', firestoreCollection: 'neighborhoods' },
    { name: 'villages', apiMethod: 'getVillages', firestoreCollection: 'villages' },
    { name: 'stks', apiMethod: 'getStks', firestoreCollection: 'stks' },
    { name: 'mosques', apiMethod: 'getMosques', firestoreCollection: 'mosques' },
    { name: 'event_categories', apiMethod: 'getEventCategories', firestoreCollection: 'event_categories' },
    { name: 'district_officials', apiMethod: 'getDistrictOfficials', firestoreCollection: 'district_officials' },
    { name: 'town_officials', apiMethod: 'getTownOfficials', firestoreCollection: 'town_officials' },
    { name: 'ballot_boxes', apiMethod: 'getBallotBoxes', firestoreCollection: 'ballot_boxes' },
    { name: 'member_users', apiMethod: 'getMemberUsers', firestoreCollection: 'member_users' },
    { name: 'member_registrations', apiMethod: 'getMemberRegistrations', firestoreCollection: 'member_registrations' },
    { name: 'groups', apiMethod: 'getGroups', firestoreCollection: 'groups' },
    { name: 'tasks', apiMethod: 'getTasks', firestoreCollection: 'tasks' },
    { name: 'neighborhood_representatives', apiMethod: 'getNeighborhoodRepresentatives', firestoreCollection: 'neighborhood_representatives' },
    { name: 'village_representatives', apiMethod: 'getVillageRepresentatives', firestoreCollection: 'village_representatives' },
    { name: 'polls', apiMethod: 'getPolls', firestoreCollection: 'polls' }
  ];

  const syncCollection = async (collection) => {
    try {
      setProgress(prev => ({ ...prev, table: collection.name }));
      
      // Get data from API
      let data = [];
      try {
        if (collection.apiMethod === 'getRegions') {
          data = await ApiService.getRegions();
        } else if (collection.apiMethod === 'getPositions') {
          data = await ApiService.getPositions();
        } else if (collection.apiMethod === 'getDistricts') {
          data = await ApiService.getDistricts();
        } else if (collection.apiMethod === 'getTowns') {
          data = await ApiService.getTowns();
        } else if (collection.apiMethod === 'getMembers') {
          data = await ApiService.getMembers();
        } else if (collection.apiMethod === 'getMeetings') {
          data = await ApiService.getMeetings();
        } else if (collection.apiMethod === 'getEvents') {
          data = await ApiService.getEvents();
        } else if (collection.apiMethod === 'getNeighborhoods') {
          data = await ApiService.getNeighborhoods();
        } else if (collection.apiMethod === 'getVillages') {
          data = await ApiService.getVillages();
        } else if (collection.apiMethod === 'getStks') {
          data = await ApiService.getStks();
        } else if (collection.apiMethod === 'getMosques') {
          data = await ApiService.getMosques();
        } else if (collection.apiMethod === 'getEventCategories') {
          data = await ApiService.getEventCategories();
        } else if (collection.apiMethod === 'getDistrictOfficials') {
          data = await ApiService.getDistrictOfficials();
        } else if (collection.apiMethod === 'getTownOfficials') {
          data = await ApiService.getTownOfficials();
        } else if (collection.apiMethod === 'getBallotBoxes') {
          data = await ApiService.getBallotBoxes();
        } else if (collection.apiMethod === 'getMemberUsers') {
          const response = await ApiService.getMemberUsers();
          data = response.success ? response.users : [];
        } else if (collection.apiMethod === 'getMemberRegistrations') {
          data = await ApiService.getMemberRegistrations();
        } else if (collection.apiMethod === 'getGroups') {
          data = await ApiService.getGroups();
        } else if (collection.apiMethod === 'getTasks') {
          data = await ApiService.getTasks();
        } else if (collection.apiMethod === 'getPolls') {
          data = await ApiService.getPolls('all');
        }
      } catch (apiError) {
        console.warn(`API error for ${collection.name}:`, apiError);
        return { collection: collection.name, count: 0, errors: [apiError.message] };
      }

      if (!data || data.length === 0) {
        return { collection: collection.name, count: 0, errors: [] };
      }

      // Write to Firebase
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const item of data) {
        try {
          // Convert ID to string for Firebase
          const docId = String(item.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
          
          // Prepare data for Firebase
          const firebaseData = {
            ...item,
            id: docId,
            synced_at: new Date().toISOString()
          };

          // Check if document already exists
          const existing = await FirebaseService.getById(collection.firestoreCollection, docId, false);
          
          if (existing) {
            // Update existing document
            await FirebaseService.update(collection.firestoreCollection, docId, firebaseData, true);
          } else {
            // Create new document
            await FirebaseService.create(collection.firestoreCollection, docId, firebaseData, true);
          }
          
          successCount++;
        } catch (firebaseError) {
          errorCount++;
          errors.push(`ID ${item.id}: ${firebaseError.message}`);
          console.error(`Error syncing ${collection.name} item ${item.id}:`, firebaseError);
        }
      }

      return {
        collection: collection.name,
        count: successCount,
        total: data.length,
        errors: errors
      };
    } catch (error) {
      console.error(`Error syncing ${collection.name}:`, error);
      return {
        collection: collection.name,
        count: 0,
        errors: [error.message]
      };
    }
  };

  const handleUpdateMembersFromDesktop = async () => {
    if (!isLoggedIn || user?.role !== 'admin') {
      setError('Bu işlem için admin yetkisi gereklidir.');
      return;
    }

    setUpdatingMembers(true);
    setError('');
    setUpdateProgress({ current: 0, total: 0 });

    try {
      console.log('📥 Masaüstü database\'den üye verileri alınıyor...');
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_BASE_URL}/sync/desktop-members`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const desktopData = await response.json();
      
      if (!desktopData.success) {
        throw new Error(desktopData.message || 'Veriler alınamadı');
      }

      console.log('✅ Masaüstü database\'den veriler alındı:', desktopData.count, 'üye');

      const desktopMembers = desktopData.data || [];
      setUpdateProgress({ current: 0, total: desktopMembers.length });

      let updated = 0;
      let skipped = 0;
      let errors = 0;

      for (let i = 0; i < desktopMembers.length; i++) {
        const desktopMember = desktopMembers[i];
        setUpdateProgress({ current: i + 1, total: desktopMembers.length });

        try {
          // Firebase'deki üyeyi bul
          const firebaseMember = await FirebaseService.getById('members', String(desktopMember.id), false);
          
          if (!firebaseMember) {
            console.warn(`⚠️ Firebase'de üye bulunamadı: ${desktopMember.id} (${desktopMember.name})`);
            skipped++;
            continue;
          }

          // TC ve telefon güncelle
          await FirebaseService.update('members', String(desktopMember.id), {
            tc: desktopMember.tc,
            phone: desktopMember.phone
          }, false); // encrypt = false (artık şifreleme yapılmıyor)

          updated++;
          console.log(`✅ Üye güncellendi: ${desktopMember.name} (ID: ${desktopMember.id}, TC: ${desktopMember.tc})`);
        } catch (error) {
          errors++;
          console.error(`❌ Üye güncelleme hatası (ID: ${desktopMember.id}):`, error);
        }
      }

      setUpdatingMembers(false);
      alert(`✅ Güncelleme tamamlandı!\n${updated} üye güncellendi\n${skipped} üye atlandı\n${errors} hata`);
    } catch (error) {
      console.error('❌ Update error:', error);
      setError(`Üye güncelleme hatası: ${error.message}`);
      setUpdatingMembers(false);
    }
  };

  const handleSync = async () => {
    if (!isLoggedIn || user?.role !== 'admin') {
      setError('Bu işlem için admin yetkisi gereklidir.');
      return;
    }

    setLoading(true);
    setError('');
    setResults([]);
    setProgress({ current: 0, total: COLLECTIONS_TO_SYNC.length, table: '' });

    try {
      // SQLite'dan tüm verileri al
      console.log('📥 SQLite verileri alınıyor...');
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      const response = await fetch(`${API_BASE_URL}/sync/all`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const syncData = await response.json();
      
      if (!syncData.success) {
        throw new Error(syncData.message || 'Veriler alınamadı');
      }

      console.log('✅ SQLite verileri alındı:', syncData.summary);

      const syncResults = [];

      // Her collection için verileri Firebase'e aktar
      for (let i = 0; i < COLLECTIONS_TO_SYNC.length; i++) {
        const collection = COLLECTIONS_TO_SYNC[i];
        setProgress({ current: i + 1, total: COLLECTIONS_TO_SYNC.length, table: collection.name });
        
        // SQLite'dan alınan verileri kullan
        const data = syncData.data[collection.name] || [];
        
        if (data.length === 0) {
          syncResults.push({
            collection: collection.name,
            count: 0,
            total: 0,
            errors: []
          });
          setResults([...syncResults]);
          continue;
        }

        // Firebase'e yaz
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (const item of data) {
          try {
            // Convert ID to string for Firebase
            const docId = String(item.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
            
            // Prepare data for Firebase
            let firebaseData = {
              ...item,
              id: docId,
              synced_at: new Date().toISOString()
            };

            // For meetings and events, convert attendees memberId from number to string
            if ((collection.name === 'meetings' || collection.name === 'events') && firebaseData.attendees && Array.isArray(firebaseData.attendees)) {
              firebaseData.attendees = firebaseData.attendees.map(attendee => ({
                ...attendee,
                memberId: String(attendee.memberId || attendee.member_id || '') // Convert number to string
              }));
            }
            
            // For member_users, ensure memberId field is set from member_id
            if (collection.name === 'member_users') {
              if (firebaseData.member_id && !firebaseData.memberId) {
                firebaseData.memberId = String(firebaseData.member_id);
              } else if (!firebaseData.memberId && firebaseData.member_id) {
                firebaseData.memberId = String(firebaseData.member_id);
              }
              // Also ensure userType is set from user_type
              if (firebaseData.user_type && !firebaseData.userType) {
                firebaseData.userType = firebaseData.user_type;
              }
            }

            // Check if document already exists
            const existing = await FirebaseService.getById(collection.firestoreCollection, docId, false);
            
            if (existing) {
              // Update existing document
              await FirebaseService.update(collection.firestoreCollection, docId, firebaseData, true);
            } else {
              // Create new document
              await FirebaseService.create(collection.firestoreCollection, docId, firebaseData, true);
            }
            
            successCount++;
          } catch (firebaseError) {
            errorCount++;
            errors.push(`ID ${item.id}: ${firebaseError.message}`);
            console.error(`Error syncing ${collection.name} item ${item.id}:`, firebaseError);
          }
        }

        syncResults.push({
          collection: collection.name,
          count: successCount,
          total: data.length,
          errors: errors
        });
        setResults([...syncResults]);
      }

      setLoading(false);
      setProgress({ current: COLLECTIONS_TO_SYNC.length, total: COLLECTIONS_TO_SYNC.length, table: 'Tamamlandı' });
    } catch (error) {
      console.error('❌ Sync error:', error);
      setError(`Veri aktarımı hatası: ${error.message}`);
      setLoading(false);
    }
  };

  if (!isLoggedIn || user?.role !== 'admin') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">Bu sayfaya erişmek için admin yetkisi gereklidir.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Firebase'e Veri Aktarımı</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Mevcut SQLite veritabanındaki tüm verileri Firebase Firestore'a aktarır.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Aktarılacak Collection'lar
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {COLLECTIONS_TO_SYNC.length} collection aktarılacak
            </p>
          </div>

          {loading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {progress.table} ({progress.current}/{progress.total})
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  {Math.round((progress.current / progress.total) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}

          <button
            onClick={handleSync}
            disabled={loading || updatingMembers}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
              loading || updatingMembers
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {loading ? 'Aktarılıyor...' : 'Verileri Firebase\'e Aktar'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Masaüstü Database'den TC ve Telefonları Güncelle
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Masaüstündeki ildatabase.sqlite dosyasından TC ve telefon numaralarını çekip Firebase'deki üyeleri günceller.
            </p>
          </div>

          {updatingMembers && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Güncelleniyor ({updateProgress.current}/{updateProgress.total})
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  {updateProgress.total > 0 ? Math.round((updateProgress.current / updateProgress.total) * 100) : 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${updateProgress.total > 0 ? (updateProgress.current / updateProgress.total) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
          )}

          <button
            onClick={handleUpdateMembersFromDesktop}
            disabled={loading || updatingMembers}
            className={`w-full px-4 py-3 rounded-lg font-medium transition-colors ${
              loading || updatingMembers
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {updatingMembers ? 'Güncelleniyor...' : 'Masaüstü Database\'den TC ve Telefonları Güncelle'}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Aktarım Sonuçları
          </h3>
          <div className="space-y-2">
            {results.map((result, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg ${
                  result.errors.length > 0
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
                    : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {result.collection}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {result.count} / {result.total || 0} kayıt
                  </span>
                </div>
                {result.errors.length > 0 && (
                  <div className="mt-2 text-xs text-yellow-700 dark:text-yellow-300">
                    {result.errors.length} hata
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900 dark:text-gray-100">Toplam</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {results.reduce((sum, r) => sum + r.count, 0)} kayıt aktarıldı
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SyncToFirebasePage;

