import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import Modal from './Modal';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from './UI/ConfirmDialog';
import { normalizeId } from '../utils/normalizeId';

/**
 * GenericInstitutionSettings - Reusable settings component for STK and Public Institutions.
 *
 * Props:
 *  - entityType: 'stk' | 'public_institution'
 *  - labels: { singular, plural, emptyMessage, visitIdKey }
 *  - apiMethods: { getAll, create, update, delete, getVisitCounts, getVisitsForLocation }
 *  - badgeColor: Tailwind color class prefix (e.g. 'purple', 'blue')
 */
const GenericInstitutionSettings = ({
  entityType,
  labels,
  apiMethods,
  badgeColor = 'purple',
}) => {
  const toast = useToast();
  const { confirm, confirmDialogProps } = useConfirm();
  const [items, setItems] = useState([]);
  const [visitCounts, setVisitCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [showVisitsModal, setShowVisitsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [visitEvents, setVisitEvents] = useState([]);
  const [loadingVisits, setLoadingVisits] = useState(false);

  useEffect(() => {
    fetchItems();
    fetchVisitCounts();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await apiMethods.getAll();
      setItems(data);
    } catch (error) {
      console.error(`Error fetching ${labels.plural}:`, error);
      setMessage(`${labels.plural} yuklenirken hata olustu`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const fetchVisitCounts = async () => {
    try {
      const data = await apiMethods.getVisitCounts(entityType);
      const counts = {};
      data.forEach(visit => {
        counts[normalizeId(visit[labels.visitIdKey])] = visit.visit_count;
      });
      setVisitCounts(counts);
    } catch (error) {
      console.error('Error fetching visit counts:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setMessage(`${labels.singular} adi gereklidir`);
      setMessageType('error');
      return;
    }

    try {
      if (editingItem) {
        await apiMethods.update(editingItem.id, formData);
        setMessage(`${labels.singular} basariyla guncellendi`);
      } else {
        await apiMethods.create(formData);
        setMessage(`${labels.singular} basariyla eklendi`);
      }

      setMessageType('success');
      setFormData({ name: '', description: '' });
      setEditingItem(null);
      setShowForm(false);
      fetchItems();
    } catch (error) {
      console.error(`Error saving ${labels.singular}:`, error);
      setMessage(error.message || `${labels.singular} kaydedilirken hata olustu`);
      setMessageType('error');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({ name: item.name, description: item.description || '' });
    setShowForm(true);
  };

  const handleDelete = async (item) => {
    const confirmed = await confirm({
      title: `${labels.singular} Sil`,
      message: `"${item.name}" silmek istediginizden emin misiniz?`
    });
    if (!confirmed) return;

    try {
      await apiMethods.delete(item.id);
      toast.success(`${labels.singular} basariyla silindi`);
      fetchItems();
    } catch (error) {
      console.error(`Error deleting ${labels.singular}:`, error);
      toast.error(error.message || `${labels.singular} silinirken hata olustu`);
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', description: '' });
    setEditingItem(null);
    setShowForm(false);
    setMessage('');
  };

  const handleShowVisits = async (item) => {
    setSelectedItem(item);
    setShowVisitsModal(true);
    setLoadingVisits(true);
    try {
      const events = await apiMethods.getVisitsForLocation(entityType, item.id);
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

  const badgeBg = `bg-${badgeColor}-100 dark:bg-${badgeColor}-900`;
  const badgeText = `text-${badgeColor}-800 dark:text-${badgeColor}-200`;
  const badgeHover = `hover:bg-${badgeColor}-200 dark:hover:bg-${badgeColor}-800`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{labels.singular} Yonetimi</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{labels.singular} ekleyin, duzenleyin veya silin</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors duration-200"
        >
          <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yeni {labels.singular} Ekle
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
            {editingItem ? `${labels.singular} Duzenle` : `Yeni ${labels.singular} Ekle`}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {labels.singular} Adi *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder={`${labels.singular} adini girin`}
                required
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Aciklama
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder={`${labels.singular} aciklamasini girin (istege bagli)`}
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors duration-200"
              >
                {editingItem ? 'Guncelle' : 'Ekle'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors duration-200"
              >
                Iptal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Items List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Mevcut {labels.plural}</h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {items.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="mt-2">{labels.emptyMessage}</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-1">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.name}</h4>
                    <button
                      onClick={() => handleShowVisits(item)}
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeBg} ${badgeText} ${badgeHover} cursor-pointer transition-colors`}
                    >
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      {visitCounts[normalizeId(item.id)] || 0} ziyaret
                    </button>
                  </div>
                  {item.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.description}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors duration-200"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(item)}
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
        title={selectedItem ? `${selectedItem.name} - Ziyaretler` : 'Ziyaretler'}
        size="lg"
      >
        {loadingVisits ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : visitEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>Bu {labels.singular.toLowerCase()} icin henuz ziyaret kaydi bulunmamaktadir.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visitEvents.map((event) => (
              <div key={event.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">{event.name}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      <span className="font-medium">Tarih:</span> {new Date(event.date).toLocaleDateString('tr-TR', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    {event.location && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        <span className="font-medium">Konum:</span> {event.location}
                      </p>
                    )}
                    {event.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{event.description}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

export default GenericInstitutionSettings;
