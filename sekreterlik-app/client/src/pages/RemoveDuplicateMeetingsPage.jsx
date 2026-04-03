import React, { useState } from 'react';
import FirebaseService from '../services/FirebaseService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from '../components/UI/ConfirmDialog';

const RemoveDuplicateMeetingsPage = () => {
  const { user, isLoggedIn } = useAuth();
  const toast = useToast();
  const { confirm, confirmDialogProps } = useConfirm();
  const [loading, setLoading] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const findDuplicates = async () => {
    if (!isLoggedIn || user?.role !== 'admin') {
      setError('Bu işlem için admin yetkisi gereklidir.');
      return;
    }

    setLoading(true);
    setError('');
    setDuplicates([]);
    setResults(null);

    try {
      console.log('🔍 Çift toplantılar aranıyor...');
      
      // Tüm toplantıları al
      const meetings = await FirebaseService.getAll('meetings', {}, false);
      
      if (!meetings || meetings.length === 0) {
        setError('Toplantı bulunamadı.');
        setLoading(false);
        return;
      }

      console.log(`📊 ${meetings.length} toplantı bulundu`);

      // Tarih ve adı aynı olan toplantıları bul
      const duplicatesMap = new Map(); // key: "name|date" -> [meetings]
      
      meetings.forEach(meeting => {
        // Arşivlenmemiş toplantıları kontrol et
        const isArchived = meeting.archived === true || meeting.archived === 'true' || meeting.archived === 1 || meeting.archived === '1';
        if (isArchived) return;

        const name = meeting.name || '';
        const date = meeting.date || '';
        const key = `${name}|${date}`;
        
        if (!duplicatesMap.has(key)) {
          duplicatesMap.set(key, []);
        }
        duplicatesMap.get(key).push(meeting);
      });

      // Sadece 2 veya daha fazla olanları duplicate olarak işaretle
      const duplicatesList = [];
      duplicatesMap.forEach((meetings, key) => {
        if (meetings.length > 1) {
          duplicatesList.push({
            key: key,
            meetings: meetings.sort((a, b) => {
              // ID'ye göre sırala (daha yeni olanı sona)
              const aId = parseInt(a.id) || 0;
              const bId = parseInt(b.id) || 0;
              return aId - bId;
            })
          });
        }
      });

      console.log(`🔍 ${duplicatesList.length} çift toplantı bulundu`);
      setDuplicates(duplicatesList);
    } catch (error) {
      console.error('❌ Find duplicates error:', error);
      setError(`Çift toplantılar aranırken hata oluştu: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const removeDuplicates = async () => {
    if (!isLoggedIn || user?.role !== 'admin') {
      setError('Bu işlem için admin yetkisi gereklidir.');
      return;
    }

    if (duplicates.length === 0) {
      setError('Silinecek çift toplantı bulunamadı. Önce "Çift Toplantıları Bul" butonuna tıklayın.');
      return;
    }

    const confirmed = await confirm({
      title: 'Toplantıları Sil',
      message: `${duplicates.length} adet tekrarlı toplantı kalıcı olarak silinecek. Bu işlem geri alınamaz.`,
      confirmText: 'Sil',
      variant: 'danger'
    });
    if (!confirmed) return;

    setLoading(true);
    setError('');

    try {
      let deleted = 0;
      let errors = 0;
      const deletedIds = [];

      for (const dup of duplicates) {
        // Her duplicate grubundan ilkini koru, diğerlerini sil
        const toKeep = dup.meetings[0];
        const toDelete = dup.meetings.slice(1);

        for (const meeting of toDelete) {
          try {
            await FirebaseService.delete('meetings', String(meeting.id));
            deleted++;
            deletedIds.push(meeting.id);
            console.log(`✅ Silindi: ID ${meeting.id} - "${meeting.name}" - ${meeting.date}`);
          } catch (error) {
            errors++;
            console.error(`❌ Silme hatası (ID: ${meeting.id}):`, error);
          }
        }
      }

      setResults({
        deleted,
        errors,
        deletedIds
      });

      // Duplicates listesini temizle
      setDuplicates([]);

      toast.success(`İşlem tamamlandı! ${deleted} toplantı silindi, ${errors} hata.`);
    } catch (error) {
      console.error('❌ Remove duplicates error:', error);
      setError(`Çift toplantılar silinirken hata oluştu: ${error.message}`);
    } finally {
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Çift Toplantıları Temizle</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Tarih ve adı tamamen aynı olan toplantıları bulup, çift olanları siler.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {results && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-600">
            ✅ İşlem tamamlandı! {results.deleted} toplantı silindi, {results.errors} hata.
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-4">
          <div className="flex space-x-4">
            <button
              onClick={findDuplicates}
              disabled={loading}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {loading ? 'Aranıyor...' : 'Çift Toplantıları Bul'}
            </button>

            {duplicates.length > 0 && (
              <button
                onClick={removeDuplicates}
                disabled={loading}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {loading ? 'Siliniyor...' : `Çift Toplantıları Sil (${duplicates.reduce((sum, d) => sum + d.meetings.length - 1, 0)} adet)`}
              </button>
            )}
          </div>

          {duplicates.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Bulunan Çift Toplantılar ({duplicates.length} grup)
              </h3>
              <div className="space-y-4">
                {duplicates.map((dup, index) => {
                  const [name, date] = dup.key.split('|');
                  return (
                    <div
                      key={index}
                      className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
                    >
                      <div className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        {name} - {date}
                      </div>
                      <div className="space-y-2">
                        {dup.meetings.map((meeting, mIndex) => (
                          <div
                            key={meeting.id}
                            className={`text-sm ${
                              mIndex === 0
                                ? 'text-green-700 dark:text-green-300 font-medium'
                                : 'text-red-700 dark:text-red-300'
                            }`}
                          >
                            {mIndex === 0 ? '✅ Korunacak: ' : '❌ Silinecek: '}
                            ID: {meeting.id} | Oluşturulma: {meeting.createdAt || 'Bilinmiyor'}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

export default RemoveDuplicateMeetingsPage;

