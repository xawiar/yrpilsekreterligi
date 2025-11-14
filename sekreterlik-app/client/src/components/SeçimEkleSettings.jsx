import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ApiService from '../utils/ApiService';

const SeçimEkleSettings = () => {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingElection, setEditingElection] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    type: 'yerel', // yerel, genel, cb
    parties: [], // Yerel ve genel seçim için
    candidates: [], // CB seçimi için
    voter_count: '' // Seçmen sayısı
  });
  const [partyInput, setPartyInput] = useState('');
  const [candidateInput, setCandidateInput] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  useEffect(() => {
    fetchElections();
  }, []);

  const fetchElections = async () => {
    try {
      setLoading(true);
      const data = await ApiService.getElections();
      setElections(data || []);
    } catch (error) {
      console.error('Error fetching elections:', error);
      setMessage('Seçimler yüklenirken hata oluştu');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Tip değiştiğinde ilgili alanları temizle
      ...(name === 'type' && {
        parties: [],
        candidates: []
      })
    }));
  };

  const handleAddParty = () => {
    if (partyInput.trim()) {
      setFormData(prev => ({
        ...prev,
        parties: [...prev.parties, partyInput.trim()]
      }));
      setPartyInput('');
    }
  };

  const handleRemoveParty = (index) => {
    setFormData(prev => ({
      ...prev,
      parties: prev.parties.filter((_, i) => i !== index)
    }));
  };

  const handleAddCandidate = () => {
    if (candidateInput.trim()) {
      setFormData(prev => ({
        ...prev,
        candidates: [...prev.candidates, candidateInput.trim()]
      }));
      setCandidateInput('');
    }
  };

  const handleRemoveCandidate = (index) => {
    setFormData(prev => ({
      ...prev,
      candidates: prev.candidates.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setMessage('Seçim adı gereklidir');
      setMessageType('error');
      return;
    }

    if (!formData.date) {
      setMessage('Seçim tarihi gereklidir');
      setMessageType('error');
      return;
    }

    if (formData.type === 'cb' && formData.candidates.length === 0) {
      setMessage('CB seçimi için en az bir aday eklenmelidir');
      setMessageType('error');
      return;
    }

    if ((formData.type === 'yerel' || formData.type === 'genel') && formData.parties.length === 0) {
      setMessage('Yerel/Genel seçim için en az bir parti eklenmelidir');
      setMessageType('error');
      return;
    }

    try {
      if (editingElection) {
        await ApiService.updateElection(editingElection.id, formData);
        setMessage('Seçim başarıyla güncellendi');
      } else {
        await ApiService.createElection(formData);
        setMessage('Seçim başarıyla eklendi');
      }
      
      setMessageType('success');
      setFormData({
        name: '',
        date: '',
        type: 'yerel',
        parties: [],
        candidates: [],
        voter_count: ''
      });
      setPartyInput('');
      setCandidateInput('');
      setEditingElection(null);
      setShowForm(false);
      fetchElections();
    } catch (error) {
      console.error('Error saving election:', error);
      setMessage(error.message || 'Seçim kaydedilirken hata oluştu');
      setMessageType('error');
    }
  };

  const handleEdit = (election) => {
    setEditingElection(election);
    // Tarih formatını düzelt (ISO string'den date input formatına)
    let dateValue = '';
    if (election.date) {
      try {
        const date = new Date(election.date);
        if (!isNaN(date.getTime())) {
          dateValue = date.toISOString().split('T')[0];
        }
      } catch (e) {
        console.error('Date parse error:', e);
      }
    }
    setFormData({
      name: election.name || '',
      date: dateValue,
      type: election.type || 'yerel',
      parties: election.parties || [],
      candidates: election.candidates || [],
      voter_count: election.voter_count || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu seçimi silmek istediğinize emin misiniz?')) {
      return;
    }

    try {
      await ApiService.deleteElection(id);
      setMessage('Seçim başarıyla silindi');
      setMessageType('success');
      fetchElections();
    } catch (error) {
      console.error('Error deleting election:', error);
      setMessage(error.message || 'Seçim silinirken hata oluştu');
      setMessageType('error');
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      'yerel': 'Yerel Seçim',
      'genel': 'Genel Seçim',
      'cb': 'CB Seçimi'
    };
    return labels[type] || type;
  };

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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Seçim Yönetimi</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Yerel seçim, genel seçim ve CB seçimi ekleyebilirsiniz
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingElection(null);
            setFormData({
              name: '',
              date: '',
              type: 'yerel',
              parties: [],
              candidates: []
            });
            setPartyInput('');
            setCandidateInput('');
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? 'İptal' : '+ Yeni Seçim Ekle'}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${
          messageType === 'success' 
            ? 'bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-200' 
            : 'bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-200'
        }`}>
          {message}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Seçim Adı *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Seçim Tarihi *
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Seçmen Sayısı *
            </label>
            <input
              type="number"
              name="voter_count"
              value={formData.voter_count}
              onChange={handleInputChange}
              min="0"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              placeholder="Toplam seçmen sayısı"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Seçim Tipi *
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              required
            >
              <option value="yerel">Yerel Seçim</option>
              <option value="genel">Genel Seçim</option>
              <option value="cb">CB Seçimi</option>
            </select>
          </div>

          {(formData.type === 'yerel' || formData.type === 'genel') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Katılan Partiler *
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={partyInput}
                  onChange={(e) => setPartyInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddParty();
                    }
                  }}
                  placeholder="Parti adı girin ve Enter'a basın"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={handleAddParty}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Ekle
                </button>
              </div>
              {formData.parties.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.parties.map((party, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-3 py-1 rounded-full text-sm"
                    >
                      {party}
                      <button
                        type="button"
                        onClick={() => handleRemoveParty(index)}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {formData.type === 'cb' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                CB Adayları *
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={candidateInput}
                  onChange={(e) => setCandidateInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCandidate();
                    }
                  }}
                  placeholder="Aday adı girin ve Enter'a basın"
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={handleAddCandidate}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  Ekle
                </button>
              </div>
              {formData.candidates.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.candidates.map((candidate, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-3 py-1 rounded-full text-sm"
                    >
                      {candidate}
                      <button
                        type="button"
                        onClick={() => handleRemoveCandidate(index)}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {editingElection ? 'Güncelle' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingElection(null);
                setFormData({
                  name: '',
                  date: '',
                  type: 'yerel',
                  parties: [],
                  candidates: []
                });
                setPartyInput('');
                setCandidateInput('');
              }}
              className="bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 px-6 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Seçim Adı
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tarih
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Tip
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Detaylar
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {elections.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                  Henüz seçim eklenmemiş
                </td>
              </tr>
            ) : (
              elections.map((election) => (
                <tr key={election.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {election.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {election.date ? (() => {
                      try {
                        const date = new Date(election.date);
                        return !isNaN(date.getTime()) ? date.toLocaleDateString('tr-TR') : '-';
                      } catch (e) {
                        return '-';
                      }
                    })() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {getTypeLabel(election.type)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {election.type === 'cb' ? (
                      <div>
                        <span className="font-medium">Adaylar:</span>{' '}
                        {election.candidates?.join(', ') || '-'}
                      </div>
                    ) : (
                      <div>
                        <span className="font-medium">Partiler:</span>{' '}
                        {election.parties?.join(', ') || '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/election-results/${election.id}`}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-4 inline-block"
                    >
                      Sonuçlar
                    </Link>
                    <button
                      onClick={() => handleEdit(election)}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-4"
                    >
                      Düzenle
                    </button>
                    <button
                      onClick={() => handleDelete(election.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SeçimEkleSettings;

