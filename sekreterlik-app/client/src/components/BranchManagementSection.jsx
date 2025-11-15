import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';

const BranchManagementSection = ({ branchType, memberRegion, memberId, management, setManagement }) => {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [formData, setFormData] = useState({
    name: '',
    surname: '',
    tc: '',
    phone: '',
    position: '' // Manuel yazılacak görev
  });
  const [editingId, setEditingId] = useState(null);

  const branchLabel = branchType === 'women' ? 'Kadın Kolları' : 'Gençlik Kolları';
  const branchColor = branchType === 'women' ? 'pink' : 'blue';

  useEffect(() => {
    fetchManagement();
  }, [branchType, memberId]);

  const fetchManagement = async () => {
    try {
      setLoading(true);
      const data = branchType === 'women' 
        ? await ApiService.getWomenBranchManagement(memberId)
        : await ApiService.getYouthBranchManagement(memberId);
      setManagement(data || []);
    } catch (error) {
      console.error('Error fetching branch management:', error);
      setManagement([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.surname || !formData.tc || !formData.phone || !formData.position) {
      setMessage('Tüm alanlar zorunludur');
      setMessageType('error');
      return;
    }

    try {
      const data = {
        ...formData,
        member_id: memberId,
        region: memberRegion
      };

      if (editingId) {
        // Güncelleme
        if (branchType === 'women') {
          await ApiService.updateWomenBranchManagement(editingId, data);
        } else {
          await ApiService.updateYouthBranchManagement(editingId, data);
        }
        setMessage('Yönetim üyesi başarıyla güncellendi');
      } else {
        // Yeni ekleme
        if (branchType === 'women') {
          await ApiService.createWomenBranchManagement(data);
        } else {
          await ApiService.createYouthBranchManagement(data);
        }
        setMessage('Yönetim üyesi başarıyla eklendi');
      }
      
      setMessageType('success');
      setFormData({ name: '', surname: '', tc: '', phone: '', position: '' });
      setEditingId(null);
      setShowForm(false);
      fetchManagement();
    } catch (error) {
      console.error('Error saving management member:', error);
      setMessage('Kayıt sırasında hata oluştu: ' + error.message);
      setMessageType('error');
    }
  };

  const handleEdit = (member) => {
    setFormData({
      name: member.name || '',
      surname: member.surname || '',
      tc: member.tc || '',
      phone: member.phone || '',
      position: member.position || ''
    });
    setEditingId(member.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu yönetim üyesini silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      if (branchType === 'women') {
        await ApiService.deleteWomenBranchManagement(id);
      } else {
        await ApiService.deleteYouthBranchManagement(id);
      }
      setMessage('Yönetim üyesi başarıyla silindi');
      setMessageType('success');
      fetchManagement();
    } catch (error) {
      console.error('Error deleting management member:', error);
      setMessage('Silme sırasında hata oluştu: ' + error.message);
      setMessageType('error');
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', surname: '', tc: '', phone: '', position: '' });
    setEditingId(null);
    setShowForm(false);
    setMessage('');
  };

  if (loading && management.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg ${
          messageType === 'success' 
            ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 border border-green-200 dark:border-green-700' 
            : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-700'
        }`}>
          {message}
        </div>
      )}

      {/* Yönetim Listesi */}
      {management.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">İsim Soyisim</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">TC</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Telefon</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Görev</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">İşlemler</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {management.map((person) => (
                <tr key={person.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {person.name} {person.surname}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-mono">
                    {person.tc}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    {person.phone}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium bg-${branchColor}-100 dark:bg-${branchColor}-900 text-${branchColor}-800 dark:text-${branchColor}-200`}>
                      {person.position}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(person)}
                        className={`text-${branchColor}-600 hover:text-${branchColor}-900 dark:text-${branchColor}-400`}
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(person.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400"
                      >
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Toggle Button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className={`w-full py-3 bg-${branchColor}-600 hover:bg-${branchColor}-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center`}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Yönetim Üyesi Ekle
        </button>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
            {editingId ? 'Yönetim Üyesini Düzenle' : 'Yeni Yönetim Üyesi Ekle'}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                İsim *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="İsim"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Soyisim *
              </label>
              <input
                type="text"
                value={formData.surname}
                onChange={(e) => setFormData(prev => ({ ...prev, surname: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="Soyisim"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                TC Kimlik No *
              </label>
              <input
                type="text"
                value={formData.tc}
                onChange={(e) => setFormData(prev => ({ ...prev, tc: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono"
                placeholder="11 haneli TC"
                maxLength={11}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Telefon *
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="05XX XXX XX XX"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Görev *
              </label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="Örn: Genel Sekreter, Mali Sekreter, vb."
                required
              />
            </div>
          </div>

          <div className="flex space-x-2">
            <button
              type="submit"
              className={`flex-1 py-2 bg-${branchColor}-600 hover:bg-${branchColor}-700 text-white rounded-lg font-medium transition-colors`}
            >
              {editingId ? 'Güncelle' : 'Ekle'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      {management.length === 0 && !showForm && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Henüz yönetim üyesi eklenmemiş
        </div>
      )}
    </div>
  );
};

export default BranchManagementSection;

