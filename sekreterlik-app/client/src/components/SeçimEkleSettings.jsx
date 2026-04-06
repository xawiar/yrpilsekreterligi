import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from './UI/ConfirmDialog';
import SecimElectionForm from './SecimElectionForm';
import SecimElectionsList from './SecimElectionsList';

const SeçimEkleSettings = ({ onElectionCreated, onElectionUpdated, onClose }) => {
  const toast = useToast();
  const { confirm, confirmDialogProps } = useConfirm();
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingElection, setEditingElection] = useState(null);

  // Form data structure for new election system
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    type: 'genel',
    status: 'draft',
    is_metropolitan: false,
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
    population: '',
    baraj_percent: 7.0
  });

  const [partyInput, setPartyInput] = useState('');
  const [mvCandidateInput, setMvCandidateInput] = useState({});
  const [selectedPartyIndex, setSelectedPartyIndex] = useState(null);
  const [cbCandidateInput, setCbCandidateInput] = useState('');
  const [independentCbCandidateInput, setIndependentCbCandidateInput] = useState('');
  const [independentMvCandidateInput, setIndependentMvCandidateInput] = useState('');
  const [mayorCandidateInput, setMayorCandidateInput] = useState('');
  const [mayorPartyInput, setMayorPartyInput] = useState('');
  const [mayorCandidateInputs, setMayorCandidateInputs] = useState({});
  const [provincialAssemblyPartyInput, setProvincialAssemblyPartyInput] = useState('');
  const [provincialAssemblyCandidateInputs, setProvincialAssemblyCandidateInputs] = useState({});
  const [municipalCouncilPartyInput, setMunicipalCouncilPartyInput] = useState('');
  const [municipalCouncilCandidateInputs, setMunicipalCouncilCandidateInputs] = useState({});
  const [districtInput, setDistrictInput] = useState('');
  const [districtSeatsInput, setDistrictSeatsInput] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // İttifak yönetimi state'leri
  const [alliances, setAlliances] = useState([]);
  const [allianceNameInput, setAllianceNameInput] = useState('');
  const [selectedAllianceParties, setSelectedAllianceParties] = useState([]);
  const [showAllianceForm, setShowAllianceForm] = useState(false);
  const [editingAlliance, setEditingAlliance] = useState(null);

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
      ...(name === 'type' && {
        cb_candidates: [],
        parties: [],
        independent_cb_candidates: [],
        independent_mv_candidates: [],
        mayor_parties: [],
        mayor_candidates: [],
        provincial_assembly_parties: [],
        municipal_council_parties: [],
        is_metropolitan: false
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
    setMayorCandidateInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[index];
      return newInputs;
    });
  };

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
      setMayorCandidateInputs(prev => ({ ...prev, [partyIndex]: '' }));
    }
  };

  const handleRemoveMayorPartyCandidate = (partyIndex, candidateIndex) => {
    setFormData(prev => {
      const newParties = [...(prev.mayor_parties || [])];
      newParties[partyIndex].candidates = newParties[partyIndex].candidates.filter((_, i) => i !== candidateIndex);
      return { ...prev, mayor_parties: newParties };
    });
  };

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

  // İl Genel Meclisi
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
    setProvincialAssemblyCandidateInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[index];
      return newInputs;
    });
  };

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
      setProvincialAssemblyCandidateInputs(prev => ({ ...prev, [partyIndex]: '' }));
    }
  };

  const handleRemoveProvincialAssemblyPartyCandidate = (partyIndex, candidateIndex) => {
    setFormData(prev => {
      const newParties = [...(prev.provincial_assembly_parties || [])];
      newParties[partyIndex].candidates = newParties[partyIndex].candidates.filter((_, i) => i !== candidateIndex);
      return { ...prev, provincial_assembly_parties: newParties };
    });
  };

  // Belediye Meclisi
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
    setMunicipalCouncilCandidateInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[index];
      return newInputs;
    });
  };

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
      setMunicipalCouncilCandidateInputs(prev => ({ ...prev, [partyIndex]: '' }));
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

    if (!formData.name.trim()) { setMessage('Seçim adı gereklidir'); setMessageType('error'); return; }
    if (!formData.date) { setMessage('Seçim tarihi gereklidir'); setMessageType('error'); return; }

    // Validasyon
    if (formData.type === 'cb') {
      if (formData.cb_candidates.length === 0 && formData.independent_cb_candidates.length === 0) {
        setMessage('Cumhurbaşkanı seçimi için en az bir aday eklenmelidir'); setMessageType('error'); return;
      }
    } else if (formData.type === 'mv') {
      if (formData.parties.length === 0 && formData.independent_mv_candidates.length === 0) {
        setMessage('Milletvekili seçimi için en az bir parti veya bağımsız aday eklenmelidir'); setMessageType('error'); return;
      }
      if (formData.parties.filter(p => p.mv_candidates.length === 0).length > 0) {
        setMessage('Her parti için en az bir Milletvekili adayı eklenmelidir'); setMessageType('error'); return;
      }
      if (!formData.mv_total_seats || parseInt(formData.mv_total_seats) <= 0) {
        setMessage('İldeki toplam Milletvekili sayısı girilmelidir (D\'Hondt hesaplaması için)'); setMessageType('error'); return;
      }
    } else if (formData.type === 'genel') {
      if (formData.cb_candidates.length === 0 && formData.independent_cb_candidates.length === 0) {
        setMessage('Genel seçim için en az bir Cumhurbaşkanı adayı eklenmelidir'); setMessageType('error'); return;
      }
      if (formData.parties.length === 0 && formData.independent_mv_candidates.length === 0) {
        setMessage('Genel seçim için en az bir parti veya bağımsız MV adayı eklenmelidir'); setMessageType('error'); return;
      }
      if (formData.parties.filter(p => p.mv_candidates.length === 0).length > 0) {
        setMessage('Her parti için en az bir Milletvekili adayı eklenmelidir'); setMessageType('error'); return;
      }
      if (!formData.mv_total_seats || parseInt(formData.mv_total_seats) <= 0) {
        setMessage('İldeki toplam Milletvekili sayısı girilmelidir (D\'Hondt hesaplaması için)'); setMessageType('error'); return;
      }
    } else if (['yerel_metropolitan_mayor', 'yerel_city_mayor', 'yerel_district_mayor'].includes(formData.type)) {
      const hasMayorParties = formData.mayor_parties && formData.mayor_parties.length > 0;
      const hasMayorCandidates = formData.mayor_candidates && formData.mayor_candidates.length > 0;
      if (!hasMayorParties && !hasMayorCandidates) {
        setMessage('Belediye Başkanı seçimi için en az bir parti veya bağımsız aday eklenmelidir'); setMessageType('error'); return;
      }
    } else if (formData.type === 'yerel_provincial_assembly') {
      if (!formData.provincial_assembly_parties || formData.provincial_assembly_parties.length === 0) {
        setMessage('İl Genel Meclisi seçimi için en az bir parti eklenmelidir'); setMessageType('error'); return;
      }
      if (!formData.provincial_assembly_district_seats || Object.keys(formData.provincial_assembly_district_seats).length === 0) {
        setMessage('İl Genel Meclisi için en az bir ilçe ve üye sayısı girilmelidir (D\'Hondt hesaplaması için)'); setMessageType('error'); return;
      }
    } else if (formData.type === 'yerel_municipal_council') {
      if (!formData.municipal_council_parties || formData.municipal_council_parties.length === 0) {
        setMessage('Belediye Meclisi seçimi için en az bir parti eklenmelidir'); setMessageType('error'); return;
      }
      if (!formData.municipal_council_total_seats || parseInt(formData.municipal_council_total_seats) <= 0) {
        setMessage('Belediye Meclisi toplam üye sayısı girilmelidir (D\'Hondt hesaplaması için)'); setMessageType('error'); return;
      }
      if (!formData.population || parseInt(formData.population) < 0) {
        setMessage('Belediye nüfusu girilmelidir (Kontenjan hesaplaması için)'); setMessageType('error'); return;
      }
    } else if (formData.type === 'yerel') {
      const hasMayorParties = formData.mayor_parties && formData.mayor_parties.length > 0;
      const hasMayorCandidates = formData.mayor_candidates && formData.mayor_candidates.length > 0;
      if (!hasMayorParties && !hasMayorCandidates) {
        setMessage('Yerel seçim için en az bir Belediye Başkanı partisi veya bağımsız aday eklenmelidir'); setMessageType('error'); return;
      }
      if (!formData.provincial_assembly_parties || formData.provincial_assembly_parties.length === 0) {
        setMessage('Yerel seçim için en az bir İl Genel Meclisi partisi eklenmelidir'); setMessageType('error'); return;
      }
      if (!formData.provincial_assembly_district_seats || Object.keys(formData.provincial_assembly_district_seats).length === 0) {
        setMessage('İl Genel Meclisi için en az bir ilçe ve üye sayısı girilmelidir (D\'Hondt hesaplaması için)'); setMessageType('error'); return;
      }
      if (!formData.municipal_council_parties || formData.municipal_council_parties.length === 0) {
        setMessage('Yerel seçim için en az bir Belediye Meclis partisi eklenmelidir'); setMessageType('error'); return;
      }
      if (!formData.municipal_council_total_seats || parseInt(formData.municipal_council_total_seats) <= 0) {
        setMessage('Belediye Meclisi toplam üye sayısı girilmelidir (D\'Hondt hesaplaması için)'); setMessageType('error'); return;
      }
      if (!formData.population || parseInt(formData.population) < 0) {
        setMessage('Belediye nüfusu girilmelidir (Kontenjan hesaplaması için)'); setMessageType('error'); return;
      }
    }

    try {
      let savedElection;
      if (editingElection) {
        await ApiService.updateElection(editingElection.id, formData);
        setMessage('Seçim başarıyla güncellendi');
        savedElection = { ...editingElection, ...formData };
      } else {
        const result = await ApiService.createElection(formData);
        setMessage('Seçim başarıyla eklendi');
        savedElection = result.election || { id: result.id, ...formData };
      }
      setMessageType('success');

      if (editingElection && onElectionUpdated) onElectionUpdated(savedElection);
      else if (!editingElection && onElectionCreated) onElectionCreated(savedElection);

      if (savedElection && savedElection.id) {
        setEditingElection(savedElection);
        try {
          const alliancesData = await ApiService.getAlliances(savedElection.id);
          setAlliances(Array.isArray(alliancesData) ? alliancesData : []);
        } catch (error) {
          console.error('Error fetching alliances:', error);
          setAlliances([]);
        }
      } else {
        resetForm();
        setShowForm(false);
      }

      fetchElections();

      if (onClose && !editingElection) {
        setTimeout(() => { onClose(); }, 1500);
      }
    } catch (error) {
      console.error('Error saving election:', error);
      setMessage(error.message || 'Seçim kaydedilirken hata oluştu');
      setMessageType('error');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '', date: '', type: 'genel', status: 'draft', is_metropolitan: false,
      cb_candidates: [], parties: [], independent_cb_candidates: [], independent_mv_candidates: [],
      mv_total_seats: '', mayor_parties: [], mayor_candidates: [], provincial_assembly_parties: [],
      provincial_assembly_district_seats: {}, municipal_council_parties: [], municipal_council_total_seats: '',
      population: '', baraj_percent: 7.0
    });
    setAlliances([]); setAllianceNameInput(''); setSelectedAllianceParties([]);
    setShowAllianceForm(false); setEditingAlliance(null); setEditingElection(null);
    setPartyInput(''); setMvCandidateInput({}); setSelectedPartyIndex(null);
    setCbCandidateInput(''); setIndependentCbCandidateInput(''); setIndependentMvCandidateInput('');
    setMayorCandidateInput(''); setMayorPartyInput(''); setMayorCandidateInputs({});
    setProvincialAssemblyPartyInput(''); setProvincialAssemblyCandidateInputs({});
    setMunicipalCouncilPartyInput(''); setMunicipalCouncilCandidateInputs({});
  };

  const handleEdit = async (election) => {
    setEditingElection(election);
    let dateValue = '';
    if (election.date) {
      try {
        const date = new Date(election.date);
        if (!isNaN(date.getTime())) dateValue = date.toISOString().split('T')[0];
      } catch (e) { console.error('Date parse error:', e); }
    }
    setFormData({
      name: election.name || '', date: dateValue, type: election.type || 'genel',
      status: election.status || 'draft', is_metropolitan: election.is_metropolitan || false,
      cb_candidates: election.cb_candidates || [], parties: election.parties || [],
      independent_cb_candidates: election.independent_cb_candidates || [],
      independent_mv_candidates: election.independent_mv_candidates || [],
      mv_total_seats: election.mv_total_seats || '',
      mayor_parties: (election.mayor_parties || []).map(p => typeof p === 'string' ? { name: p, candidates: [] } : p),
      mayor_candidates: election.mayor_candidates || [],
      provincial_assembly_parties: (election.provincial_assembly_parties || []).map(p => typeof p === 'string' ? { name: p, candidates: [] } : p),
      provincial_assembly_district_seats: election.provincial_assembly_district_seats || {},
      municipal_council_parties: (election.municipal_council_parties || []).map(p => typeof p === 'string' ? { name: p, candidates: [] } : p),
      municipal_council_total_seats: election.municipal_council_total_seats || '',
      population: election.population || '', baraj_percent: election.baraj_percent || 7.0
    });

    if (election.id) {
      try {
        const alliancesData = await ApiService.getAlliances(election.id);
        setAlliances(Array.isArray(alliancesData) ? alliancesData : []);
      } catch (error) { console.error('Error fetching alliances:', error); setAlliances([]); }
    }
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    const confirmed = await confirm({ title: 'Seçim Sil', message: 'Bu seçimi silmek istediğinize emin misiniz?' });
    if (!confirmed) return;
    try {
      await ApiService.deleteElection(id);
      toast.success('Seçim başarıyla silindi');
      fetchElections();
    } catch (error) {
      console.error('Error deleting election:', error);
      toast.error(error.message || 'Seçim silinirken hata oluştu');
    }
  };

  const handleCreateSecondRound = async (electionId) => {
    const confirmed = await confirm({
      title: '2. Tur Oluştur',
      message: 'Bu seçim için CB 2. tur oluşturulacak. İlk turda en çok oy alan 2 aday 2. tura taşınacak. Devam etmek istiyor musunuz?'
    });
    if (!confirmed) return;
    try {
      const result = await ApiService.createSecondRound(electionId);
      if (result.success) { toast.success(result.message || '2. tur başarıyla oluşturuldu'); fetchElections(); }
      else { toast.error(result.message || '2. tur oluşturulamadı'); }
    } catch (error) {
      console.error('Error creating second round:', error);
      toast.error(error.message || '2. tur oluşturulurken hata oluştu');
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      'cb': 'Cumhurbaşkanı Seçimi', 'mv': 'Milletvekili Genel Seçimi',
      'genel': 'Genel Seçim (CB + MV)', 'yerel': 'Yerel Seçim (Tüm Alt Türler)',
      'yerel_metropolitan_mayor': 'Büyükşehir Belediye Başkanı', 'yerel_city_mayor': 'İl Belediye Başkanı',
      'yerel_district_mayor': 'İlçe Belediye Başkanı', 'yerel_provincial_assembly': 'İl Genel Meclisi Üyesi',
      'yerel_municipal_council': 'Belediye Meclisi Üyesi', 'referandum': 'Referandum'
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status) => {
    const labels = { 'draft': 'Taslak', 'active': 'Aktif', 'closed': 'Kapalı' };
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

  const getAllowedStatusOptions = (currentStatus) => {
    const allowedTransitions = { 'draft': ['draft', 'active'], 'active': ['active', 'closed'], 'closed': ['closed'] };
    return allowedTransitions[currentStatus] || ['draft', 'active', 'closed'];
  };

  // İttifak yönetimi
  const handleCreateAlliance = async () => {
    if (!allianceNameInput.trim()) { setMessage('İttifak adı gerekli'); setMessageType('error'); return; }
    if (selectedAllianceParties.length < 2) { setMessage('İttifak en az 2 parti içermelidir'); setMessageType('error'); return; }
    if (!editingElection || !editingElection.id) { setMessage('Önce seçimi kaydedin'); setMessageType('error'); return; }
    try {
      const partyIds = selectedAllianceParties.map(p => typeof p === 'string' ? p : (p.name || String(p)));
      const result = await ApiService.createAlliance({ election_id: editingElection.id, name: allianceNameInput.trim(), party_ids: partyIds });
      if (result.id) {
        setAlliances([...alliances, result]); setAllianceNameInput(''); setSelectedAllianceParties([]);
        setShowAllianceForm(false); setMessage('İttifak başarıyla oluşturuldu'); setMessageType('success');
      } else { throw new Error(result.message || 'İttifak oluşturulamadı'); }
    } catch (error) {
      console.error('Error creating alliance:', error);
      setMessage(error.message || 'İttifak oluşturulurken hata oluştu'); setMessageType('error');
    }
  };

  const handleDeleteAlliance = async (allianceId) => {
    const confirmed = await confirm({ title: 'İttifak Sil', message: 'Bu ittifakı silmek istediğinize emin misiniz?' });
    if (!confirmed) return;
    try {
      await ApiService.deleteAlliance(allianceId);
      setAlliances(alliances.filter(a => a.id !== allianceId));
      toast.success('İttifak başarıyla silindi');
    } catch (error) { console.error('Error deleting alliance:', error); toast.error(error.message || 'İttifak silinirken hata oluştu'); }
  };

  const togglePartyForAlliance = (party) => {
    const partyName = typeof party === 'string' ? party : (party.name || String(party));
    if (selectedAllianceParties.some(p => (typeof p === 'string' ? p : (p.name || String(p))) === partyName)) {
      setSelectedAllianceParties(selectedAllianceParties.filter(p => (typeof p === 'string' ? p : (p.name || String(p))) !== partyName));
    } else {
      setSelectedAllianceParties([...selectedAllianceParties, party]);
    }
  };

  const handleStatusChange = async (electionId, newStatus) => {
    try {
      await ApiService.updateElectionStatus(electionId, newStatus);
      setMessage(`Seçim durumu "${getStatusLabel(newStatus)}" olarak güncellendi`); setMessageType('success');
      fetchElections();
    } catch (error) {
      console.error('Error updating election status:', error);
      setMessage(error.message || 'Durum güncellenirken hata oluştu'); setMessageType('error');
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
          onClick={() => { setShowForm(!showForm); setEditingElection(null); resetForm(); }}
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
        <SecimElectionForm
          formData={formData}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          editingElection={editingElection}
          getStatusLabel={getStatusLabel}
          getAllowedStatusOptions={getAllowedStatusOptions}
          cbCandidateInput={cbCandidateInput}
          setCbCandidateInput={setCbCandidateInput}
          handleAddCbCandidate={handleAddCbCandidate}
          handleRemoveCbCandidate={handleRemoveCbCandidate}
          independentCbCandidateInput={independentCbCandidateInput}
          setIndependentCbCandidateInput={setIndependentCbCandidateInput}
          handleAddIndependentCbCandidate={handleAddIndependentCbCandidate}
          handleRemoveIndependentCbCandidate={handleRemoveIndependentCbCandidate}
          partyInput={partyInput}
          setPartyInput={setPartyInput}
          handleAddParty={handleAddParty}
          handleRemoveParty={handleRemoveParty}
          mvCandidateInput={mvCandidateInput}
          setMvCandidateInput={setMvCandidateInput}
          setSelectedPartyIndex={setSelectedPartyIndex}
          handleAddMvCandidate={handleAddMvCandidate}
          handleRemoveMvCandidate={handleRemoveMvCandidate}
          independentMvCandidateInput={independentMvCandidateInput}
          setIndependentMvCandidateInput={setIndependentMvCandidateInput}
          handleAddIndependentMvCandidate={handleAddIndependentMvCandidate}
          handleRemoveIndependentMvCandidate={handleRemoveIndependentMvCandidate}
          mayorPartyInput={mayorPartyInput}
          setMayorPartyInput={setMayorPartyInput}
          handleAddMayorParty={handleAddMayorParty}
          handleRemoveMayorParty={handleRemoveMayorParty}
          mayorCandidateInputs={mayorCandidateInputs}
          setMayorCandidateInputs={setMayorCandidateInputs}
          handleAddMayorPartyCandidate={handleAddMayorPartyCandidate}
          handleRemoveMayorPartyCandidate={handleRemoveMayorPartyCandidate}
          mayorCandidateInput={mayorCandidateInput}
          setMayorCandidateInput={setMayorCandidateInput}
          handleAddMayorCandidate={handleAddMayorCandidate}
          handleRemoveMayorCandidate={handleRemoveMayorCandidate}
          provincialAssemblyPartyInput={provincialAssemblyPartyInput}
          setProvincialAssemblyPartyInput={setProvincialAssemblyPartyInput}
          handleAddProvincialAssemblyParty={handleAddProvincialAssemblyParty}
          handleRemoveProvincialAssemblyParty={handleRemoveProvincialAssemblyParty}
          provincialAssemblyCandidateInputs={provincialAssemblyCandidateInputs}
          setProvincialAssemblyCandidateInputs={setProvincialAssemblyCandidateInputs}
          handleAddProvincialAssemblyPartyCandidate={handleAddProvincialAssemblyPartyCandidate}
          handleRemoveProvincialAssemblyPartyCandidate={handleRemoveProvincialAssemblyPartyCandidate}
          districtInput={districtInput}
          setDistrictInput={setDistrictInput}
          districtSeatsInput={districtSeatsInput}
          setDistrictSeatsInput={setDistrictSeatsInput}
          setFormData={setFormData}
          municipalCouncilPartyInput={municipalCouncilPartyInput}
          setMunicipalCouncilPartyInput={setMunicipalCouncilPartyInput}
          handleAddMunicipalCouncilParty={handleAddMunicipalCouncilParty}
          handleRemoveMunicipalCouncilParty={handleRemoveMunicipalCouncilParty}
          municipalCouncilCandidateInputs={municipalCouncilCandidateInputs}
          setMunicipalCouncilCandidateInputs={setMunicipalCouncilCandidateInputs}
          handleAddMunicipalCouncilPartyCandidate={handleAddMunicipalCouncilPartyCandidate}
          handleRemoveMunicipalCouncilPartyCandidate={handleRemoveMunicipalCouncilPartyCandidate}
          alliances={alliances}
          showAllianceForm={showAllianceForm}
          setShowAllianceForm={setShowAllianceForm}
          allianceNameInput={allianceNameInput}
          setAllianceNameInput={setAllianceNameInput}
          selectedAllianceParties={selectedAllianceParties}
          setSelectedAllianceParties={setSelectedAllianceParties}
          setEditingAlliance={setEditingAlliance}
          handleCreateAlliance={handleCreateAlliance}
          handleDeleteAlliance={handleDeleteAlliance}
          togglePartyForAlliance={togglePartyForAlliance}
          setShowForm={setShowForm}
          setEditingElection={setEditingElection}
          resetForm={resetForm}
        />
      )}

      <SecimElectionsList
        elections={elections}
        getTypeLabel={getTypeLabel}
        getStatusLabel={getStatusLabel}
        getStatusColor={getStatusColor}
        getAllowedStatusOptions={getAllowedStatusOptions}
        handleStatusChange={handleStatusChange}
        handleCreateSecondRound={handleCreateSecondRound}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
      />

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

export default SeçimEkleSettings;
