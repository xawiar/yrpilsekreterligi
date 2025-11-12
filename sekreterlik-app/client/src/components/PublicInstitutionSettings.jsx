import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import Modal from './Modal';

const PublicInstitutionSettings = () => {
  const [publicInstitutions, setPublicInstitutions] = useState([]);
  const [visitCounts, setVisitCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPublicInstitution, setEditingPublicInstitution] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [showVisitsModal, setShowVisitsModal] = useState(false);
  const [selectedPublicInstitution, setSelectedPublicInstitution] = useState(null);
  const [visitEvents, setVisitEvents] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(false);

  useEffect(() => {
    fetchPublicInstitutions();
    fetchVisitCounts();
  }, []);

  const fetchPublicInstitutions = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getPublicInstitutions();
      setPublicInstitutions(data);
    } catch (error) {
      console.error('Error fetching Public Institutions:', error);
      setMessage('Kamu kurumları yüklenirken hata oluştu');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const fetchVisitCounts = async () => {
    try {
      const data = await ApiService.getAllVisitCounts('public_institution');
      const counts = {};
      data.forEach(visit => {
        // Normalize ID to handle both string and number
        const id = String(visit.public_institution_id);
        counts[id] = visit.visit_count;
        // Also store with number key for compatibility
        const numId = Number(visit.public_institution_id);
        if (!isNaN(numId)) {
          counts[numId] = visit.visit_count;
        }
      });
      setVisitCounts(counts);
    } catch (error) {
      console.error('Error fetching visit counts:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setMessage('Kamu kurumu adı gereklidir');
      setMessageType('error');
      return;
    }

    try {
      if (editingPublicInstitution) {
        await ApiService.updatePublicInstitution(editingPublicInstitution.id, formData);
        setMessage('Kamu kurumu başarıyla güncellendi');
      } else {
        await ApiService.createPublicInstitution(formData);
        setMessage('Kamu kurumu başarıyla eklendi');
      }
      
      setMessageType('success');
      setFormData({ name: '', description: '' });
      setEditingPublicInstitution(null);
      setShowForm(false);
      fetchPublicInstitutions();
    } catch (error) {
      console.error('Error saving Public Institution:', error);
      setMessage(error.message || 'Kamu kurumu kaydedilirken hata oluştu');
      setMessageType('error');
    }
  };

  const handleEdit = (publicInstitution) => {
    setEditingPublicInstitution(publicInstitution);
    setFormData({ name: publicInstitution.name, description: publicInstitution.description || '' });
    setShowForm(true);
  };

  const handleDelete = async (publicInstitution) => {
    if (!window.confirm(`"${publicInstitution.name}" kamu kurumunu silmek istediğinizden emin misiniz?`)) {
      return;
    }

    try {
      await ApiService.deletePublicInstitution(publicInstitution.id);
      setMessage('Kamu kurumu başarıyla silindi');
      setMessageType('success');
      fetchPublicInstitutions();
    } catch (error) {
      console.error('Error deleting Public Institution:', error);
      setMessage(error.message || 'Kamu kurumu silinirken hata oluştu');
      setMessageType('error');
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', description: '' });
    setEditingPublicInstitution(null);
    setShowForm(false);
    setMessage('');
  };

  const handleShowVisits = async (publicInstitution) => {
    setSelectedPublicInstitution(publicInstitution);
    setShowVisitsModal(true);
    setLoadingVisits(true);
    try {
      const events = await ApiService.getVisitsForLocation('public_institution', publicInstitution.id);
      setVisitEvents(events);
    } catch (error) {
      console.error('Error fetching visits:', error);
      setVisitEvents([]);
    } finally {
      setLoadingVisits(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Kamu Kurumu Yönetimi</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">Kamu kurumu ekleyin, düzenleyin veya silin</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors duration-200"
        >
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni Kamu Kurumu Ekle
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg ${
          messageType === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
        }`}>
          {message}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
            {editingPublicInstitution ? 'Kamu Kurumu Düzenle' : 'Yeni Kamu Kurumu Ekle'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Kamu Kurumu Adı *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="Kamu kurumu adını girin"
                required
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Açıklama
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="Kamu kurumu açıklamasını girin (isteğe bağlı)"
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors duration-200"
              >
                {editingPublicInstitution ? 'Güncelle' : 'Ekle'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors duration-200"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Public Institutions List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Mevcut Kamu Kurumları</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {publicInstitutions.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="mt-2">Henüz kamu kurumu eklenmemiş</p>
            </div>
          ) : (
            publicInstitutions.map((publicInstitution) => (
              <div key={publicInstitution.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-1">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{publicInstitution.name}</h4>
                    <button
                      onClick={() => handleShowVisits(publicInstitution)}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 cursor-pointer transition-colors"
                    >
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {visitCounts[String(publicInstitution.id)] || visitCounts[Number(publicInstitution.id)] || 0} ziyaret
                    </button>
                  </div>
                  {publicInstitution.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{publicInstitution.description}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(publicInstitution)}
                    className="p-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors duration-200"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(publicInstitution)}
                    className="p-2 text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Visits Modal */}
      <Modal
        isOpen={showVisitsModal}
        onClose={() => setShowVisitsModal(false)}
        title={selectedPublicInstitution ? `${selectedPublicInstitution.name} - Ziyaretler` : 'Ziyaretler'}
        size="lg"
      >
        {loadingVisits ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : visitEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Bu kamu kurumu için henüz ziyaret kaydı bulunmamaktadır.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visitEvents.map((event) => (
              <div key={event.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">{event.name}</h4>
                    <p className="text-sm text-gray-600 mb-1">
                      <span className="font-medium">Tarih:</span> {new Date(event.date).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {event.location && (
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium">Konum:</span> {event.location}
                      </p>
                    )}
                    {event.description && (
                      <p className="text-sm text-gray-500 mt-2">{event.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PublicInstitutionSettings;

