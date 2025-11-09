import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import Modal from '../components/Modal';

const BulkSmsPage = () => {
  const [regions, setRegions] = useState([]);
  const [selectedRegions, setSelectedRegions] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [showResultModal, setShowResultModal] = useState(false);

  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    try {
      setLoading(true);
      const regionsData = await ApiService.getRegions();
      setRegions(regionsData || []);
    } catch (error) {
      console.error('Error loading regions:', error);
      alert('Bölgeler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleRegionToggle = (regionName) => {
    setSelectedRegions(prev => {
      if (prev.includes(regionName)) {
        return prev.filter(r => r !== regionName);
      } else {
        return [...prev, regionName];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedRegions.length === regions.length) {
      setSelectedRegions([]);
    } else {
      setSelectedRegions(regions.map(r => r.name));
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      alert('Lütfen mesaj metnini girin');
      return;
    }

    if (selectedRegions.length === 0) {
      alert('Lütfen en az bir bölge seçin');
      return;
    }

    if (!window.confirm(`${selectedRegions.length} bölgedeki tüm üyelere SMS göndermek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      setSending(true);
      setResult(null);
      
      const result = await ApiService.sendBulkSms(message, selectedRegions);
      setResult(result);
      setShowResultModal(true);
      
      if (result.success) {
        setMessage('');
        setSelectedRegions([]);
      }
    } catch (error) {
      console.error('Error sending bulk SMS:', error);
      alert('SMS gönderilirken hata oluştu: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="py-6">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Toplu SMS Gönder</h1>

        {/* Bölge Seçimi */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Bölgeler <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              {selectedRegions.length === regions.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
            </button>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3">
              {regions.map(region => (
                <label
                  key={region.id}
                  className="flex items-center p-2 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-indigo-300 dark:hover:border-indigo-500 transition duration-200 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedRegions.includes(region.name)}
                    onChange={() => handleRegionToggle(region.name)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{region.name}</span>
                </label>
              ))}
            </div>
          )}
          
          {selectedRegions.length > 0 && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {selectedRegions.length} bölge seçildi
            </p>
          )}
        </div>

        {/* Mesaj */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Mesaj Metni <span className="text-red-500">*</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Gönderilecek mesajı yazın. Mesaj başına üye adı otomatik olarak eklenecektir (Sn [üye adı], [mesaj])."
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Mesaj formatı: "Sn [üye adı], [mesaj metni]"
          </p>
        </div>

        {/* Gönder Butonu */}
        <div className="flex justify-end">
          <button
            onClick={handleSend}
            disabled={sending || !message.trim() || selectedRegions.length === 0}
            className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-700 border border-transparent rounded-lg text-sm font-medium text-white hover:from-indigo-700 hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? 'Gönderiliyor...' : 'SMS Gönder'}
          </button>
        </div>
      </div>

      {/* Sonuç Modal */}
      <Modal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        title="SMS Gönderim Sonucu"
      >
        {result && (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg ${
              result.success 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800' 
                : 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800'
            }`}>
              <p className="font-medium">{result.message}</p>
              {result.sent > 0 && (
                <p className="mt-2 text-sm">Başarılı: {result.sent} SMS</p>
              )}
              {result.failed > 0 && (
                <p className="mt-2 text-sm">Başarısız: {result.failed} SMS</p>
              )}
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="max-h-60 overflow-y-auto">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hata Detayları:</h3>
                <ul className="space-y-1">
                  {result.errors.slice(0, 10).map((error, index) => (
                    <li key={index} className="text-xs text-gray-600 dark:text-gray-400">
                      {error.member || error.representative}: {error.error}
                    </li>
                  ))}
                  {result.errors.length > 10 && (
                    <li className="text-xs text-gray-500 dark:text-gray-500">
                      ... ve {result.errors.length - 10} hata daha
                    </li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={() => setShowResultModal(false)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Tamam
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BulkSmsPage;

