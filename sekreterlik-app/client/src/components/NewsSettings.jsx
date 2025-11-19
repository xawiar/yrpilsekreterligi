import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import { useToast } from '../contexts/ToastContext';

const NewsSettings = () => {
  const { showToast } = useToast();
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNews, setEditingNews] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    image_url: '',
    author: '',
    category: 'general',
    status: 'published',
    published_at: new Date().toISOString().split('T')[0]
  });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getNews();
      setNews(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching news:', error);
      showToast('Haberler yüklenirken hata oluştu', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEdit = async (newsItem) => {
    setEditingNews(newsItem);
    setFormData({
      title: newsItem.title || '',
      content: newsItem.content || '',
      summary: newsItem.summary || '',
      image_url: newsItem.image_url || '',
      author: newsItem.author || '',
      category: newsItem.category || 'general',
      status: newsItem.status || 'published',
      published_at: newsItem.published_at 
        ? new Date(newsItem.published_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu haberi silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      await ApiService.deleteNews(id);
      showToast('Haber başarıyla silindi', 'success');
      fetchNews();
    } catch (error) {
      console.error('Error deleting news:', error);
      showToast('Haber silinirken hata oluştu', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      summary: '',
      image_url: '',
      author: '',
      category: 'general',
      status: 'published',
      published_at: new Date().toISOString().split('T')[0]
    });
    setEditingNews(null);
    setMessage('');
    setMessageType('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title || !formData.content) {
      setMessage('Başlık ve içerik zorunludur');
      setMessageType('error');
      return;
    }

    try {
      if (editingNews) {
        await ApiService.updateNews(editingNews.id, formData);
        setMessage('Haber başarıyla güncellendi');
        setMessageType('success');
        showToast('Haber başarıyla güncellendi', 'success');
      } else {
        await ApiService.createNews(formData);
        setMessage('Haber başarıyla eklendi');
        setMessageType('success');
        showToast('Haber başarıyla eklendi', 'success');
      }

      fetchNews();
      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error('Error saving news:', error);
      setMessage(error.message || 'Haber kaydedilirken hata oluştu');
      setMessageType('error');
      showToast('Haber kaydedilirken hata oluştu', 'error');
    }
  };

  const categories = [
    { value: 'general', label: 'Genel' },
    { value: 'politics', label: 'Siyaset' },
    { value: 'local', label: 'Yerel' },
    { value: 'announcement', label: 'Duyuru' },
    { value: 'event', label: 'Etkinlik' },
    { value: 'election', label: 'Seçim' }
  ];

  const statuses = [
    { value: 'draft', label: 'Taslak' },
    { value: 'published', label: 'Yayınlandı' }
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Haber Yönetimi</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Public sayfada görüntülenecek haberleri yönetin
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Haber Ekle
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          messageType === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
        }`}>
          {message}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Başlık *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              placeholder="Haber başlığı"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Özet
            </label>
            <textarea
              name="summary"
              value={formData.summary}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              placeholder="Haber özeti (public sayfada görüntülenecek)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              İçerik *
            </label>
            <textarea
              name="content"
              value={formData.content}
              onChange={handleInputChange}
              required
              rows={10}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              placeholder="Haber içeriği"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Görsel URL
            </label>
            <input
              type="url"
              name="image_url"
              value={formData.image_url}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Yazar
              </label>
              <input
                type="text"
                name="author"
                value={formData.author}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                placeholder="Haber yazarı"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Kategori
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              >
                {categories.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Durum
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              >
                {statuses.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Yayın Tarihi
              </label>
              <input
                type="date"
                name="published_at"
                value={formData.published_at}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="flex gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
            >
              {editingNews ? 'Güncelle' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                resetForm();
              }}
              className="px-6 py-3 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium transition-colors"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      {/* News List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Haberler ({news.length})
          </h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {news.length === 0 ? (
            <div className="p-6 text-center text-gray-500 dark:text-gray-400">
              Henüz haber eklenmemiş
            </div>
          ) : (
            news.map((item) => (
              <div key={item.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {item.title}
                      </h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        item.status === 'published' 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}>
                        {item.status === 'published' ? 'Yayınlandı' : 'Taslak'}
                      </span>
                      <span className="px-2 py-1 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200">
                        {categories.find(c => c.value === item.category)?.label || item.category}
                      </span>
                    </div>
                    {item.summary && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {item.summary}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      {item.author && <span>Yazar: {item.author}</span>}
                      {item.published_at && (
                        <span>Tarih: {new Date(item.published_at).toLocaleDateString('tr-TR')}</span>
                      )}
                      {item.views !== undefined && <span>👁️ {item.views} görüntüleme</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                      title="Düzenle"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Sil"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default NewsSettings;

