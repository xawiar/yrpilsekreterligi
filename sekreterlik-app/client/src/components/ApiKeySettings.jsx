import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';

const ApiKeySettings = () => {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPermissions, setNewKeyPermissions] = useState(['read']);
  const [createdKey, setCreatedKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      setError('');
      
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      let response;
      
      if (USE_FIREBASE) {
        // Firebase'den API key'leri al
        const FirebaseApiService = (await import('../utils/FirebaseApiService')).default;
        const keys = await FirebaseApiService.getApiKeys();
        response = { success: true, data: keys || [] };
      } else {
        // Backend API'den al
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
        const res = await fetch(`${API_BASE_URL}/api-keys`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        response = await res.json();
      }
      
      if (response.success) {
        setApiKeys(response.data || []);
      } else {
        setError(response.error || 'API key\'ler yüklenemedi');
      }
    } catch (err) {
      console.error('Error fetching API keys:', err);
      setError('API key\'ler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    
    if (!newKeyName.trim()) {
      setError('API key adı gereklidir');
      return;
    }

    try {
      setError('');
      setSuccess('');
      
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      let response;
      
      if (USE_FIREBASE) {
        // Firebase'de API key oluştur
        const FirebaseApiService = (await import('../utils/FirebaseApiService')).default;
        const result = await FirebaseApiService.createApiKey(newKeyName.trim(), newKeyPermissions);
        response = {
          success: true,
          data: result
        };
      } else {
        // Backend API'ye gönder
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
        const res = await fetch(`${API_BASE_URL}/api-keys`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            name: newKeyName.trim(),
            permissions: newKeyPermissions
          })
        });
        response = await res.json();
      }
      
      if (response.success) {
        setCreatedKey(response.data);
        setNewKeyName('');
        setNewKeyPermissions(['read']);
        setShowCreateForm(false);
        await fetchApiKeys();
        setSuccess('API key başarıyla oluşturuldu');
      } else {
        setError(response.error || 'API key oluşturulurken hata oluştu');
      }
    } catch (err) {
      console.error('Error creating API key:', err);
      setError('API key oluşturulurken hata oluştu');
    }
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Bu API key\'i deaktif etmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      setError('');
      setSuccess('');
      
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      
      if (USE_FIREBASE) {
        const FirebaseApiService = (await import('../utils/FirebaseApiService')).default;
        await FirebaseApiService.deactivateApiKey(id);
      } else {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
        await fetch(`${API_BASE_URL}/api-keys/${id}/deactivate`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
      }
      
      await fetchApiKeys();
      setSuccess('API key deaktif edildi');
    } catch (err) {
      console.error('Error deactivating API key:', err);
      setError('API key deaktif edilirken hata oluştu');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu API key\'i silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
      return;
    }

    try {
      setError('');
      setSuccess('');
      
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      
      if (USE_FIREBASE) {
        const FirebaseApiService = (await import('../utils/FirebaseApiService')).default;
        await FirebaseApiService.deleteApiKey(id);
      } else {
        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
        await fetch(`${API_BASE_URL}/api-keys/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
      }
      
      await fetchApiKeys();
      setSuccess('API key silindi');
    } catch (err) {
      console.error('Error deleting API key:', err);
      setError('API key silinirken hata oluştu');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(text);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">API Key Yönetimi</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Başka sitelerden şifresiz okuma yapabilmek için API key oluşturun
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showCreateForm ? 'İptal' : 'Yeni API Key'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
        </div>
      )}

      {/* Created Key Display (Only shown once) */}
      {createdKey && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                ⚠️ API Key Oluşturuldu - Lütfen Kaydedin!
              </h3>
              <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-4">
                Bu key sadece bir kez gösterilecek. Lütfen güvenli bir yere kaydedin.
              </p>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-yellow-300 dark:border-yellow-700">
                <div className="flex items-center justify-between">
                  <code className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                    {createdKey.apiKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(createdKey.apiKey)}
                    className="ml-4 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm font-medium transition-colors"
                  >
                    {copiedKey === createdKey.apiKey ? 'Kopyalandı!' : 'Kopyala'}
                  </button>
                </div>
              </div>
              <p className="mt-4 text-xs text-yellow-700 dark:text-yellow-300">
                API kullanımı: <code className="bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded">X-API-Key: {createdKey.apiKey}</code>
              </p>
            </div>
            <button
              onClick={() => setCreatedKey(null)}
              className="ml-4 text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Yeni API Key Oluştur</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                API Key Adı
              </label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                placeholder="Örn: Ana Site API Key"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Yetkiler
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={newKeyPermissions.includes('read')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewKeyPermissions([...newKeyPermissions, 'read']);
                      } else {
                        setNewKeyPermissions(newKeyPermissions.filter(p => p !== 'read'));
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Okuma (read)</span>
                </label>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Oluştur
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewKeyName('');
                  setNewKeyPermissions(['read']);
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-800 dark:text-gray-200 rounded-lg text-sm font-medium transition-colors"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* API Keys List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ad
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Yetkiler
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Oluşturulma
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Son Kullanım
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {apiKeys.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Henüz API key oluşturulmamış
                  </td>
                </tr>
              ) : (
                apiKeys.map((key) => (
                  <tr key={key.id} className={!key.isActive ? 'opacity-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {key.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {Array.isArray(key.permissions) ? key.permissions.join(', ') : key.permissions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(key.createdAt || key.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(key.lastUsedAt || key.last_used_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        key.isActive 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {key.isActive ? 'Aktif' : 'Deaktif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {key.isActive ? (
                          <button
                            onClick={() => handleDeactivate(key.id)}
                            className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300"
                          >
                            Deaktif Et
                          </button>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">Deaktif</span>
                        )}
                        <button
                          onClick={() => handleDelete(key.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* API Usage Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">API Kullanımı</h3>
        <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <p><strong>Endpoint:</strong> <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">/api/public/*</code></p>
          <p><strong>Header:</strong> <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">X-API-Key: YOUR_API_KEY</code></p>
          <p><strong>Örnek:</strong></p>
          <pre className="bg-blue-100 dark:bg-blue-900 p-3 rounded text-xs overflow-x-auto">
{`fetch('https://your-site.com/api/public/members', {
  headers: {
    'X-API-Key': 'YOUR_API_KEY'
  }
})`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySettings;

