import React, { useState, useEffect, useRef } from 'react';
import ApiService from '../utils/ApiService';
import { storage, auth } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { optimizeImage } from '../utils/imageOptimizer';

const ElectionResultForm = ({ election, ballotBoxId, ballotNumber, onClose, onSuccess }) => {
  // Safety check: if election is missing, show error and return early
  if (!election) {
    return (
      <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Hata</h2>
            <p className="text-gray-600 mb-4">Seçim bilgisi bulunamadı. Lütfen tekrar deneyin.</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>
      </div>
    );
  }

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [existingResult, setExistingResult] = useState(null);
  const [ballotBox, setBallotBox] = useState(null);
  const messageRef = useRef(null);
  
  // Form data structure for new election system
  const [formData, setFormData] = useState({
    election_id: election?.id || null,
    ballot_box_id: ballotBoxId,
    ballot_number: ballotNumber,
    // Location info (auto-filled, read-only)
    region_name: '',
    district_name: '',
    town_name: '',
    neighborhood_name: '',
    village_name: '',
    // Vote counts
    total_voters: '', // From ballot box voter_count
    used_votes: '',
    invalid_votes: '',
    valid_votes: '',
    // Votes by election type
    cb_votes: {}, // For general election: CB candidate votes
    mv_votes: {}, // For general election: MV votes by party and independent
    mayor_votes: {}, // For local election: Mayor candidate votes
    provincial_assembly_votes: {}, // For local election: Provincial assembly votes
    municipal_council_votes: {}, // For local election: Municipal council votes
    referendum_votes: { 'Evet': 0, 'Hayır': 0 }, // For referendum
    // Legacy fields (for backward compatibility)
    party_votes: {},
    candidate_votes: {},
    // Photos and notes
    signed_protocol_photo: null,
    objection_protocol_photo: null,
    has_objection: false,
    objection_reason: '',
    notes: ''
  });

  const [uploadingPhotos, setUploadingPhotos] = useState({
    signed: false,
    objection: false
  });

  // Fetch ballot box information
  useEffect(() => {
    if (ballotBoxId) {
      fetchBallotBoxInfo();
    }
  }, [ballotBoxId]);

  // Fetch existing result
  useEffect(() => {
    if (election?.id && ballotBoxId) {
    fetchExistingResult();
    }
  }, [election?.id, ballotBoxId]);

  // Scroll to message when error or warning occurs
  useEffect(() => {
    if (message && (messageType === 'error' || messageType === 'warning') && messageRef.current) {
      setTimeout(() => {
        messageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [message, messageType]);

  const fetchBallotBoxInfo = async () => {
    try {
      const ballotBoxData = await ApiService.getBallotBoxById(ballotBoxId);
      if (ballotBoxData) {
        setBallotBox(ballotBoxData);
        
        // Önce sandığın kendi bilgilerine bak
        let regionName = ballotBoxData.region_name || '';
        let districtName = ballotBoxData.district_name || '';
        let townName = ballotBoxData.town_name || '';
        let neighborhoodName = ballotBoxData.neighborhood_name || '';
        let villageName = ballotBoxData.village_name || '';
        
        // Eğer sandıkta konum bilgisi yoksa, başmüşahit bilgilerine bak
        if (!districtName && !neighborhoodName && !villageName) {
          try {
            const observers = await ApiService.getBallotBoxObservers();
            const chiefObserver = observers.find(observer => 
              (observer.ballot_box_id === parseInt(ballotBoxId) || observer.ballot_box_id === ballotBoxId) &&
              (observer.is_chief_observer === true || observer.is_chief_observer === 1)
            );
            
            if (chiefObserver) {
              if (!regionName) regionName = chiefObserver.region_name || '';
              if (!districtName) districtName = chiefObserver.district_name || '';
              if (!townName) townName = chiefObserver.town_name || '';
              if (!neighborhoodName) neighborhoodName = chiefObserver.neighborhood_name || '';
              if (!villageName) villageName = chiefObserver.village_name || '';
            }
          } catch (observerError) {
            console.error('Error fetching observers:', observerError);
          }
        }
        
        // Auto-fill location info and voter count
        setFormData(prev => ({
          ...prev,
          region_name: regionName,
          district_name: districtName,
          town_name: townName,
          neighborhood_name: neighborhoodName,
          village_name: villageName,
          total_voters: ballotBoxData.voter_count || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching ballot box info:', error);
    }
  };

  const fetchExistingResult = async () => {
    if (!election?.id || !ballotBoxId) return;
    
    try {
      const results = await ApiService.getElectionResults(election.id, ballotBoxId);
      if (results && results.length > 0) {
        const result = results[0];
        setExistingResult(result);
        
        setFormData(prev => ({
          ...prev,
          // Location info (should already be set from ballot box, but preserve if exists in result)
          region_name: result.region_name || prev.region_name || '',
          district_name: result.district_name || prev.district_name || '',
          town_name: result.town_name || prev.town_name || '',
          neighborhood_name: result.neighborhood_name || prev.neighborhood_name || '',
          village_name: result.village_name || prev.village_name || '',
          total_voters: result.total_voters || prev.total_voters || '',
          // Vote counts
          used_votes: result.used_votes || '',
          invalid_votes: result.invalid_votes || '',
          valid_votes: result.valid_votes || '',
          // New election system votes
          cb_votes: result.cb_votes || {},
          mv_votes: result.mv_votes || {},
          mayor_votes: result.mayor_votes || {},
          provincial_assembly_votes: result.provincial_assembly_votes || {},
          municipal_council_votes: result.municipal_council_votes || {},
          referendum_votes: result.referendum_votes || { 'Evet': 0, 'Hayır': 0 },
          // Legacy fields (for backward compatibility)
          party_votes: result.party_votes || {},
          candidate_votes: result.candidate_votes || {},
          // Photos and notes
          signed_protocol_photo: result.signed_protocol_photo || null,
          objection_protocol_photo: result.objection_protocol_photo || null,
          has_objection: result.has_objection || false,
          objection_reason: result.objection_reason || '',
          notes: result.notes || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching existing result:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Vote change handlers for new election system
  const handleCbVoteChange = (candidateName, value) => {
    setFormData(prev => ({
      ...prev,
      cb_votes: {
        ...prev.cb_votes,
        [candidateName]: parseInt(value) || 0
      }
    }));
  };

  // MV oyları parti bazlı (aday bazlı değil)
  const handleMvVoteChange = (partyName, value) => {
    setFormData(prev => ({
      ...prev,
      mv_votes: {
        ...prev.mv_votes,
        [partyName]: parseInt(value) || 0
      }
    }));
  };

  // Belediye Başkanı: Parti bazlı (bağımsızlar hariç)
  const handleMayorVoteChange = (partyOrCandidate, value) => {
    setFormData(prev => ({
      ...prev,
      mayor_votes: {
        ...prev.mayor_votes,
        [partyOrCandidate]: parseInt(value) || 0
      }
    }));
  };

  // İl Genel Meclisi oyları parti bazlı
  const handleProvincialAssemblyVoteChange = (partyName, value) => {
    setFormData(prev => ({
      ...prev,
      provincial_assembly_votes: {
        ...prev.provincial_assembly_votes,
        [partyName]: parseInt(value) || 0
      }
    }));
  };

  // Belediye Meclisi oyları parti bazlı
  const handleMunicipalCouncilVoteChange = (partyName, value) => {
    setFormData(prev => ({
      ...prev,
      municipal_council_votes: {
        ...prev.municipal_council_votes,
        [partyName]: parseInt(value) || 0
      }
    }));
  };

  const handleReferendumVoteChange = (option, value) => {
    setFormData(prev => ({
      ...prev,
      referendum_votes: {
        ...prev.referendum_votes,
        [option]: parseInt(value) || 0
      }
    }));
  };

  // Legacy handlers (for backward compatibility)
  const handlePartyVoteChange = (partyName, value) => {
    setFormData(prev => ({
      ...prev,
      party_votes: {
        ...prev.party_votes,
        [partyName]: parseInt(value) || 0
      }
    }));
  };

  const handleCandidateVoteChange = (candidateName, value) => {
    setFormData(prev => ({
      ...prev,
      candidate_votes: {
        ...prev.candidate_votes,
        [candidateName]: parseInt(value) || 0
      }
    }));
  };

  const handlePhotoUpload = async (file, type) => {
    if (!file) return;
    
    if (!ballotBoxId) {
      setMessage('Sandık bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
      setMessageType('error');
      return;
    }

    try {
      setUploadingPhotos(prev => ({ ...prev, [type]: true }));
      
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        const savedUser = localStorage.getItem('user');
        const userRole = localStorage.getItem('userRole');
        
        if (userRole === 'chief_observer' && savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            const username = userData.username || userData.ballotNumber;
            const email = `${username}@ilsekreterlik.local`;
            
            const memberUsersResponse = await ApiService.getMemberUsers();
            const memberUsers = memberUsersResponse.users || memberUsersResponse || [];
            const memberUser = memberUsers.find(u => 
              u.userType === 'musahit' && (u.username === username || u.username === userData.ballotNumber)
            );
            
            if (memberUser) {
              let storedPassword = memberUser.password || '';
              try {
                if (storedPassword && storedPassword.startsWith('U2FsdGVkX1')) {
                  const { decryptData } = await import('../utils/crypto');
                  storedPassword = decryptData(storedPassword);
                }
              } catch (e) {
                console.error('[DEBUG] Decrypt error:', e);
              }
              
              const password = storedPassword || userData.tc || username;
              await signInWithEmailAndPassword(auth, email, password);
            } else {
              const password = userData.tc || username;
              await signInWithEmailAndPassword(auth, email, password);
            }
          } catch (reauthError) {
            console.error('[DEBUG] Re-authentication error:', reauthError);
            setMessage('Firebase kimlik doğrulama hatası. Lütfen tekrar giriş yapın.');
            setMessageType('error');
            setUploadingPhotos(prev => ({ ...prev, [type]: false }));
            return;
          }
        } else {
          setMessage('Kullanıcı bilgileri bulunamadı. Lütfen tekrar giriş yapın.');
          setMessageType('error');
          setUploadingPhotos(prev => ({ ...prev, [type]: false }));
          return;
        }
      }
      
      // Optimize image before upload (max 2MB, quality 0.85)
      const optimizedFile = await optimizeImage(file, {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85,
        maxSizeMB: 2
      });
      
      const timestamp = Date.now();
      const fileName = `election_results/${election.id}/${ballotBoxId}/${type}_${timestamp}_${optimizedFile.name}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, optimizedFile);
      const downloadURL = await getDownloadURL(storageRef);
      
      setFormData(prev => ({
        ...prev,
        [type === 'signed' ? 'signed_protocol_photo' : 'objection_protocol_photo']: downloadURL
      }));
      
      setMessage('Fotoğraf başarıyla yüklendi');
      setMessageType('success');
    } catch (error) {
      console.error('Photo upload error:', error);
      setMessage('Fotoğraf yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
      setMessageType('error');
    } finally {
      setUploadingPhotos(prev => ({ ...prev, [type]: false }));
    }
  };

  // Check if ballot box is in a village (köy)
  const isVillage = () => {
    return !!(formData.village_name && formData.village_name.trim() !== '');
  };

  // Calculate valid votes for each category separately
  const calculateValidVotesByCategory = () => {
    if (!election?.type) return {};
    
    const result = {};
    
    if (election.type === 'genel') {
      // Genel Seçim: CB ve MV ayrı ayrı
      result.cb = Object.values(formData.cb_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
      result.mv = Object.values(formData.mv_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    } else if (election.type === 'yerel') {
      // Yerel Seçim: Köyde sadece İl Genel Meclisi, değilse hepsi
      const isVil = isVillage();
      
      if (!isVil) {
        // Köyde değil: Belediye Başkanı + Belediye Meclisi + İl Genel Meclisi
        result.mayor = Object.values(formData.mayor_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
        result.municipal_council = Object.values(formData.municipal_council_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
        result.provincial_assembly = Object.values(formData.provincial_assembly_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
      } else {
        // Köyde: Sadece İl Genel Meclisi
        result.provincial_assembly = Object.values(formData.provincial_assembly_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
        result.mayor = 0;
        result.municipal_council = 0;
      }
    } else if (election.type === 'referandum') {
      // Referandum: Evet + Hayır
      result.referendum = Object.values(formData.referendum_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    }
    
    return result;
  };

  // Calculate total valid votes (sum of all categories)
  const calculateTotalValidVotes = () => {
    const byCategory = calculateValidVotesByCategory();
    return Object.values(byCategory).reduce((sum, val) => sum + val, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Prevent double submission
    if (saving) {
      return;
    }
    
    setSaving(true);
    setMessage('');

    if (!ballotBoxId) {
      setMessage('Sandık bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
      setMessageType('error');
      setSaving(false);
      return;
    }

    // Validasyon: Seçim türüne göre
    if (!election?.type) {
      setMessage('Seçim türü bulunamadı. Lütfen tekrar deneyin.');
      setMessageType('error');
      setSaving(false);
      return;
    }

    // Seçim durumu kontrolü
    if (election.status === 'closed') {
      setMessage('Bu seçim kapalı. Sonuç girişi yapılamaz.');
      setMessageType('error');
      setSaving(false);
      return;
    }

    if (election.status !== 'active') {
      setMessage('Bu seçim henüz aktif değil. Sadece aktif seçimlerde sonuç girişi yapılabilir.');
      setMessageType('error');
      setSaving(false);
      return;
    }
    
    // Her kategori için geçerli oy sayısını ayrı ayrı kontrol et
    const validVotesByCategory = calculateValidVotesByCategory();
    const enteredValidVotes = parseInt(formData.valid_votes) || 0;
    const totalCalculatedValidVotes = calculateTotalValidVotes();
    
    if (election.type === 'genel') {
      // Genel seçim: CB ve MV oyları ayrı ayrı kontrol edilir
      // Her seçmen hem CB hem MV için oy kullanır, bu yüzden her ikisi de geçerli oy sayısına eşit olmalı
      const cbTotal = validVotesByCategory.cb || 0;
      const mvTotal = validVotesByCategory.mv || 0;
      
      if (cbTotal !== enteredValidVotes) {
        setMessage(`Cumhurbaşkanı oyları toplamı (${cbTotal}) geçerli oy sayısı (${enteredValidVotes}) ile eşleşmiyor`);
      setMessageType('error');
      setSaving(false);
      return;
      }
      
      if (mvTotal !== enteredValidVotes) {
        setMessage(`Milletvekili oyları toplamı (${mvTotal}) geçerli oy sayısı (${enteredValidVotes}) ile eşleşmiyor`);
        setMessageType('error');
        setSaving(false);
        return;
      }
    } else if (election.type === 'yerel') {
      // Yerel seçim: Her kategori için ayrı ayrı kontrol
      const isVil = isVillage();
      const errors = [];
      
      if (!isVil) {
        // Köyde değil: Belediye Başkanı + Belediye Meclisi + İl Genel Meclisi
        if (validVotesByCategory.mayor !== enteredValidVotes) {
          errors.push(`Belediye Başkanı oyları (${validVotesByCategory.mayor}) geçerli oy sayısı (${enteredValidVotes}) ile eşleşmiyor`);
        }
        if (validVotesByCategory.municipal_council !== enteredValidVotes) {
          errors.push(`Belediye Meclisi oyları (${validVotesByCategory.municipal_council}) geçerli oy sayısı (${enteredValidVotes}) ile eşleşmiyor`);
        }
        if (validVotesByCategory.provincial_assembly !== enteredValidVotes) {
          errors.push(`İl Genel Meclisi oyları (${validVotesByCategory.provincial_assembly}) geçerli oy sayısı (${enteredValidVotes}) ile eşleşmiyor`);
        }
      } else {
        // Köyde: Sadece İl Genel Meclisi
        if (validVotesByCategory.provincial_assembly !== enteredValidVotes) {
          errors.push(`İl Genel Meclisi oyları (${validVotesByCategory.provincial_assembly}) geçerli oy sayısı (${enteredValidVotes}) ile eşleşmiyor`);
        }
        // Köyde Belediye Başkanı ve Belediye Meclisi oyları olmamalı
        if (validVotesByCategory.mayor > 0) {
          errors.push(`Köyde Belediye Başkanı oyu verilemez. Girilen oy: ${validVotesByCategory.mayor}`);
        }
        if (validVotesByCategory.municipal_council > 0) {
          errors.push(`Köyde Belediye Meclisi oyu verilemez. Girilen oy: ${validVotesByCategory.municipal_council}`);
        }
      }
      
      if (errors.length > 0) {
        setMessage(errors.join('; '));
        setMessageType('error');
        setSaving(false);
        return;
      }
    } else if (election.type === 'referandum') {
      // Referandum: Normal validasyon
      if (totalCalculatedValidVotes !== enteredValidVotes) {
        setMessage(`Geçerli oy sayısı (${enteredValidVotes}) aday oyları toplamı (${totalCalculatedValidVotes}) ile eşleşmiyor`);
        setMessageType('error');
        setSaving(false);
        return;
      }
    }

    const usedVotes = parseInt(formData.used_votes) || 0;
    const invalidVotes = parseInt(formData.invalid_votes) || 0;
    const validVotes = parseInt(formData.valid_votes) || 0;
    const totalVoters = parseInt(formData.total_voters) || 0;

    // Seçmen sayısından fazla oy kontrolü
    if (totalVoters > 0 && usedVotes > totalVoters) {
      setMessage(`Oy kullanan seçmen sayısı (${usedVotes}) toplam seçmen sayısından (${totalVoters}) fazla olamaz`);
      setMessageType('error');
      setSaving(false);
      return;
    }

    if (usedVotes !== (invalidVotes + validVotes)) {
      setMessage(`Kullanılan oy (${usedVotes}) geçersiz oy (${invalidVotes}) + geçerli oy (${validVotes}) toplamı ile eşleşmiyor`);
      setMessageType('error');
      setSaving(false);
      return;
    }

    // Check election date - allow result entry only on election day or after (with 7 days grace period)
    if (election?.date) {
      const electionDate = new Date(election.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      electionDate.setHours(0, 0, 0, 0);
      
      // Allow entry 1 day before election (for preparation) and up to 7 days after
      const daysBefore = 1;
      const daysAfter = 7;
      const minDate = new Date(electionDate);
      minDate.setDate(minDate.getDate() - daysBefore);
      const maxDate = new Date(electionDate);
      maxDate.setDate(maxDate.getDate() + daysAfter);
      
      const userRole = localStorage.getItem('userRole');
      const isAdmin = userRole === 'admin';
      
      if (today < minDate && !isAdmin) {
        setMessage(`Seçim sonucu girişi seçim tarihinden ${daysBefore} gün önce başlayabilir. Seçim tarihi: ${new Date(election.date).toLocaleDateString('tr-TR')}`);
        setMessageType('error');
        setSaving(false);
        return;
      }
      if (today > maxDate && !isAdmin) {
        setMessage(`Seçim sonucu girişi seçim tarihinden sonra ${daysAfter} gün içinde yapılabilir. Sadece admin daha sonra giriş yapabilir.`);
        setMessageType('error');
        setSaving(false);
        return;
      }
    }

    try {
      const submitData = {
        ...formData,
        ballot_box_id: ballotBoxId,
        ballot_number: ballotNumber || formData.ballot_number
      };
      
      // Check if protocol photo is missing
      const hasProtocolPhoto = !!(submitData.signed_protocol_photo || submitData.signedProtocolPhoto);
      
      if (existingResult) {
        await ApiService.updateElectionResult(existingResult.id, submitData);
        // Anlık uyarı göster
        if (!hasProtocolPhoto) {
          setMessage('Seçim sonucu başarıyla güncellendi. ⚠️ Seçim tutanağını yükleyiniz.');
          setMessageType('warning');
        } else {
        setMessage('Seçim sonucu başarıyla güncellendi');
          setMessageType('success');
        }
      } else {
        await ApiService.createElectionResult(submitData);
        // Anlık uyarı göster
        if (!hasProtocolPhoto) {
          setMessage('Seçim sonucu başarıyla kaydedildi. ⚠️ Seçim tutanağını yükleyiniz.');
          setMessageType('warning');
        } else {
        setMessage('Seçim sonucu başarıyla kaydedildi');
          setMessageType('success');
        }
      }
      
      // Mesaj gösterildikten sonra kısa bir süre bekle ve sonra onSuccess çağır
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, hasProtocolPhoto ? 1500 : 2500);
    } catch (error) {
      console.error('Error saving election result:', error);
      setMessage(error.message || 'Seçim sonucu kaydedilirken hata oluştu');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };


  const getTypeLabel = () => {
    if (!election?.type) return 'Seçim';
    
    const labels = {
      'yerel': 'Yerel Seçim',
      'genel': 'Genel Seçim',
      'referandum': 'Referandum',
      'cb': 'Cumhurbaşkanlığı Seçimi' // Legacy
    };
    return labels[election.type] || election.type;
  };

  const getTypeColor = () => {
    if (!election?.type) return 'from-gray-500 to-gray-600';
    
    const colors = {
      'yerel': 'from-blue-500 to-blue-600',
      'genel': 'from-purple-500 to-purple-600',
      'referandum': 'from-green-500 to-green-600',
      'cb': 'from-indigo-500 to-indigo-600' // Legacy
    };
    return colors[election.type] || 'from-gray-500 to-gray-600';
  };

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ height: '100vh', overflow: 'hidden' }}>
      <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full h-[95vh] overflow-hidden flex flex-col">
        {/* Tutanak Başlığı - Minimal ve Kurumsal */}
        <div className="bg-white border-b-2 border-gray-300 px-6 py-4">
          <div className="flex items-center justify-between">
                <div>
              <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">Seçim Sonuç Tutanağı</h1>
              <p className="text-sm text-gray-600 mt-1">{election.name} - {getTypeLabel()}</p>
                </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Save Button at Top - Large and Prominent */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg border border-gray-300 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              form="election-result-form"
              disabled={saving}
              onClick={(e) => {
                if (saving) {
                  e.preventDefault();
                  return;
                }
                setSaving(true);
                handleSubmit(e);
              }}
              className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold text-lg rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Kaydediliyor...</span>
                </>
              ) : (
                <span>{existingResult ? 'Güncelle' : 'Kaydet'}</span>
              )}
            </button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 relative" style={{ maxHeight: 'calc(95vh - 200px)' }}>
          <form id="election-result-form" onSubmit={handleSubmit} className="p-6 space-y-6 pb-6">
            {/* Message Alert */}
            {message && (
              <div 
                ref={messageRef}
                className={`p-4 rounded-lg border-l-4 shadow-md ${
                messageType === 'success' 
                    ? 'bg-green-50 border-green-500 text-green-800' 
                    : messageType === 'warning'
                    ? 'bg-amber-50 border-amber-500 text-amber-800'
                    : 'bg-red-50 border-red-500 text-red-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  {messageType === 'warning' && (
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.732 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  {messageType === 'error' && (
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {messageType === 'success' && (
                    <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <p className="text-sm font-medium flex-1">{message}</p>
                </div>
              </div>
            )}

            {/* Sandık Bilgileri (Otomatik, Düzenlenemez) */}
            <div className="bg-white border border-gray-300 rounded p-5">
              <h2 className="text-base font-bold text-gray-900 uppercase mb-4 border-b border-gray-300 pb-2">
                Sandık Bilgileri
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">İl</label>
                  <div className="text-gray-900 font-medium">{formData.region_name || '-'}</div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">İlçe</label>
                  <div className="text-gray-900 font-medium">{formData.district_name || '-'}</div>
                </div>
                {formData.town_name && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Belde</label>
                    <div className="text-gray-900 font-medium">{formData.town_name}</div>
                  </div>
                )}
                {formData.neighborhood_name && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mahalle</label>
                    <div className="text-gray-900 font-medium">{formData.neighborhood_name}</div>
                  </div>
                )}
                {formData.village_name && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Köy</label>
                    <div className="text-gray-900 font-medium">{formData.village_name}</div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Sandık No</label>
                  <div className="text-gray-900 font-medium">{ballotNumber || '-'}</div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Toplam Seçmen</label>
                  <div className="text-gray-900 font-medium">{formData.total_voters || '-'}</div>
                </div>
              </div>
            </div>

            {/* Oy Sayıları */}
            <div className="bg-white border border-gray-300 rounded p-5">
              <h2 className="text-base font-bold text-gray-900 uppercase mb-4 border-b border-gray-300 pb-2">
                Oy Sayıları
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Oy Kullanan Seçmen Sayısı *
                  </label>
                  <input
                    type="number"
                    name="used_votes"
                    value={formData.used_votes}
                    onChange={handleInputChange}
                    min="0"
                    inputMode="numeric"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base"
                    required
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Geçersiz Oy Sayısı *
                  </label>
                  <input
                    type="number"
                    name="invalid_votes"
                    value={formData.invalid_votes}
                    onChange={handleInputChange}
                    min="0"
                    inputMode="numeric"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base"
                    required
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Geçerli Oy Sayısı *
                  </label>
                  <input
                    type="number"
                    name="valid_votes"
                    value={formData.valid_votes}
                    onChange={handleInputChange}
                    min="0"
                    inputMode="numeric"
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base"
                    required
                    placeholder="0"
                  />
                  {/* Her kategori için geçerli oy sayısı gösterimi */}
                  {(() => {
                    const validVotesByCategory = calculateValidVotesByCategory();
                    const isVil = isVillage();
                    
                    if (election?.type === 'genel') {
                      return (
                        <div className="mt-2 space-y-1 text-xs text-gray-600">
                          <div>CB oyları toplamı: <span className="font-semibold">{validVotesByCategory.cb || 0}</span></div>
                          <div>MV oyları toplamı: <span className="font-semibold">{validVotesByCategory.mv || 0}</span></div>
                          <div className="text-gray-500 italic">Her kategori için geçerli oy sayısı ayrı ayrı kontrol edilir</div>
                        </div>
                      );
                    } else if (election?.type === 'yerel') {
                      if (isVil) {
                        return (
                          <div className="mt-2 space-y-1 text-xs text-gray-600">
                            <div className="text-amber-600 font-semibold">⚠️ Köy: Sadece İl Genel Meclisi için oy kullanılır</div>
                            <div>İl Genel Meclisi oyları toplamı: <span className="font-semibold">{validVotesByCategory.provincial_assembly || 0}</span></div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="mt-2 space-y-1 text-xs text-gray-600">
                            <div>Belediye Başkanı oyları toplamı: <span className="font-semibold">{validVotesByCategory.mayor || 0}</span></div>
                            <div>Belediye Meclisi oyları toplamı: <span className="font-semibold">{validVotesByCategory.municipal_council || 0}</span></div>
                            <div>İl Genel Meclisi oyları toplamı: <span className="font-semibold">{validVotesByCategory.provincial_assembly || 0}</span></div>
                            <div className="text-gray-500 italic">Her kategori için geçerli oy sayısı ayrı ayrı kontrol edilir</div>
                          </div>
                        );
                      }
                    } else if (election?.type === 'referandum') {
                      return (
                        <div className="mt-2 space-y-1 text-xs text-gray-600">
                          <div>Referandum oyları toplamı: <span className="font-semibold">{validVotesByCategory.referendum || 0}</span></div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>

            {/* Genel Seçim: CB ve MV Oyları */}
            {election?.type === 'genel' && (
              <div className="space-y-5">
                {/* Cumhurbaşkanı Oyları */}
                {election.cb_candidates && election.cb_candidates.length > 0 && (
                  <div className="bg-white border border-gray-300 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 uppercase mb-4 border-b border-gray-300 pb-2">
                      Cumhurbaşkanı Adayları ve Aldıkları Oy Sayıları
                    </h2>
                    <div className="space-y-2">
                      {election.cb_candidates.map((candidate) => (
                        <div key={candidate} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900">
                            {candidate}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.cb_votes[candidate] || ''}
                            onChange={(e) => handleCbVoteChange(candidate, e.target.value)}
                            inputMode="numeric"
                            className="w-32 px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                            placeholder="0"
                          />
                        </div>
                      ))}
                      {/* Bağımsız CB Adayları */}
                      {election.independent_cb_candidates && election.independent_cb_candidates.length > 0 && (
                        <>
                          {election.independent_cb_candidates.map((candidate) => (
                            <div key={`ind_cb_${candidate}`} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                              <label className="flex-1 text-sm font-medium text-gray-900">
                                {candidate} <span className="text-xs text-gray-500 font-normal">(Bağımsız)</span>
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={formData.cb_votes[candidate] || ''}
                                onChange={(e) => handleCbVoteChange(candidate, e.target.value)}
                                inputMode="numeric"
                                className="w-32 px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                                placeholder="0"
                              />
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Milletvekili Oyları (Parti Bazlı) */}
                {election.parties && election.parties.length > 0 && (
                  <div className="bg-white border border-gray-300 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 uppercase mb-4 border-b border-gray-300 pb-2">
                      Milletvekili Parti Oyları
                    </h2>
                    <div className="space-y-2">
                      {election.parties.map((party) => (
                        <div key={party.name || party} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900">
                            {party.name || party}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.mv_votes[party.name || party] || ''}
                            onChange={(e) => handleMvVoteChange(party.name || party, e.target.value)}
                            inputMode="numeric"
                            className="w-32 px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                            placeholder="0"
                          />
                        </div>
                      ))}
                      {/* Bağımsız MV Adayları */}
                      {election.independent_mv_candidates && election.independent_mv_candidates.length > 0 && (
                        <>
                          {election.independent_mv_candidates.map((candidate) => (
                            <div key={`ind_mv_${candidate}`} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                              <label className="flex-1 text-sm font-medium text-gray-900">
                                {candidate} <span className="text-xs text-gray-500 font-normal">(Bağımsız)</span>
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={formData.mv_votes[candidate] || ''}
                                onChange={(e) => handleMvVoteChange(candidate, e.target.value)}
                                inputMode="numeric"
                                className="w-32 px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                                placeholder="0"
                              />
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Yerel Seçim: Belediye Başkanı, İl Genel Meclisi, Belediye Meclisi */}
            {election?.type === 'yerel' && (
              <div className="space-y-5">
                {/* Köy kontrolü bilgilendirmesi */}
                {isVillage() && (
                  <div className="bg-amber-50 border-2 border-amber-300 rounded p-4">
                    <p className="text-sm font-semibold text-amber-800">
                      ⚠️ Köy: Bu sandık köyde bulunmaktadır. Sadece İl Genel Meclisi için oy kullanılabilir.
                  </p>
                </div>
                )}

                {/* Debug: Show if no local election data */}
                {(!election.mayor_parties || !Array.isArray(election.mayor_parties) || election.mayor_parties.length === 0) &&
                 (!election.mayor_candidates || !Array.isArray(election.mayor_candidates) || election.mayor_candidates.length === 0) &&
                 (!election.provincial_assembly_parties || !Array.isArray(election.provincial_assembly_parties) || election.provincial_assembly_parties.length === 0) &&
                 (!election.municipal_council_parties || !Array.isArray(election.municipal_council_parties) || election.municipal_council_parties.length === 0) && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                    <p className="text-sm text-yellow-800">
                      ⚠️ Yerel seçim için aday/parti bilgisi bulunamadı. Lütfen seçim ayarlarını kontrol edin.
                    </p>
              </div>
                )}

                {/* Belediye Başkanı Parti Oyları - Köyde devre dışı */}
                {election.mayor_parties && Array.isArray(election.mayor_parties) && election.mayor_parties.length > 0 && (
                  <div className={`bg-white border border-gray-300 rounded p-5 ${isVillage() ? 'opacity-50' : ''}`}>
                    <h2 className="text-base font-bold text-gray-900 uppercase mb-4 border-b border-gray-300 pb-2">
                      Belediye Başkanı Parti Oyları
                      {isVillage() && <span className="ml-2 text-xs font-normal text-amber-600">(Köyde kullanılmaz)</span>}
                    </h2>
                    <div className="space-y-2">
                      {election.mayor_parties.map((party) => {
                        const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
                        return (
                        <div key={partyName} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900">
                            {partyName}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.mayor_votes[partyName] || ''}
                            onChange={(e) => handleMayorVoteChange(partyName, e.target.value)}
                            inputMode="numeric"
                            disabled={isVillage()}
                            className={`w-32 px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right ${isVillage() ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                            placeholder="0"
                          />
            </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bağımsız Belediye Başkanı Adayları - Köyde devre dışı */}
                {election.mayor_candidates && Array.isArray(election.mayor_candidates) && election.mayor_candidates.length > 0 && (
                  <div className={`bg-white border border-gray-300 rounded p-5 ${isVillage() ? 'opacity-50' : ''}`}>
                    <h2 className="text-base font-bold text-gray-900 uppercase mb-4 border-b border-gray-300 pb-2">
                      Bağımsız Belediye Başkanı Adayları ve Aldıkları Oy Sayıları
                      {isVillage() && <span className="ml-2 text-xs font-normal text-amber-600">(Köyde kullanılmaz)</span>}
                    </h2>
                    <div className="space-y-2">
                      {election.mayor_candidates.map((candidate) => (
                        <div key={candidate} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900">
                            {candidate} <span className="text-xs text-gray-500 font-normal">(Bağımsız)</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.mayor_votes[candidate] || ''}
                            onChange={(e) => handleMayorVoteChange(candidate, e.target.value)}
                            inputMode="numeric"
                            disabled={isVillage()}
                            className={`w-32 px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right ${isVillage() ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* İl Genel Meclisi Üyesi Oyları (Parti Bazlı) */}
                {election.provincial_assembly_parties && Array.isArray(election.provincial_assembly_parties) && election.provincial_assembly_parties.length > 0 && (
                  <div className="bg-white border border-gray-300 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 uppercase mb-4 border-b border-gray-300 pb-2">
                      İl Genel Meclisi Parti Oyları
                    </h2>
                    <div className="space-y-2">
                      {election.provincial_assembly_parties.map((party) => {
                        const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
                        return (
                        <div key={partyName} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900">
                            {partyName}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.provincial_assembly_votes[partyName] || ''}
                            onChange={(e) => handleProvincialAssemblyVoteChange(partyName, e.target.value)}
                            inputMode="numeric"
                            className="w-32 px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                            placeholder="0"
                          />
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Belediye Meclis Üyesi Oyları (Parti Bazlı) - Köyde devre dışı */}
                {election.municipal_council_parties && Array.isArray(election.municipal_council_parties) && election.municipal_council_parties.length > 0 && (
                  <div className={`bg-white border border-gray-300 rounded p-5 ${isVillage() ? 'opacity-50' : ''}`}>
                    <h2 className="text-base font-bold text-gray-900 uppercase mb-4 border-b border-gray-300 pb-2">
                      Belediye Meclis Parti Oyları
                      {isVillage() && <span className="ml-2 text-xs font-normal text-amber-600">(Köyde kullanılmaz)</span>}
                    </h2>
                    <div className="space-y-2">
                      {election.municipal_council_parties.map((party) => {
                        const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
                        return (
                        <div key={partyName} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900">
                            {partyName}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.municipal_council_votes[partyName] || ''}
                            onChange={(e) => handleMunicipalCouncilVoteChange(partyName, e.target.value)}
                            inputMode="numeric"
                            disabled={isVillage()}
                            className={`w-32 px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right ${isVillage() ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                            placeholder="0"
                          />
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Referandum: Evet/Hayır */}
            {election?.type === 'referandum' && (
              <div className="bg-white border border-gray-300 rounded p-5">
                <h2 className="text-base font-bold text-gray-900 uppercase mb-4 border-b border-gray-300 pb-2">
                  Referandum Oyları
                </h2>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b border-gray-200">
                    <label className="flex-1 text-sm font-medium text-gray-900">
                      Evet
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.referendum_votes['Evet'] || 0}
                      onChange={(e) => handleReferendumVoteChange('Evet', e.target.value)}
                      inputMode="numeric"
                      className="w-32 px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                      placeholder="0"
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <label className="flex-1 text-sm font-medium text-gray-900">
                      Hayır
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.referendum_votes['Hayır'] || 0}
                      onChange={(e) => handleReferendumVoteChange('Hayır', e.target.value)}
                      inputMode="numeric"
                      className="w-32 px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Legacy Support: Eski seçim türleri için geriye dönük uyumluluk */}
            {(election?.type === 'yerel' || election?.type === 'genel') && election?.parties && Array.isArray(election.parties) && election.parties.length > 0 && typeof election.parties[0] === 'string' && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
                  Parti Oyları (Eski Format)
                </h3>
                <div className="grid gap-3">
                  {election.parties.map((party, index) => (
                    <div 
                      key={party} 
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700"
                      style={{ animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both` }}
                    >
                      <label className="flex-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {party}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.party_votes[party] || ''}
                        onChange={(e) => handlePartyVoteChange(party, e.target.value)}
                        className="w-full sm:w-32 px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100 transition-all duration-200 font-medium"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {election?.type === 'cb' && election?.candidates && Array.isArray(election.candidates) && election.candidates.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full"></div>
                  Aday Oyları (Eski Format)
                </h3>
                <div className="grid gap-3">
                  {election.candidates.map((candidate, index) => (
                    <div 
                      key={candidate} 
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700"
                      style={{ animation: `fadeInUp 0.3s ease-out ${index * 0.05}s both` }}
                    >
                      <label className="flex-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {candidate}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.candidate_votes[candidate] || ''}
                        onChange={(e) => handleCandidateVoteChange(candidate, e.target.value)}
                        className="w-full sm:w-32 px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100 transition-all duration-200 font-medium"
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tutanak Fotoğrafları */}
            <div className="bg-white border border-gray-300 rounded p-5">
              <h2 className="text-base font-bold text-gray-900 uppercase mb-4 border-b border-gray-300 pb-2">
                Tutanak Fotoğrafları
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    İmzalı Tutanak Fotoğrafı
                </label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    {uploadingPhotos.signed ? (
                      <div className="flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-indigo-600 mb-2"></div>
                        <span className="text-xs text-gray-600">Yükleniyor...</span>
                      </div>
                    ) : formData.signed_protocol_photo ? (
                      <div className="relative w-full h-full">
                        <img 
                          src={formData.signed_protocol_photo} 
                          alt="İmzalı Tutanak" 
                          className="w-full h-full object-cover rounded"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                          <span className="text-white text-xs font-medium">Yeniden Yükle</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-xs text-gray-600">Fotoğraf Yükle</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) handlePhotoUpload(file, 'signed');
                      }}
                      className="hidden"
                      disabled={uploadingPhotos.signed}
                    />
                  </label>
              </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                  İtiraz Tutanağı (Varsa)
                </label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    {uploadingPhotos.objection ? (
                      <div className="flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-indigo-600 mb-2"></div>
                        <span className="text-xs text-gray-600">Yükleniyor...</span>
                      </div>
                    ) : formData.objection_protocol_photo ? (
                      <div className="relative w-full h-full">
                        <img 
                          src={formData.objection_protocol_photo} 
                          alt="İtiraz Tutanağı" 
                          className="w-full h-full object-cover rounded"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                          <span className="text-white text-xs font-medium">Yeniden Yükle</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-xs text-gray-600">Fotoğraf Yükle</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) handlePhotoUpload(file, 'objection');
                      }}
                      className="hidden"
                      disabled={uploadingPhotos.objection}
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* İtiraz Bilgileri */}
            <div className="bg-white border border-gray-300 rounded p-5">
              <h2 className="text-base font-bold text-gray-900 uppercase mb-4 border-b border-gray-300 pb-2">
                İtiraz Bilgileri
              </h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="has_objection"
                  checked={formData.has_objection}
                  onChange={(e) => {
                    setFormData(prev => ({
                      ...prev,
                      has_objection: e.target.checked,
                      objection_reason: e.target.checked ? prev.objection_reason : ''
                    }));
                  }}
                    className="w-5 h-5 text-red-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-red-500 cursor-pointer"
                />
                  <label htmlFor="has_objection" className="text-sm font-semibold text-gray-900 cursor-pointer">
                  İtiraz Edildi
                </label>
              </div>
              
              {formData.has_objection && (
                  <div className="ml-8">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      İtiraz Sebebi *
                    </label>
                    <textarea
                      name="objection_reason"
                      value={formData.objection_reason}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm resize-none"
                      placeholder="İtiraz sebebini detaylı olarak yazınız..."
                      required={formData.has_objection}
                    />
                </div>
              )}
              </div>
            </div>

            {/* Notlar */}
            <div className="bg-white border border-gray-300 rounded p-5">
              <h2 className="text-base font-bold text-gray-900 uppercase mb-4 border-b border-gray-300 pb-2">
                Notlar
              </h2>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
                placeholder="Varsa ek notlarınızı buraya yazabilirsiniz..."
              />
            </div>

          </form>
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in {
          animation: fadeIn 0.3s ease-out;
        }
        
        .animate-scale-in {
          animation: scaleIn 0.3s ease-out;
        }
        
        .animate-slide-down {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ElectionResultForm;
