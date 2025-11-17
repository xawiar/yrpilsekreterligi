import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ApiService from '../utils/ApiService';

const SeçimEkleSettings = () => {
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingElection, setEditingElection] = useState(null);
  
  // Form data structure for new election system
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    type: 'genel', // genel, yerel, referandum
    status: 'draft', // draft, active, closed
    // Genel Seçim için
    cb_candidates: [], // Cumhurbaşkanı adayları
    parties: [], // Partiler ve her partinin MV adayları: [{name: 'Parti Adı', mv_candidates: ['Aday1', 'Aday2']}]
    independent_cb_candidates: [], // Bağımsız CB adayları
    independent_mv_candidates: [], // Bağımsız MV adayları
    mv_total_seats: '', // İldeki toplam Milletvekili sayısı (D'Hondt için)
    // Yerel Seçim için
    mayor_parties: [], // Belediye Başkanı partileri ve adayları: [{name: 'Parti Adı', candidates: ['Aday1', 'Aday2']}]
    mayor_candidates: [], // Bağımsız Belediye Başkanı adayları
    provincial_assembly_parties: [], // İl Genel Meclisi partileri ve adayları: [{name: 'Parti Adı', candidates: ['Aday1', 'Aday2']}]
    provincial_assembly_district_seats: {}, // İl Genel Meclisi için ilçe bazlı üye sayıları: { 'İlçe Adı': üyeSayısı }
    municipal_council_parties: [], // Belediye Meclis partileri ve adayları: [{name: 'Parti Adı', candidates: ['Aday1', 'Aday2']}]
    municipal_council_total_seats: '', // Belediye Meclisi toplam üye sayısı (D'Hondt için)
    population: '', // Belediye nüfusu (Kontenjan sayısını belirlemek için)
    // Referandum için (otomatik Evet/Hayır)
  });
  
  const [partyInput, setPartyInput] = useState('');
  const [mvCandidateInput, setMvCandidateInput] = useState({}); // Her parti için ayrı input
  const [selectedPartyIndex, setSelectedPartyIndex] = useState(null);
  // Her input türü için ayrı state
  const [cbCandidateInput, setCbCandidateInput] = useState('');
  const [independentCbCandidateInput, setIndependentCbCandidateInput] = useState('');
  const [independentMvCandidateInput, setIndependentMvCandidateInput] = useState('');
  const [mayorCandidateInput, setMayorCandidateInput] = useState('');
  const [mayorPartyInput, setMayorPartyInput] = useState(''); // Belediye başkanı için parti
  const [mayorCandidateInputs, setMayorCandidateInputs] = useState({}); // Her belediye başkanı partisi için ayrı aday input
  const [provincialAssemblyPartyInput, setProvincialAssemblyPartyInput] = useState('');
  const [provincialAssemblyCandidateInputs, setProvincialAssemblyCandidateInputs] = useState({}); // Her il genel meclisi partisi için ayrı aday input
  const [municipalCouncilPartyInput, setMunicipalCouncilPartyInput] = useState('');
  const [municipalCouncilCandidateInputs, setMunicipalCouncilCandidateInputs] = useState({}); // Her belediye meclisi partisi için ayrı aday input
  const [districtInput, setDistrictInput] = useState(''); // İl Genel Meclisi için ilçe adı
  const [districtSeatsInput, setDistrictSeatsInput] = useState(''); // İl Genel Meclisi için ilçe üye sayısı
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
        cb_candidates: [],
        parties: [],
        independent_cb_candidates: [],
        independent_mv_candidates: [],
        mayor_parties: [],
        mayor_candidates: [],
        provincial_assembly_parties: [],
        municipal_council_parties: []
      })
    }));
  };

  // Genel Seçim için fonksiyonlar
  const handleAddCbCandidate = () => {
    if (cbCandidateInput.trim()) {
      setFormData(prev => ({
        ...prev,
        cb_candidates: [...prev.cb_candidates, cbCandidateInput.trim()]
      }));
      setCbCandidateInput('');
    }
  };

  const handleRemoveCbCandidate = (index) => {
    setFormData(prev => ({
      ...prev,
      cb_candidates: prev.cb_candidates.filter((_, i) => i !== index)
    }));
  };

  const handleAddParty = () => {
    if (partyInput.trim()) {
      setFormData(prev => ({
        ...prev,
        parties: [...prev.parties, { name: partyInput.trim(), mv_candidates: [] }]
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

  const handleAddMvCandidate = (partyIndex) => {
    const inputValue = mvCandidateInput[partyIndex] || '';
    if (inputValue.trim()) {
      setFormData(prev => ({
        ...prev,
        parties: prev.parties.map((party, i) => 
          i === partyIndex 
            ? { ...party, mv_candidates: [...party.mv_candidates, inputValue.trim()] }
            : party
        )
      }));
      setMvCandidateInput(prev => ({ ...prev, [partyIndex]: '' }));
      setSelectedPartyIndex(null);
    }
  };

  const handleRemoveMvCandidate = (partyIndex, candidateIndex) => {
    setFormData(prev => ({
      ...prev,
      parties: prev.parties.map((party, i) => 
        i === partyIndex 
          ? { ...party, mv_candidates: party.mv_candidates.filter((_, ci) => ci !== candidateIndex) }
          : party
      )
    }));
  };

  const handleAddIndependentCbCandidate = () => {
    if (independentCbCandidateInput.trim()) {
      setFormData(prev => ({
        ...prev,
        independent_cb_candidates: [...prev.independent_cb_candidates, independentCbCandidateInput.trim()]
      }));
      setIndependentCbCandidateInput('');
    }
  };

  const handleRemoveIndependentCbCandidate = (index) => {
    setFormData(prev => ({
      ...prev,
      independent_cb_candidates: prev.independent_cb_candidates.filter((_, i) => i !== index)
    }));
  };

  const handleAddIndependentMvCandidate = () => {
    if (independentMvCandidateInput.trim()) {
      setFormData(prev => ({
        ...prev,
        independent_mv_candidates: [...prev.independent_mv_candidates, independentMvCandidateInput.trim()]
      }));
      setIndependentMvCandidateInput('');
    }
  };

  const handleRemoveIndependentMvCandidate = (index) => {
    setFormData(prev => ({
      ...prev,
      independent_mv_candidates: prev.independent_mv_candidates.filter((_, i) => i !== index)
    }));
  };

  // Yerel Seçim için fonksiyonlar
  // Belediye Başkanı: Parti bazlı (bağımsızlar hariç)
  const handleAddMayorParty = () => {
    if (mayorPartyInput.trim()) {
      setFormData(prev => ({
        ...prev,
        mayor_parties: [...(prev.mayor_parties || []), { name: mayorPartyInput.trim(), candidates: [] }]
      }));
      setMayorPartyInput('');
    }
  };

  const handleRemoveMayorParty = (index) => {
    setFormData(prev => ({
      ...prev,
      mayor_parties: (prev.mayor_parties || []).filter((_, i) => i !== index)
    }));
    // Aday input'unu da temizle
    setMayorCandidateInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[index];
      return newInputs;
    });
  };

  // Belediye Başkanı Partisi için Aday Ekleme
  const handleAddMayorPartyCandidate = (partyIndex) => {
    const candidateName = mayorCandidateInputs[partyIndex]?.trim();
    if (candidateName) {
      setFormData(prev => {
        const newParties = [...(prev.mayor_parties || [])];
        if (!newParties[partyIndex].candidates) {
          newParties[partyIndex].candidates = [];
        }
        newParties[partyIndex].candidates.push(candidateName);
        return { ...prev, mayor_parties: newParties };
      });
      setMayorCandidateInputs(prev => ({
        ...prev,
        [partyIndex]: ''
      }));
    }
  };

  const handleRemoveMayorPartyCandidate = (partyIndex, candidateIndex) => {
    setFormData(prev => {
      const newParties = [...(prev.mayor_parties || [])];
      newParties[partyIndex].candidates = newParties[partyIndex].candidates.filter((_, i) => i !== candidateIndex);
      return { ...prev, mayor_parties: newParties };
    });
  };

  // Bağımsız Belediye Başkanı Adayları
  const handleAddMayorCandidate = () => {
    if (mayorCandidateInput.trim()) {
      setFormData(prev => ({
        ...prev,
        mayor_candidates: [...(prev.mayor_candidates || []), mayorCandidateInput.trim()]
      }));
      setMayorCandidateInput('');
    }
  };

  const handleRemoveMayorCandidate = (index) => {
    setFormData(prev => ({
      ...prev,
      mayor_candidates: prev.mayor_candidates.filter((_, i) => i !== index)
    }));
  };

  // İl Genel Meclisi: Parti bazlı
  const handleAddProvincialAssemblyParty = () => {
    if (provincialAssemblyPartyInput.trim()) {
      setFormData(prev => ({
        ...prev,
        provincial_assembly_parties: [...(prev.provincial_assembly_parties || []), { name: provincialAssemblyPartyInput.trim(), candidates: [] }]
      }));
      setProvincialAssemblyPartyInput('');
    }
  };

  const handleRemoveProvincialAssemblyParty = (index) => {
    setFormData(prev => ({
      ...prev,
      provincial_assembly_parties: (prev.provincial_assembly_parties || []).filter((_, i) => i !== index)
    }));
    // Aday input'unu da temizle
    setProvincialAssemblyCandidateInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[index];
      return newInputs;
    });
  };

  // İl Genel Meclisi Partisi için Aday Ekleme
  const handleAddProvincialAssemblyPartyCandidate = (partyIndex) => {
    const candidateName = provincialAssemblyCandidateInputs[partyIndex]?.trim();
    if (candidateName) {
      setFormData(prev => {
        const newParties = [...(prev.provincial_assembly_parties || [])];
        if (!newParties[partyIndex].candidates) {
          newParties[partyIndex].candidates = [];
        }
        newParties[partyIndex].candidates.push(candidateName);
        return { ...prev, provincial_assembly_parties: newParties };
      });
      setProvincialAssemblyCandidateInputs(prev => ({
        ...prev,
        [partyIndex]: ''
      }));
    }
  };

  const handleRemoveProvincialAssemblyPartyCandidate = (partyIndex, candidateIndex) => {
    setFormData(prev => {
      const newParties = [...(prev.provincial_assembly_parties || [])];
      newParties[partyIndex].candidates = newParties[partyIndex].candidates.filter((_, i) => i !== candidateIndex);
      return { ...prev, provincial_assembly_parties: newParties };
    });
  };


  // Belediye Meclisi: Parti bazlı
  const handleAddMunicipalCouncilParty = () => {
    if (municipalCouncilPartyInput.trim()) {
      setFormData(prev => ({
        ...prev,
        municipal_council_parties: [...(prev.municipal_council_parties || []), { name: municipalCouncilPartyInput.trim(), candidates: [] }]
      }));
      setMunicipalCouncilPartyInput('');
    }
  };

  const handleRemoveMunicipalCouncilParty = (index) => {
    setFormData(prev => ({
      ...prev,
      municipal_council_parties: (prev.municipal_council_parties || []).filter((_, i) => i !== index)
    }));
    // Aday input'unu da temizle
    setMunicipalCouncilCandidateInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[index];
      return newInputs;
    });
  };

  // Belediye Meclisi Partisi için Aday Ekleme
  const handleAddMunicipalCouncilPartyCandidate = (partyIndex) => {
    const candidateName = municipalCouncilCandidateInputs[partyIndex]?.trim();
    if (candidateName) {
      setFormData(prev => {
        const newParties = [...(prev.municipal_council_parties || [])];
        if (!newParties[partyIndex].candidates) {
          newParties[partyIndex].candidates = [];
        }
        newParties[partyIndex].candidates.push(candidateName);
        return { ...prev, municipal_council_parties: newParties };
      });
      setMunicipalCouncilCandidateInputs(prev => ({
        ...prev,
        [partyIndex]: ''
      }));
    }
  };

  const handleRemoveMunicipalCouncilPartyCandidate = (partyIndex, candidateIndex) => {
    setFormData(prev => {
      const newParties = [...(prev.municipal_council_parties || [])];
      newParties[partyIndex].candidates = newParties[partyIndex].candidates.filter((_, i) => i !== candidateIndex);
      return { ...prev, municipal_council_parties: newParties };
    });
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

    // Validasyon - Seçim türüne göre
    if (formData.type === 'genel') {
      if (formData.cb_candidates.length === 0) {
        setMessage('Genel seçim için en az bir Cumhurbaşkanı adayı eklenmelidir');
        setMessageType('error');
        return;
      }
      if (formData.parties.length === 0) {
        setMessage('Genel seçim için en az bir parti eklenmelidir');
        setMessageType('error');
        return;
      }
      // Her parti için en az bir MV adayı kontrolü
      const partiesWithoutMvCandidates = formData.parties.filter(p => p.mv_candidates.length === 0);
      if (partiesWithoutMvCandidates.length > 0) {
        setMessage('Her parti için en az bir Milletvekili adayı eklenmelidir');
        setMessageType('error');
        return;
      }
      // MV toplam sayısı kontrolü
      if (!formData.mv_total_seats || parseInt(formData.mv_total_seats) <= 0) {
        setMessage('İldeki toplam Milletvekili sayısı girilmelidir (D\'Hondt hesaplaması için)');
        setMessageType('error');
        return;
      }
    } else if (formData.type === 'yerel') {
      // Belediye başkanı için parti veya bağımsız aday olmalı
      const hasMayorParties = formData.mayor_parties && formData.mayor_parties.length > 0;
      const hasMayorCandidates = formData.mayor_candidates && formData.mayor_candidates.length > 0;
      if (!hasMayorParties && !hasMayorCandidates) {
        setMessage('Yerel seçim için en az bir Belediye Başkanı partisi veya bağımsız aday eklenmelidir');
        setMessageType('error');
        return;
      }
      // Belediye başkanı partileri için aday kontrolü (opsiyonel - aday olmadan da parti eklenebilir)
      
      if (!formData.provincial_assembly_parties || formData.provincial_assembly_parties.length === 0) {
        setMessage('Yerel seçim için en az bir İl Genel Meclisi partisi eklenmelidir');
        setMessageType('error');
        return;
      }
      // İl Genel Meclisi partileri için aday kontrolü (opsiyonel - aday olmadan da parti eklenebilir)
      
      if (!formData.municipal_council_parties || formData.municipal_council_parties.length === 0) {
        setMessage('Yerel seçim için en az bir Belediye Meclis partisi eklenmelidir');
        setMessageType('error');
        return;
      }
      // Belediye Meclisi partileri için aday kontrolü (opsiyonel - aday olmadan da parti eklenebilir)
      // Belediye Meclisi toplam üye sayısı kontrolü
      if (!formData.municipal_council_total_seats || parseInt(formData.municipal_council_total_seats) <= 0) {
        setMessage('Belediye Meclisi toplam üye sayısı girilmelidir (D\'Hondt hesaplaması için)');
        setMessageType('error');
        return;
      }
      // Nüfus kontrolü
      if (!formData.population || parseInt(formData.population) < 0) {
        setMessage('Belediye nüfusu girilmelidir (Kontenjan hesaplaması için)');
        setMessageType('error');
        return;
      }
    }
    // Referandum için validasyon gerekmez (otomatik Evet/Hayır)

    try {
      if (editingElection) {
        await ApiService.updateElection(editingElection.id, formData);
        setMessage('Seçim başarıyla güncellendi');
      } else {
        await ApiService.createElection(formData);
        setMessage('Seçim başarıyla eklendi');
      }
      
      setMessageType('success');
      resetForm();
      setShowForm(false);
      fetchElections();
    } catch (error) {
      console.error('Error saving election:', error);
      setMessage(error.message || 'Seçim kaydedilirken hata oluştu');
      setMessageType('error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      date: '',
      type: 'genel',
      status: 'draft',
      cb_candidates: [],
      parties: [],
      independent_cb_candidates: [],
      independent_mv_candidates: [],
      mv_total_seats: '',
      mayor_parties: [],
      mayor_candidates: [],
      provincial_assembly_parties: [],
      provincial_assembly_district_seats: {},
      municipal_council_parties: [],
      municipal_council_total_seats: '',
      population: ''
    });
    setPartyInput('');
    setMvCandidateInput({});
    setSelectedPartyIndex(null);
    setCbCandidateInput('');
    setIndependentCbCandidateInput('');
    setIndependentMvCandidateInput('');
    setMayorCandidateInput('');
    setMayorPartyInput('');
    setMayorCandidateInputs({});
    setProvincialAssemblyPartyInput('');
    setProvincialAssemblyCandidateInputs({});
    setMunicipalCouncilPartyInput('');
    setMunicipalCouncilCandidateInputs({});
  };

  const handleEdit = (election) => {
    setEditingElection(election);
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
      type: election.type || 'genel',
      status: election.status || 'draft',
      cb_candidates: election.cb_candidates || [],
      parties: election.parties || [],
      independent_cb_candidates: election.independent_cb_candidates || [],
      independent_mv_candidates: election.independent_mv_candidates || [],
      mv_total_seats: election.mv_total_seats || '',
      mayor_parties: (election.mayor_parties || []).map(p => typeof p === 'string' ? { name: p, candidates: [] } : p),
      mayor_candidates: election.mayor_candidates || [],
      provincial_assembly_parties: (election.provincial_assembly_parties || []).map(p => typeof p === 'string' ? { name: p, candidates: [] } : p),
      provincial_assembly_district_seats: election.provincial_assembly_district_seats || {},
      municipal_council_parties: (election.municipal_council_parties || []).map(p => typeof p === 'string' ? { name: p, candidates: [] } : p),
      municipal_council_total_seats: election.municipal_council_total_seats || '',
      population: election.population || ''
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
      'genel': 'Genel Seçim',
      'yerel': 'Yerel Seçim',
      'referandum': 'Referandum'
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status) => {
    const labels = {
      'draft': 'Taslak',
      'active': 'Aktif',
      'closed': 'Kapalı'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      'draft': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
      'active': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'closed': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    };
    return colors[status] || colors.draft;
  };

  const handleStatusChange = async (electionId, newStatus) => {
    try {
      await ApiService.updateElectionStatus(electionId, newStatus);
      setMessage(`Seçim durumu "${getStatusLabel(newStatus)}" olarak güncellendi`);
      setMessageType('success');
      fetchElections();
    } catch (error) {
      console.error('Error updating election status:', error);
      setMessage(error.message || 'Durum güncellenirken hata oluştu');
      setMessageType('error');
    }
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
            Genel seçim, yerel seçim ve referandum ekleyebilirsiniz
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingElection(null);
            resetForm();
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
        <form onSubmit={handleSubmit} className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg space-y-6">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <option value="genel">Genel Seçim (CB + MV)</option>
                <option value="yerel">Yerel Seçim</option>
                <option value="referandum">Referandum</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Durum *
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                required
              >
                <option value="draft">Taslak</option>
                <option value="active">Aktif</option>
                <option value="closed">Kapalı</option>
              </select>
            </div>
          </div>

          {/* Genel Seçim Formu */}
          {formData.type === 'genel' && (
            <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Genel Seçim Bilgileri</h3>
              
              {/* Cumhurbaşkanı Adayları */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cumhurbaşkanı Adayları *
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={cbCandidateInput}
                    onChange={(e) => setCbCandidateInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCbCandidate();
                      }
                    }}
                    placeholder="CB adayı adı girin ve Enter'a basın"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddCbCandidate}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Ekle
                  </button>
                </div>
                {formData.cb_candidates.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.cb_candidates.map((candidate, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-2 bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-3 py-1 rounded-full text-sm"
                      >
                        {candidate}
                        <button
                          type="button"
                          onClick={() => handleRemoveCbCandidate(index)}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Partiler ve MV Adayları */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Partiler ve Milletvekili Adayları *
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
                    Parti Ekle
                  </button>
                </div>
                
                {formData.parties.map((party, partyIndex) => (
                  <div key={partyIndex} className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">{party.name}</h4>
                      <button
                        type="button"
                        onClick={() => handleRemoveParty(partyIndex)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                      >
                        Partiyi Sil
                      </button>
                    </div>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={mvCandidateInput[partyIndex] || ''}
                        onChange={(e) => setMvCandidateInput(prev => ({ ...prev, [partyIndex]: e.target.value }))}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddMvCandidate(partyIndex);
                          }
                        }}
                        onFocus={() => setSelectedPartyIndex(partyIndex)}
                        placeholder="MV adayı adı girin ve Enter'a basın"
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddMvCandidate(partyIndex)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        MV Ekle
                      </button>
                    </div>
                    {party.mv_candidates.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {party.mv_candidates.map((candidate, candidateIndex) => (
                          <span
                            key={candidateIndex}
                            className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-sm"
                          >
                            {candidate}
                            <button
                              type="button"
                              onClick={() => handleRemoveMvCandidate(partyIndex, candidateIndex)}
                              className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Bağımsız CB Adayları */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bağımsız Cumhurbaşkanı Adayları
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={independentCbCandidateInput}
                    onChange={(e) => setIndependentCbCandidateInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddIndependentCbCandidate();
                      }
                    }}
                    placeholder="Bağımsız CB adayı adı girin ve Enter'a basın"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddIndependentCbCandidate}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Ekle
                  </button>
                </div>
                {formData.independent_cb_candidates.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.independent_cb_candidates.map((candidate, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-3 py-1 rounded-full text-sm"
                      >
                        {candidate}
                        <button
                          type="button"
                          onClick={() => handleRemoveIndependentCbCandidate(index)}
                          className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* İldeki Toplam Milletvekili Sayısı (D'Hondt için) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  İldeki Toplam Milletvekili Sayısı (D'Hondt Hesaplaması için) *
                </label>
                <input
                  type="number"
                  name="mv_total_seats"
                  value={formData.mv_total_seats}
                  onChange={handleInputChange}
                  min="1"
                  placeholder="Örn: 10"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Bu il için seçilecek toplam milletvekili sayısı. D'Hondt hesaplaması için gereklidir.
                </p>
              </div>

              {/* Bağımsız MV Adayları */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bağımsız Milletvekili Adayları
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={independentMvCandidateInput}
                    onChange={(e) => setIndependentMvCandidateInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddIndependentMvCandidate();
                      }
                    }}
                    placeholder="Bağımsız MV adayı adı girin ve Enter'a basın"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddIndependentMvCandidate}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Ekle
                  </button>
                </div>
                {formData.independent_mv_candidates.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.independent_mv_candidates.map((candidate, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-3 py-1 rounded-full text-sm"
                      >
                        {candidate}
                        <button
                          type="button"
                          onClick={() => handleRemoveIndependentMvCandidate(index)}
                          className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Yerel Seçim Formu */}
          {formData.type === 'yerel' && (
            <div className="space-y-6 border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Yerel Seçim Bilgileri</h3>
              
              {/* Belediye Başkanı Partileri */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Belediye Başkanı Partileri *
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={mayorPartyInput}
                    onChange={(e) => setMayorPartyInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddMayorParty();
                      }
                    }}
                    placeholder="Belediye Başkanı partisi adı girin ve Enter'a basın"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddMayorParty}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Parti Ekle
                  </button>
                </div>
                {formData.mayor_parties && formData.mayor_parties.length > 0 && (
                  <div className="space-y-3 mt-3">
                    {formData.mayor_parties.map((party, index) => {
                      const partyName = typeof party === 'string' ? party : party.name;
                      const partyCandidates = typeof party === 'object' && party.candidates ? party.candidates : [];
                      return (
                        <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-indigo-800 dark:text-indigo-200">{partyName}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMayorParty(index)}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm"
                            >
                              Partiyi Sil
                            </button>
                          </div>
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={mayorCandidateInputs[index] || ''}
                              onChange={(e) => setMayorCandidateInputs(prev => ({ ...prev, [index]: e.target.value }))}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddMayorPartyCandidate(index);
                                }
                              }}
                              placeholder="Bu parti için aday adı girin ve Enter'a basın"
                              className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddMayorPartyCandidate(index)}
                              className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                            >
                              Aday Ekle
                            </button>
                          </div>
                          {partyCandidates.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {partyCandidates.map((candidate, candidateIndex) => (
                                <span
                                  key={candidateIndex}
                                  className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded text-xs"
                                >
                                  {candidate}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMayorPartyCandidate(index, candidateIndex)}
                                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bağımsız Belediye Başkanı Adayları */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bağımsız Belediye Başkanı Adayları
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={mayorCandidateInput}
                    onChange={(e) => setMayorCandidateInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddMayorCandidate();
                      }
                    }}
                    placeholder="Bağımsız Belediye Başkanı adayı adı girin ve Enter'a basın"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddMayorCandidate}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Ekle
                  </button>
                </div>
                {formData.mayor_candidates && formData.mayor_candidates.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.mayor_candidates.map((candidate, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-3 py-1 rounded-full text-sm"
                      >
                        {candidate}
                        <button
                          type="button"
                          onClick={() => handleRemoveMayorCandidate(index)}
                          className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* İl Genel Meclisi Partileri */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  İl Genel Meclisi Partileri *
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={provincialAssemblyPartyInput}
                    onChange={(e) => setProvincialAssemblyPartyInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddProvincialAssemblyParty();
                      }
                    }}
                    placeholder="İl Genel Meclisi partisi adı girin ve Enter'a basın"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddProvincialAssemblyParty}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Parti Ekle
                  </button>
                </div>
                {formData.provincial_assembly_parties && formData.provincial_assembly_parties.length > 0 && (
                  <div className="space-y-3 mt-3">
                    {formData.provincial_assembly_parties.map((party, index) => {
                      const partyName = typeof party === 'string' ? party : party.name;
                      const partyCandidates = typeof party === 'object' && party.candidates ? party.candidates : [];
                      return (
                        <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-blue-800 dark:text-blue-200">{partyName}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveProvincialAssemblyParty(index)}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm"
                            >
                              Partiyi Sil
                            </button>
                          </div>
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={provincialAssemblyCandidateInputs[index] || ''}
                              onChange={(e) => setProvincialAssemblyCandidateInputs(prev => ({ ...prev, [index]: e.target.value }))}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddProvincialAssemblyPartyCandidate(index);
                                }
                              }}
                              placeholder="Bu parti için aday adı girin ve Enter'a basın"
                              className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddProvincialAssemblyPartyCandidate(index)}
                              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                            >
                              Aday Ekle
                            </button>
                          </div>
                          {partyCandidates.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {partyCandidates.map((candidate, candidateIndex) => (
                                <span
                                  key={candidateIndex}
                                  className="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs"
                                >
                                  {candidate}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveProvincialAssemblyPartyCandidate(index, candidateIndex)}
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Belediye Meclis Partileri */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Belediye Meclis Partileri *
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={municipalCouncilPartyInput}
                    onChange={(e) => setMunicipalCouncilPartyInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddMunicipalCouncilParty();
                      }
                    }}
                    placeholder="Belediye Meclis partisi adı girin ve Enter'a basın"
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddMunicipalCouncilParty}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Parti Ekle
                  </button>
                </div>
                {formData.municipal_council_parties && formData.municipal_council_parties.length > 0 && (
                  <div className="space-y-3 mt-3">
                    {formData.municipal_council_parties.map((party, index) => {
                      const partyName = typeof party === 'string' ? party : party.name;
                      const partyCandidates = typeof party === 'object' && party.candidates ? party.candidates : [];
                      return (
                        <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-yellow-800 dark:text-yellow-200">{partyName}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMunicipalCouncilParty(index)}
                              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm"
                            >
                              Partiyi Sil
                            </button>
                          </div>
                          <div className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={municipalCouncilCandidateInputs[index] || ''}
                              onChange={(e) => setMunicipalCouncilCandidateInputs(prev => ({ ...prev, [index]: e.target.value }))}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddMunicipalCouncilPartyCandidate(index);
                                }
                              }}
                              placeholder="Bu parti için aday adı girin ve Enter'a basın"
                              className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddMunicipalCouncilPartyCandidate(index)}
                              className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                            >
                              Aday Ekle
                            </button>
                          </div>
                          {partyCandidates.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {partyCandidates.map((candidate, candidateIndex) => (
                                <span
                                  key={candidateIndex}
                                  className="inline-flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded text-xs"
                                >
                                  {candidate}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMunicipalCouncilPartyCandidate(index, candidateIndex)}
                                    className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Belediye Meclisi Toplam Üye Sayısı ve Nüfus (D'Hondt için) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Belediye Meclisi Toplam Üye Sayısı (D'Hondt Hesaplaması için) *
                  </label>
                  <input
                    type="number"
                    name="municipal_council_total_seats"
                    value={formData.municipal_council_total_seats}
                    onChange={handleInputChange}
                    min="1"
                    placeholder="Örn: 25"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Belediye meclisindeki toplam üye sayısı. D'Hondt hesaplaması için gereklidir.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Belediye Nüfusu (Kontenjan Hesaplaması için) *
                  </label>
                  <input
                    type="number"
                    name="population"
                    value={formData.population}
                    onChange={handleInputChange}
                    min="0"
                    placeholder="Örn: 120000"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Belediye nüfusu. Kontenjan sayısını belirlemek için gereklidir (10.000 altı: 1, 10.000-100.000: 2, 100.000 üstü: 3).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Referandum Formu */}
          {formData.type === 'referandum' && (
            <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Referandum Bilgileri</h3>
              <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Referandum için otomatik olarak "Evet" ve "Hayır" seçenekleri oluşturulacaktır.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
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
                resetForm();
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
                Durum
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
                <td colSpan="6" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
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
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(election.status || 'draft')}`}>
                      {getStatusLabel(election.status || 'draft')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {election.type === 'genel' && (
                      <div className="space-y-1">
                        <div><span className="font-medium">CB:</span> {election.cb_candidates?.length || 0} aday</div>
                        <div><span className="font-medium">Partiler:</span> {election.parties?.length || 0} parti</div>
                      </div>
                    )}
                    {election.type === 'yerel' && (
                      <div className="space-y-1">
                        <div><span className="font-medium">Belediye Başkanı:</span> {election.mayor_parties?.length || 0} parti, {election.mayor_candidates?.length || 0} bağımsız</div>
                        <div><span className="font-medium">İl Genel Meclisi:</span> {election.provincial_assembly_parties?.length || 0} parti</div>
                        <div><span className="font-medium">Belediye Meclisi:</span> {election.municipal_council_parties?.length || 0} parti</div>
                      </div>
                    )}
                    {election.type === 'referandum' && (
                      <div>Evet / Hayır</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <select
                        value={election.status || 'draft'}
                        onChange={(e) => handleStatusChange(election.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded border ${getStatusColor(election.status || 'draft')} border-gray-300 dark:border-gray-600`}
                      >
                        <option value="draft">Taslak</option>
                        <option value="active">Aktif</option>
                        <option value="closed">Kapalı</option>
                      </select>
                      <Link
                        to={`/election-results/${election.id}`}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                      >
                        Sonuçlar
                      </Link>
                      <button
                        onClick={() => handleEdit(election)}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                      >
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleDelete(election.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
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
  );
};

export default SeçimEkleSettings;
