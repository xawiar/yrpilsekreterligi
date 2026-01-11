import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import Modal from '../components/Modal';
import { LoadingSpinner } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';

const PollsPage = () => {
  const { user } = useAuth();
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [pollResults, setPollResults] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'poll', // 'poll' or 'survey'
    options: ['', ''],
    endDate: '',
    endTime: ''
  });
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'ended', 'all'

  useEffect(() => {
    fetchPolls();
  }, [activeTab]);

  const fetchPolls = async () => {
    try {
      setLoading(true);
      const status = activeTab === 'all' ? null : activeTab;
      const data = await ApiService.getPolls(status);
      setPolls(data || []);
    } catch (error) {
      console.error('Error fetching polls:', error);
      alert('Anketler yüklenirken hata oluştu: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePoll = () => {
    setFormData({
      title: '',
      description: '',
      type: 'poll',
      options: ['', ''],
      endDate: '',
      endTime: ''
    });
    setIsCreateModalOpen(true);
  };

  const handleAddOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, '']
    });
  };

  const handleRemoveOption = (index) => {
    if (formData.options.length > 2) {
      setFormData({
        ...formData,
        options: formData.options.filter((_, i) => i !== index)
      });
    }
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...formData.options];
    newOptions[index] = value;
    setFormData({
      ...formData,
      options: newOptions
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim()) {
      alert('Başlık zorunludur');
      return;
    }
    
    if (formData.options.filter(opt => opt.trim()).length < 2) {
      alert('En az 2 seçenek gerekir');
      return;
    }
    
    if (!formData.endDate || !formData.endTime) {
      alert('Bitiş tarihi ve saati zorunludur');
      return;
    }
    
    try {
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
      const now = new Date();
      
      if (endDateTime <= now) {
        alert('Bitiş tarihi gelecekte olmalıdır');
        return;
      }
      
      const pollData = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        type: formData.type,
        options: formData.options.filter(opt => opt.trim()),
        endDate: endDateTime.toISOString(),
        createdBy: user?.id || null
      };
      
      await ApiService.createPoll(pollData);
      alert('Anket başarıyla oluşturuldu');
      setIsCreateModalOpen(false);
      fetchPolls();
    } catch (error) {
      console.error('Error creating poll:', error);
      alert('Anket oluşturulurken hata oluştu: ' + error.message);
    }
  };

  const handleShowResults = async (poll) => {
    try {
      const results = await ApiService.getPollResults(poll.id);
      setSelectedPoll(poll);
      setPollResults(results);
      setIsResultsModalOpen(true);
    } catch (error) {
      console.error('Error fetching poll results:', error);
      alert('Sonuçlar yüklenirken hata oluştu: ' + error.message);
    }
  };

  const handleEndPoll = async (pollId) => {
    if (window.confirm('Bu anketi sonlandırmak istediğinize emin misiniz?')) {
      try {
        await ApiService.endPoll(pollId);
        alert('Anket başarıyla sonlandırıldı');
        fetchPolls();
      } catch (error) {
        console.error('Error ending poll:', error);
        alert('Anket sonlandırılırken hata oluştu: ' + error.message);
      }
    }
  };

  const handleDeletePoll = async (pollId) => {
    if (window.confirm('Bu anketi silmek istediğinize emin misiniz?')) {
      try {
        await ApiService.deletePoll(pollId);
        alert('Anket başarıyla silindi');
        fetchPolls();
      } catch (error) {
        console.error('Error deleting poll:', error);
        alert('Anket silinirken hata oluştu: ' + error.message);
      }
    }
  };

  const isPollActive = (poll) => {
    if (poll.status !== 'active') return false;
    const endDate = new Date(poll.endDate);
    const now = new Date();
    return endDate > now;
  };

  const formatDate = (dateString) => {
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
      <div className="py-2 sm:py-4 md:py-6 w-full overflow-x-hidden">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="py-2 sm:py-4 md:py-6 w-full overflow-x-hidden">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Anket/Oylama Yönetimi</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Anket ve oylama oluşturun, yönetin</p>
          </div>
          <button
            onClick={handleCreatePoll}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Yeni Anket/Oylama Oluştur
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'active'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Aktif Anketler
          </button>
          <button
            onClick={() => setActiveTab('ended')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'ended'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Sonlanmış Anketler
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'all'
                ? 'text-indigo-600 border-b-2 border-indigo-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            Tümü
          </button>
        </div>
      </div>

      {/* Polls List */}
      <div className="space-y-4">
        {polls.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400">Henüz anket bulunmamaktadır</p>
          </div>
        ) : (
          polls.map((poll) => {
            const isActive = isPollActive(poll);
            return (
              <div
                key={poll.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{poll.title}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}>
                        {isActive ? 'Aktif' : 'Sonlanmış'}
                      </span>
                      <span className="px-2 py-1 text-xs rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                        {poll.type === 'poll' ? 'Oylama' : 'Anket'}
                      </span>
                    </div>
                    {poll.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{poll.description}</p>
                    )}
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span>Bitiş: {formatDate(poll.endDate)}</span>
                      <span>Seçenekler: {poll.options?.length || 0}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleShowResults(poll)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                    >
                      Sonuçları Gör
                    </button>
                    {isActive && (
                      <button
                        onClick={() => handleEndPoll(poll.id)}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                      >
                        Sonlandır
                      </button>
                    )}
                    <button
                      onClick={() => handleDeletePoll(poll.id)}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Poll Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Yeni Anket/Oylama Oluştur"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Başlık *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tip *
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="poll">Oylama</option>
              <option value="survey">Anket</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Seçenekler * (En az 2)
            </label>
            {formData.options.map((option, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  placeholder={`Seçenek ${index + 1}`}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                  required
                />
                {formData.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(index)}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Sil
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddOption}
              className="mt-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              Seçenek Ekle
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bitiş Tarihi *
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bitiş Saati *
              </label>
              <input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Oluştur
            </button>
          </div>
        </form>
      </Modal>

      {/* Results Modal */}
      <Modal
        isOpen={isResultsModalOpen}
        onClose={() => setIsResultsModalOpen(false)}
        title={selectedPoll ? `${selectedPoll.title} - Sonuçlar` : 'Anket Sonuçları'}
        size="lg"
      >
        {pollResults && (
          <div className="space-y-4">
            <div className="text-center py-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {pollResults.totalVotes}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Toplam Oy</p>
            </div>
            
            <div className="space-y-3">
              {pollResults.results.map((result, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {result.option}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {result.voteCount} oy ({result.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all"
                      style={{ width: `${result.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PollsPage;

