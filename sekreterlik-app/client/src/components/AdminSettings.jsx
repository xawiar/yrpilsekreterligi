import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';

const AdminSettings = () => {
  const [adminInfo, setAdminInfo] = useState({
    username: '',
    created_at: '',
    updated_at: ''
  });
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    currentPassword: ''
  });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showUsernameForm, setShowUsernameForm] = useState(false);
  const [selectedRegionName, setSelectedRegionName] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [loading, setLoading] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  // Load admin info on component mount
  useEffect(() => {
    fetchAdminInfo();
    // Load saved region name from localStorage
    const savedRegionName = localStorage.getItem('admin_region_name');
    if (savedRegionName) {
      setSelectedRegionName(savedRegionName);
    }
  }, []);

  const handleRegionChange = (e) => {
    const regionName = e.target.value;
    setSelectedRegionName(regionName);
    // Save to localStorage
    if (regionName) {
      localStorage.setItem('admin_region_name', regionName);
    } else {
      localStorage.removeItem('admin_region_name');
    }
  };

  const fetchAdminInfo = async () => {
    try {
      setLoadingInfo(true);
      const response = await ApiService.getAdminInfo();
      if (response.success) {
        setAdminInfo(response.admin);
        setFormData(prev => ({
          ...prev,
          username: response.admin.username
        }));
      } else {
        setMessage('Admin bilgileri alınamadı');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error fetching admin info:', error);
      setMessage('Admin bilgileri alınırken hata oluştu');
      setMessageType('error');
    } finally {
      setLoadingInfo(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // handleUpdateAdminInfo artık kullanılmıyor, formlar ayrı ayrı handle ediliyor

  const handleRecalculateVisitCounts = async () => {
    if (!window.confirm('Tüm ziyaret sayıları yeniden hesaplanacak. Bu işlem biraz zaman alabilir. Devam etmek istiyor musunuz?')) {
      return;
    }

    try {
      setRecalculating(true);
      setMessage('');
      const response = await ApiService.recalculateAllVisitCounts();
      
      if (response.success) {
        setMessage(`Ziyaret sayıları başarıyla yeniden hesaplandı. ${response.eventsProcessed || 0} etkinlik işlendi.`);
        setMessageType('success');
      } else {
        setMessage(response.message || 'Ziyaret sayıları yeniden hesaplanırken hata oluştu');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error recalculating visit counts:', error);
      setMessage('Ziyaret sayıları yeniden hesaplanırken hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
      setMessageType('error');
    } finally {
      setRecalculating(false);
    }
  };

  if (loadingInfo) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2 text-gray-600">Admin bilgileri yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Admin Info */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Mevcut Admin Bilgileri</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Kullanıcı Adı</label>
            <p className="text-sm text-gray-900 font-medium">{adminInfo.username}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Oluşturulma Tarihi</label>
            <p className="text-sm text-gray-900">
              {adminInfo.created_at ? new Date(adminInfo.created_at).toLocaleDateString('tr-TR') : '-'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Son Güncelleme</label>
            <p className="text-sm text-gray-900">
              {adminInfo.updated_at ? new Date(adminInfo.updated_at).toLocaleDateString('tr-TR') : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* İl Seçimi */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">İl Bilgisi</h3>
        <p className="text-sm text-gray-600 mb-4">
          Programı hangi ilde kullanıyorsanız o ilin adını yazın. Bu bilgi sandık ve başmüşahit ekleme formlarında kullanılacaktır.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            İl Adı *
          </label>
          <input
            type="text"
            value={selectedRegionName}
            onChange={handleRegionChange}
            placeholder="Örn: Elazığ"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition duration-200"
          />
        </div>
      </div>

      {/* Update Forms */}
      <div className="space-y-6">
        {/* Kullanıcı Adı Güncelleme */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Kullanıcı Adını Güncelle</h3>
            <button
              onClick={() => {
                setShowUsernameForm(!showUsernameForm);
                setFormData(prev => ({ ...prev, username: adminInfo.username }));
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
            >
              {showUsernameForm ? 'İptal' : 'Kullanıcı Adını Değiştir'}
            </button>
          </div>
          
          {showUsernameForm && (
            <>
              {message && message.includes('Kullanıcı adı') && (
                <div className={`mb-4 p-3 rounded-lg shadow-sm ${
                  messageType === 'success' 
                    ? 'bg-green-100 text-green-700 border border-green-200' 
                    : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {message}
                </div>
              )}
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!formData.currentPassword.trim()) {
                  setMessage('Mevcut şifre zorunludur');
                  setMessageType('error');
                  return;
                }
                if (!formData.username.trim()) {
                  setMessage('Kullanıcı adı zorunludur');
                  setMessageType('error');
                  return;
                }
                try {
                  setLoading(true);
                  setMessage('');
                  const response = await ApiService.updateAdminCredentials(
                    formData.username,
                    null, // Şifre değiştirilmiyor
                    formData.currentPassword
                  );
                  if (response.success) {
                    setMessage('Kullanıcı adı başarıyla güncellendi');
                    setMessageType('success');
                    setFormData(prev => ({ ...prev, currentPassword: '' }));
                    setShowUsernameForm(false);
                    await fetchAdminInfo();
                  } else {
                    setMessage(response.message || 'Güncelleme sırasında hata oluştu');
                    setMessageType('error');
                  }
                } catch (error) {
                  setMessage('Kullanıcı adı güncellenirken hata oluştu');
                  setMessageType('error');
                } finally {
                  setLoading(false);
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Yeni Kullanıcı Adı
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition duration-200"
                    placeholder="Yeni kullanıcı adı"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mevcut Şifre *
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition duration-200"
                    placeholder="Mevcut şifrenizi girin"
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md transition duration-200"
                >
                  {loading ? 'Güncelleniyor...' : 'Kullanıcı Adını Güncelle'}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Şifre Güncelleme */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Şifreyi Güncelle</h3>
            <button
              onClick={() => {
                setShowPasswordForm(!showPasswordForm);
                setFormData(prev => ({ ...prev, password: '', confirmPassword: '', currentPassword: '' }));
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
            >
              {showPasswordForm ? 'İptal' : 'Şifreyi Değiştir'}
            </button>
          </div>
          
          {showPasswordForm && (
            <>
              {message && message.includes('şifre') && (
                <div className={`mb-4 p-3 rounded-lg shadow-sm ${
                  messageType === 'success' 
                    ? 'bg-green-100 text-green-700 border border-green-200' 
                    : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {message}
                </div>
              )}
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!formData.currentPassword.trim()) {
                  setMessage('Mevcut şifre zorunludur');
                  setMessageType('error');
                  return;
                }
                if (!formData.password.trim()) {
                  setMessage('Yeni şifre zorunludur');
                  setMessageType('error');
                  return;
                }
                if (formData.password !== formData.confirmPassword) {
                  setMessage('Yeni şifreler eşleşmiyor');
                  setMessageType('error');
                  return;
                }
                if (formData.password.length < 3) {
                  setMessage('Şifre en az 3 karakter olmalıdır');
                  setMessageType('error');
                  return;
                }
                try {
                  setLoading(true);
                  setMessage('');
                  const response = await ApiService.updateAdminCredentials(
                    adminInfo.username, // Kullanıcı adı değiştirilmiyor
                    formData.password,
                    formData.currentPassword
                  );
                  if (response.success) {
                    setMessage('Şifre başarıyla güncellendi');
                    setMessageType('success');
                    setFormData(prev => ({ ...prev, password: '', confirmPassword: '', currentPassword: '' }));
                    setShowPasswordForm(false);
                  } else {
                    setMessage(response.message || 'Güncelleme sırasında hata oluştu');
                    setMessageType('error');
                  }
                } catch (error) {
                  setMessage('Şifre güncellenirken hata oluştu');
                  setMessageType('error');
                } finally {
                  setLoading(false);
                }
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mevcut Şifre *
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    value={formData.currentPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition duration-200"
                    placeholder="Mevcut şifrenizi girin"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Yeni Şifre *
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition duration-200"
                    placeholder="Yeni şifre (en az 3 karakter)"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Yeni Şifre (Tekrar) *
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition duration-200"
                    placeholder="Yeni şifreyi tekrar girin"
                    required
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-700 hover:from-indigo-700 hover:to-purple-800 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md transition duration-200"
                >
                  {loading ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      {/* Recalculate Visit Counts */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Ziyaret Sayıları Yönetimi</h3>
        <p className="text-sm text-gray-600 mb-4">
          Tüm etkinliklerden ziyaret sayılarını yeniden hesaplamak için bu butonu kullanın. 
          Bu işlem STK, Kamu Kurumu, Köy, Mahalle, Cami, İlçe ve Belde için ziyaret sayılarını güncelleyecektir.
        </p>
        
        {message && message.includes('Ziyaret sayıları') && (
          <div className={`mb-4 p-3 rounded-lg shadow-sm ${
            messageType === 'success' 
              ? 'bg-green-100 text-green-700 border border-green-200' 
              : 'bg-red-100 text-red-700 border border-red-200'
          }`}>
            {message}
          </div>
        )}
        
        <button
          onClick={handleRecalculateVisitCounts}
          disabled={recalculating}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:from-gray-400 disabled:to-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md transition duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {recalculating ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Yeniden Hesaplanıyor...
            </div>
          ) : (
            'Ziyaret Sayılarını Yeniden Hesapla'
          )}
        </button>
      </div>
    </div>
  );
};

export default AdminSettings;