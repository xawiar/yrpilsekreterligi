import React, { useState, useEffect, useRef } from 'react';
import ApiService from '../utils/ApiService';
import { storage, auth } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { optimizeImage } from '../utils/imageOptimizer';
import { useAuth } from '../contexts/AuthContext';
import uploadQueue from '../utils/UploadQueue';
import ProtocolOCRService from '../services/ProtocolOCRService';
import { queueOfflineResult } from '../utils/offlineQueue';

const ElectionResultForm = ({ election, ballotBoxId, ballotNumber, onClose, onSuccess }) => {
  const { userRole, user } = useAuth();

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
    // Vote counts (paylaşılan — tek tutanaklı seçimler için)
    total_voters: '',
    used_votes: '',
    invalid_votes: '',
    valid_votes: '',
    // Genel seçim için CB tutanağına özel sayılar
    cb_total_voters: '',
    cb_used_votes: '',
    cb_invalid_votes: '',
    cb_valid_votes: '',
    // Genel seçim için MV tutanağına özel sayılar
    mv_total_voters: '',
    mv_used_votes: '',
    mv_invalid_votes: '',
    mv_valid_votes: '',
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
    signed_protocol_photo: null,      // Tek tutanak (veya genel seçimde CB)
    signed_mv_protocol_photo: null,   // Genel seçim için ayrı MV tutanağı
    objection_protocol_photo: null,
    has_objection: false,
    objection_reason: '',
    notes: ''
  });

  // AI OCR için fotoğrafın data URL'i (Storage'dan geri indirmek yerine
  // doğrudan burada tutulur; CORS'tan kaçınmak için)
  const [signedPhotoDataUrl, setSignedPhotoDataUrl] = useState(null);
  const [signedMvPhotoDataUrl, setSignedMvPhotoDataUrl] = useState(null);

  const [uploadingPhotos, setUploadingPhotos] = useState({
    signed: false,
    mv_signed: false,
    objection: false
  });
  const [uploadProgress, setUploadProgress] = useState({
    signed: 0,
    objection: 0
  });
  const [fillingWithAI, setFillingWithAI] = useState(false);

  // OCR/AI butonları offline iken disabled — Gemini API'ya internet gerek.
  // Form submit zaten offlineQueue ile çalışıyor, ona dokunmuyoruz.
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // Inline validation onay dialog'u — window.confirm() yerine.
  // Pending olduğunda { warnings, onConfirm, onCancel } setter'a yazılır,
  // form altında modal görünür. Köylü kullanıcı için açıklayıcı dilde mesajlar.
  const [pendingValidation, setPendingValidation] = useState(null);

  const confirmWarningsInline = (warnings) =>
    new Promise((resolve) => {
      setPendingValidation({
        warnings,
        onConfirm: () => { setPendingValidation(null); resolve(true); },
        onCancel:  () => { setPendingValidation(null); resolve(false); },
      });
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
          // Vote counts (paylaşılan)
          used_votes: result.used_votes || '',
          invalid_votes: result.invalid_votes || '',
          valid_votes: result.valid_votes || '',
          // CB-specific (genel seçim)
          cb_total_voters: result.cb_total_voters || '',
          cb_used_votes: result.cb_used_votes || '',
          cb_invalid_votes: result.cb_invalid_votes || '',
          cb_valid_votes: result.cb_valid_votes || '',
          // MV-specific (genel seçim)
          mv_total_voters: result.mv_total_voters || '',
          mv_used_votes: result.mv_used_votes || '',
          mv_invalid_votes: result.mv_invalid_votes || '',
          mv_valid_votes: result.mv_valid_votes || '',
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
          signed_mv_protocol_photo: result.signed_mv_protocol_photo || null,
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
        // Use AuthContext instead of localStorage
        if (userRole === 'chief_observer' && user) {
          try {
            const userData = user; // Already parsed from AuthContext
            const username = userData.username || userData.ballotNumber;
            const email = `${username}@ilsekreterlik.local`;
            
            const memberUsersResponse = await ApiService.getMemberUsers();
            const memberUsers = memberUsersResponse.users || memberUsersResponse || [];
            const memberUser = memberUsers.find(u =>
              (u.userType === 'musahit' || !!u.observerId) &&
              (u.username === username || u.username === userData.ballotNumber || u.username === userData.tc)
            );
            
            if (memberUser) {
              let storedPassword = memberUser.password || '';
              try {
                if (storedPassword && storedPassword.startsWith('U2FsdGVkX1')) {
                  const { decryptData } = await import('../utils/crypto');
                  storedPassword = decryptData(storedPassword);
                }
              } catch (e) {
                // Decrypt failed, use raw value
              }
              
              const password = storedPassword || userData.tc || username;
              await signInWithEmailAndPassword(auth, email, password);
            } else {
              const password = userData.tc || username;
              await signInWithEmailAndPassword(auth, email, password);
            }
          } catch (reauthError) {
            console.error('Re-authentication error:', reauthError.message);
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
      
      // Tutanak fotoğrafı için agresif sıkıştırma — 2000 sandık × 500KB = 1GB,
      // 1280×1280 + q=0.75 ile ~200KB → toplam ~400MB (%60 trafik tasarrufu).
      // OCR doğruluğu için 1280px hala yeterli (yazı netliği korunur).
      const isProtocolPhoto = type === 'signed' || type === 'mv_signed' || type === 'objection';
      const optimizedFile = await optimizeImage(file, isProtocolPhoto ? {
        maxWidth: 1280,
        maxHeight: 1280,
        quality: 0.75,
        maxSizeMB: 0.4
      } : {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85,
        maxSizeMB: 2
      });

      // AI OCR için data URL'i hafızada tut (CORS'tan kaçınmak için).
      // Auto-AI için aşağıda da kullanılır → handle scope'una çıkarıyoruz.
      let capturedDataUrl = null;
      if (type === 'signed' || type === 'mv_signed') {
        try {
          capturedDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result !== 'string') {
                reject(new Error('Dosya okunamadı'));
                return;
              }
              resolve(reader.result);
            };
            reader.onerror = () => reject(reader.error || new Error('Dosya okuma hatası'));
            reader.readAsDataURL(optimizedFile);
          });
          if (type === 'signed') setSignedPhotoDataUrl(capturedDataUrl);
          else setSignedMvPhotoDataUrl(capturedDataUrl);
        } catch (_) { /* ignore */ }
      }
      
      const timestamp = Date.now();
      const fileName = `election_results/${election.id}/${ballotBoxId}/${type}_${timestamp}_${optimizedFile.name}`;
      
      // Progress callback
      const onProgress = (progress) => {
        setUploadProgress(prev => ({ ...prev, [type]: progress }));
      };
      
      // Upload queue'ya ekle (retry mechanism ve concurrent limit ile)
      const downloadURL = await uploadQueue.add(
        optimizedFile,
        fileName,
        {
          contentType: optimizedFile.type,
          customMetadata: {
            electionId: String(election.id),
            ballotBoxId: String(ballotBoxId),
            type: type,
            uploadedAt: new Date().toISOString()
          }
        },
        onProgress,
        5 // maxRetries: 5
      );
      
      const fieldName =
        type === 'signed' ? 'signed_protocol_photo' :
        type === 'mv_signed' ? 'signed_mv_protocol_photo' :
        'objection_protocol_photo';
      setFormData(prev => ({ ...prev, [fieldName]: downloadURL }));

      setMessage('Fotoğraf başarıyla yüklendi');
      setMessageType('success');

      // Progress'i sıfırla
      setUploadProgress(prev => ({ ...prev, [type]: 0 }));

      // Auto-AI: tutanak fotoğrafı yüklenir yüklenmez OCR otomatik başlasın.
      // Müşahit "AI butonu nerede?" sorusuyla uğraşmasın.
      // - signed: genel seçimde CB tutanağı, diğerlerinde tek tutanak
      // - mv_signed: genel seçimde MV tutanağı
      // - objection: AI tetiklenmez
      if ((type === 'signed' || type === 'mv_signed') && navigator.onLine) {
        const focus =
          type === 'mv_signed' ? 'mv' :
          (election?.type === 'genel' ? 'cb' : undefined);
        // Promise'i bekleme — paralel başlasın, kullanıcı bu sırada manuel girebilsin
        handleAIFill(focus, { photoUrl: downloadURL, photoDataUrl: capturedDataUrl })
          .catch(err => {
            console.warn('Auto-AI failed, manuel girişe devam edebilirsiniz:', err);
          });
      } else if ((type === 'signed' || type === 'mv_signed') && !navigator.onLine) {
        setMessage('Fotoğraf kaydedildi. Çevrimdışı olduğunuz için AI okuma yapılmadı — manuel doldurun, internet gelince otomatik gönderilir.');
        setMessageType('warning');
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      
      // Hata mesajını kullanıcı dostu hale getir
      let errorMessage = 'Fotoğraf yüklenirken hata oluştu';
      
      if (error.code === 'storage/quota-exceeded') {
        errorMessage = 'Depolama kotası aşıldı. Lütfen daha sonra tekrar deneyin.';
      } else if (error.code === 'storage/unauthenticated' || error.code === 'storage/unauthorized') {
        errorMessage = 'Kimlik doğrulama hatası. Lütfen tekrar giriş yapın.';
      } else if (error.code === 'storage/retry-limit-exceeded') {
        errorMessage = 'Yükleme başarısız oldu. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.';
      } else if (error.message?.includes('network') || error.message?.includes('QUIC')) {
        errorMessage = 'Ağ hatası. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.';
      } else if (error.message) {
        errorMessage = `Fotoğraf yüklenirken hata oluştu: ${error.message}`;
      }
      
      setMessage(errorMessage);
      setMessageType('error');
      
      // Progress'i sıfırla
      setUploadProgress(prev => ({ ...prev, [type]: 0 }));
    } finally {
      setUploadingPhotos(prev => ({ ...prev, [type]: false }));
    }
  };

  // AI ile tutanak doldur
  /**
   * OCR sonuc dogrulama: AI okumasini form tanimlariyla karsilastir
   * @param {Object} data - OCR ile okunan veri
   * @returns {Array<string>} Uyari mesajlari
   */
  const validateOCRResult = (data) => {
    const warnings = [];
    const totalVoters = parseInt(data.total_voters || formData.total_voters) || 0;
    const usedVotes = parseInt(data.used_votes) || 0;
    const invalidVotes = parseInt(data.invalid_votes) || 0;
    const validVotes = parseInt(data.valid_votes) || 0;

    // Toplam oy > secmen sayisi
    if (totalVoters > 0 && usedVotes > totalVoters) {
      warnings.push(`Kullanilan oy (${usedVotes}) secmen sayisindan (${totalVoters}) fazla!`);
    }

    // Negatif deger kontrolu
    if (usedVotes < 0) warnings.push('Kullanilan oy negatif olamaz!');
    if (invalidVotes < 0) warnings.push('Gecersiz oy negatif olamaz!');
    if (validVotes < 0) warnings.push('Gecerli oy negatif olamaz!');

    // Gecerli + gecersiz = kullanilan oy kontrolu
    if (usedVotes > 0 && validVotes > 0 && invalidVotes >= 0) {
      const sum = validVotes + invalidVotes;
      if (sum !== usedVotes) {
        warnings.push(`Gecerli oy (${validVotes}) + Gecersiz oy (${invalidVotes}) = ${sum}, Kullanilan oy (${usedVotes}) ile eslesmiyor!`);
      }
    }

    // Parti/aday oy toplamlarini kontrol et
    const voteCategories = [
      { key: 'cb_votes', label: 'CB oylari' },
      { key: 'mv_votes', label: 'MV oylari' },
      { key: 'mayor_votes', label: 'Belediye baskani oylari' },
      { key: 'provincial_assembly_votes', label: 'Il Genel Meclisi oylari' },
      { key: 'municipal_council_votes', label: 'Belediye Meclisi oylari' },
      { key: 'referendum_votes', label: 'Referandum oylari' },
      { key: 'party_votes', label: 'Parti oylari' },
      { key: 'candidate_votes', label: 'Aday oylari' },
    ];

    for (const { key, label } of voteCategories) {
      const votes = data[key];
      if (votes && typeof votes === 'object') {
        const values = Object.values(votes);
        // Negatif deger kontrolu
        const negatives = values.filter(v => (parseInt(v) || 0) < 0);
        if (negatives.length > 0) {
          warnings.push(`${label} icinde negatif deger var!`);
        }
        // Toplam kontrol
        const categoryTotal = values.reduce((sum, v) => sum + (parseInt(v) || 0), 0);
        if (validVotes > 0 && categoryTotal > 0 && categoryTotal !== validVotes) {
          warnings.push(`${label} toplami (${categoryTotal}) gecerli oy sayisi (${validVotes}) ile eslesmiyor.`);
        }
      }
    }

    return warnings;
  };

  // focus: 'cb' | 'mv' | undefined (hepsini oku). Genel seçimde CB ve MV
  // ayrı tutanak olduğu için 'cb' veya 'mv' ile çağrılır.
  // opts.photoUrl / opts.photoDataUrl: state'in async güncellenmesini beklemeden
  // doğrudan değer geçilebilir (auto-AI handleFileUpload sonunda kullanır).
  const handleAIFill = async (focus, opts = {}) => {
    const isMv = focus === 'mv';
    const photoUrl = opts.photoUrl !== undefined
      ? opts.photoUrl
      : (isMv ? formData.signed_mv_protocol_photo : formData.signed_protocol_photo);
    const photoDataUrl = opts.photoDataUrl !== undefined
      ? opts.photoDataUrl
      : (isMv ? signedMvPhotoDataUrl : signedPhotoDataUrl);

    if (!photoUrl) {
      setMessage(`Lütfen önce ${isMv ? 'MV' : 'CB'} tutanak fotoğrafını yükleyin`);
      setMessageType('error');
      return;
    }

    try {
      setFillingWithAI(true);
      setMessage('AI tutanağı okumaya başladı...');
      setMessageType('success');

      // AI ile tutanağı oku - seçim türüne göre detaylı bilgi gönder
      const electionInfo = {
        type: election.type,
        // Genel seçim için
        cb_candidates: election.cb_candidates || [],
        parties: election.parties || [],
        independent_cb_candidates: election.independent_cb_candidates || [],
        independent_mv_candidates: election.independent_mv_candidates || [],
        // Yerel seçim için
        mayor_candidates: election.mayor_candidates || [],
        mayor_parties: election.mayor_parties || [],
        provincial_assembly_parties: election.provincial_assembly_parties || [],
        municipal_council_parties: election.municipal_council_parties || [],
        // Konum bilgisi (köy/büyükşehir kontrolü için)
        is_village: isVillage(),
        is_metropolitan: election.is_metropolitan || false, // Bu bilgi election objesinden gelmeli veya ballot box'tan çıkarılmalı
        // Tutanak odağı: 'cb' → sadece cumhurbaşkanı oyları, 'mv' → sadece
        // milletvekili/parti oyları. Genel seçimde iki ayrı tutanak için.
        focus: focus || null
      };

      // Önce bellekteki data URL'i kullan (CORS'tan kaçınmak için)
      const photoSource = photoDataUrl || photoUrl;
      const extractedData = await ProtocolOCRService.readProtocol(
        photoSource,
        electionInfo
      );

      // Tutanak tipi mismatch kontrolü — kullanıcı yanlış tutanak yüklemiş olabilir
      // (ör. CB alanına MV tutanağı). AI tipi tespit edip "tutanak_tipi" döndürür.
      const detectedType = (extractedData?.tutanak_tipi || '').toLowerCase().trim();

      const expectedTypeMap = {
        cb: ['cb'],
        mv: ['mv'],
      };
      const expected = expectedTypeMap[focus];
      const labelMap = {
        cb: 'Cumhurbaşkanı', mv: 'Milletvekili', mayor: 'Belediye Başkanı',
        provincial_assembly: 'İl Genel Meclisi', municipal_council: 'Belediye Meclisi',
        muhtar: 'Muhtarlık', referandum: 'Halk Oylaması', other: 'tanımsız'
      };

      if (expected && detectedType && !expected.includes(detectedType)) {
        // AI tip tespit etti AMA beklenenle uyuşmuyor → güçlü uyarı
        const detected = labelMap[detectedType] || detectedType;
        const expectedLabel = focus === 'cb' ? 'Cumhurbaşkanı' : 'Milletvekili';
        const ok = await confirmWarningsInline([
          `⚠️ Yanlış tutanak yüklemiş olabilirsiniz!`,
          `Bu alana ${expectedLabel} tutanağı yüklenmesi gerekiyor.`,
          `AI bu fotoğrafı "${detected}" tutanağı olarak tespit etti.`,
          `Yine de bu tutanağı bu alana yüklemek istiyor musunuz?`
        ]);
        if (!ok) {
          setFillingWithAI(false);
          setMessage('AI okuma iptal edildi — doğru tutanağı yükleyin.');
          setMessageType('warning');
          return;
        }
      } else if (expected && !detectedType) {
        // AI tip tespit edemedi → bilgilendirici uyarı (block etme)
        setMessage(
          `Bilgi: AI tutanak tipini tespit edemedi. ` +
          `Lütfen yüklediğiniz fotoğrafın doğru tutanak (${focus === 'cb' ? 'Cumhurbaşkanı' : 'Milletvekili'}) ` +
          `olduğundan emin olun.`
        );
        setMessageType('warning');
      }

      // Formu doldur — Genel seçimde focus tek tutanağa odaklı (CB veya MV).
      // Diğer alanın oylarını AI okumadığı için boş object dönüyor; spread sırasında
      // önceki dolu veriyi silmesin diye odaklanılmayan alanı extracted'tan çıkarıyoruz.
      const safeExtracted = { ...extractedData };
      delete safeExtracted.tutanak_tipi; // Firestore'a yazma
      if (election?.type === 'genel' && focus === 'cb') {
        delete safeExtracted.mv_votes;
      } else if (election?.type === 'genel' && focus === 'mv') {
        delete safeExtracted.cb_votes;
      }
      setFormData(prev => ({
        ...prev,
        ...safeExtracted,
        filled_by_ai: true
      }));

      // OCR sonuc dogrulama
      const ocrWarnings = validateOCRResult(extractedData);
      if (ocrWarnings.length > 0) {
        setMessage(`AI tutanagi okudu ancak su uyarilar var:\n${ocrWarnings.join('\n')}\nLutfen kontrol edin.`);
        setMessageType('error');
      } else {
        setMessage('AI tutanagi basariyla okudu ve formu doldurdu. Lutfen kontrol edin ve kaydedin. Basmushahit onayi gerekecek.');
        setMessageType('success');
      }
    } catch (error) {
      console.error('AI fill error:', error);
      setMessage(`AI okuma hatası: ${error.message}`);
      setMessageType('error');
    } finally {
      setFillingWithAI(false);
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
    
    if (election.type === 'cb') {
      // Sadece Cumhurbaşkanı Seçimi
      result.cb = Object.values(formData.cb_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    } else if (election.type === 'mv') {
      // Sadece Milletvekili Genel Seçimi
      result.mv = Object.values(formData.mv_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    } else if (election.type === 'genel') {
      // Genel Seçim: CB ve MV ayrı ayrı
      result.cb = Object.values(formData.cb_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
      result.mv = Object.values(formData.mv_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    } else if (election.type === 'yerel_metropolitan_mayor' || election.type === 'yerel_city_mayor' || election.type === 'yerel_district_mayor') {
      // Belediye Başkanı seçimleri (Büyükşehir, İl, İlçe)
      result.mayor = Object.values(formData.mayor_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    } else if (election.type === 'yerel_provincial_assembly') {
      // İl Genel Meclisi Üyesi Seçimi
      result.provincial_assembly = Object.values(formData.provincial_assembly_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    } else if (election.type === 'yerel_municipal_council') {
      // Belediye Meclisi Üyesi Seçimi
      result.municipal_council = Object.values(formData.municipal_council_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
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

  // category: 'cb' | 'mv' | null
  // - 'cb' → sadece CB tarafı yazılır, MV alanları Firestore'da olduğu gibi kalır
  // - 'mv' → tersi
  // - null → tüm form (eski davranış)
  // Genel seçimde CB/MV ayrı kaydetme isteği için kategori-bazlı save.
  const handleSubmit = async (e, category = null) => {
    if (e && e.preventDefault) e.preventDefault();

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
    
    // Uyarı toplama: kaydetmeyi engellemeyen, kullanıcı onayıyla geçilen uyuşmazlıklar
    const warnings = [];

    // Köylü Türkçesi: hangi alana bakacağı ve hangi sayıların tutmadığı net.
    const mismatchMsg = (label, sum, valid) =>
      `${label} adaylarına/partilerine verdiğiniz oyları topladığımızda ${sum} ediyor, ` +
      `ama "Geçerli Oy" alanına ${valid} yazmışsınız. Bu iki sayı tutmalı — birini kontrol edin.`;

    if (election.type === 'cb') {
      const cbTotal = validVotesByCategory.cb || 0;
      if (cbTotal !== enteredValidVotes) {
        warnings.push(mismatchMsg('Cumhurbaşkanı', cbTotal, enteredValidVotes));
      }
    } else if (election.type === 'mv') {
      const mvTotal = validVotesByCategory.mv || 0;
      if (mvTotal !== enteredValidVotes) {
        warnings.push(mismatchMsg('Milletvekili', mvTotal, enteredValidVotes));
      }
    } else if (election.type === 'genel') {
      // Genel seçimde CB ve MV tutanakları farklı valid_votes değerlerine sahip olabilir.
      const cbValid = parseInt(formData.cb_valid_votes) || enteredValidVotes;
      const mvValid = parseInt(formData.mv_valid_votes) || enteredValidVotes;
      const cbTotal = validVotesByCategory.cb || 0;
      const mvTotal = validVotesByCategory.mv || 0;
      if (cbValid > 0 && cbTotal > 0 && cbTotal !== cbValid) {
        warnings.push(mismatchMsg('CB tutanağında Cumhurbaşkanı', cbTotal, cbValid));
      }
      if (mvValid > 0 && mvTotal > 0 && mvTotal !== mvValid) {
        warnings.push(mismatchMsg('MV tutanağında parti', mvTotal, mvValid));
      }
    } else if (election.type === 'yerel_metropolitan_mayor' || election.type === 'yerel_city_mayor' || election.type === 'yerel_district_mayor') {
      const mayorTotal = validVotesByCategory.mayor || 0;
      if (mayorTotal !== enteredValidVotes) {
        warnings.push(mismatchMsg('Belediye Başkanı', mayorTotal, enteredValidVotes));
      }
    } else if (election.type === 'yerel_provincial_assembly') {
      const provincialAssemblyTotal = validVotesByCategory.provincial_assembly || 0;
      if (provincialAssemblyTotal !== enteredValidVotes) {
        warnings.push(mismatchMsg('İl Genel Meclisi', provincialAssemblyTotal, enteredValidVotes));
      }
    } else if (election.type === 'yerel_municipal_council') {
      const municipalCouncilTotal = validVotesByCategory.municipal_council || 0;
      if (municipalCouncilTotal !== enteredValidVotes) {
        warnings.push(mismatchMsg('Belediye Meclisi', municipalCouncilTotal, enteredValidVotes));
      }
    } else if (election.type === 'yerel') {
      const isVil = isVillage();
      if (!isVil) {
        if (validVotesByCategory.mayor !== enteredValidVotes) {
          warnings.push(mismatchMsg('Belediye Başkanı', validVotesByCategory.mayor, enteredValidVotes));
        }
        if (validVotesByCategory.municipal_council !== enteredValidVotes) {
          warnings.push(mismatchMsg('Belediye Meclisi', validVotesByCategory.municipal_council, enteredValidVotes));
        }
        if (validVotesByCategory.provincial_assembly !== enteredValidVotes) {
          warnings.push(mismatchMsg('İl Genel Meclisi', validVotesByCategory.provincial_assembly, enteredValidVotes));
        }
      } else {
        if (validVotesByCategory.provincial_assembly !== enteredValidVotes) {
          warnings.push(mismatchMsg('İl Genel Meclisi', validVotesByCategory.provincial_assembly, enteredValidVotes));
        }
        if (validVotesByCategory.mayor > 0) {
          warnings.push(`Köyde Belediye Başkanı seçimi yapılmaz. Belediye Başkanı oyu kutusunu sıfırlayın.`);
        }
        if (validVotesByCategory.municipal_council > 0) {
          warnings.push(`Köyde Belediye Meclisi seçimi yapılmaz. Belediye Meclisi oyu kutusunu sıfırlayın.`);
        }
      }
    } else if (election.type === 'referandum') {
      if (totalCalculatedValidVotes !== enteredValidVotes) {
        warnings.push(`"Evet" ve "Hayır" oylarının toplamı ${totalCalculatedValidVotes}, ama "Geçerli Oy" alanına ${enteredValidVotes} yazmışsınız. İki sayı tutmalı.`);
      }
    }

    const usedVotes = parseInt(formData.used_votes) || 0;
    const invalidVotes = parseInt(formData.invalid_votes) || 0;
    const validVotes = parseInt(formData.valid_votes) || 0;
    const totalVoters = parseInt(formData.total_voters) || 0;

    // HARD hata: hesap fiziken bozuluyor (kullanılan oy > toplam seçmen)
    // Test seçiminde bile engellenir — çünkü bu mantıksal olarak imkansız.
    if (totalVoters > 0 && usedVotes > totalVoters) {
      setMessage(`HATA: Oy kullanan seçmen sayısı (${usedVotes}) toplam seçmen sayısından (${totalVoters}) fazla olamaz. Seçmen sayısını veya kullanılan oy sayısını düzeltin.`);
      setMessageType('error');
      setSaving(false);
      return;
    }

    // SOFT uyarı: kullanılan ≠ geçerli + geçersiz
    if (usedVotes !== (invalidVotes + validVotes)) {
      warnings.push(
        `"Kullanılan Oy" ${usedVotes} yazıyor, ama "Geçerli (${validVotes}) + Geçersiz (${invalidVotes})" toplamı ${invalidVotes + validVotes}. ` +
        `Bu üç sayı tutmalı.`
      );
    }

    // Uyarılar varsa inline modal ile onay al — köylü dostu, açıklayıcı.
    // Kullanıcı "Yine de kaydet" derse, sonuç has_inconsistency=true flag'i
    // ile yazılır → trigger sorumluya yüksek-öncelikli bildirim gönderir.
    let hasInconsistency = false;
    let inconsistencyWarnings = [];
    if (warnings.length > 0) {
      const ok = await confirmWarningsInline(warnings);
      if (!ok) {
        setSaving(false);
        return;
      }
      hasInconsistency = true;
      inconsistencyWarnings = warnings.slice(0, 5);
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
      
      // Use AuthContext instead of localStorage
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

    // Çevrimdışı kontrolü — internet yoksa IndexedDB kuyruğuna kaydet
    if (!navigator.onLine) {
      try {
        const offlineData = {
          ...formData,
          ballot_box_id: ballotBoxId,
          ballot_number: ballotNumber || formData.ballot_number,
          filled_by_ai: formData.filled_by_ai || false,
        };
        await queueOfflineResult(offlineData);
        setMessage('Çevrimdışı — Sonuç yerel olarak kaydedildi. İnternet bağlantısı sağlandığında otomatik olarak gönderilecek.');
        setMessageType('warning');
        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, 2500);
      } catch (offlineErr) {
        setMessage('Çevrimdışı kayıt sırasında hata oluştu. Lütfen tekrar deneyin.');
        setMessageType('error');
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      const submitData = {
        ...formData,
        ballot_box_id: ballotBoxId,
        ballot_number: ballotNumber || formData.ballot_number,
        filled_by_ai: formData.filled_by_ai || false, // AI ile dolduruldu mu?
        // Tutarsızlık flag'i — toplam tutmuyor ama kullanıcı yine de kaydetti.
        // Trigger function bunu görüp sorumluya yüksek öncelikli bildirim atar.
        has_inconsistency: hasInconsistency,
        inconsistency_warnings: inconsistencyWarnings,
      };

      // Kategori-bazlı save: genel seçimde CB ve MV ayrı tutanak, ayrı sayı,
      // ayrı save. Firestore updateDoc sadece gönderilen alanları günceller.
      // ÖNEMLİ: Paylaşılan alanlar (used_votes/valid_votes/invalid_votes/total_voters)
      // admin görünümünde kullanılıyor; kategori save'de bunları SİLMEK yerine
      // kategorinin değeriyle DOLDURuyoruz — admin "girilmemiş" görmesin.
      if (category === 'cb') {
        delete submitData.mv_votes;
        delete submitData.signed_mv_protocol_photo;
        delete submitData.mv_total_voters;
        delete submitData.mv_used_votes;
        delete submitData.mv_valid_votes;
        delete submitData.mv_invalid_votes;
        // Paylaşılan alanları CB değerleriyle doldur
        submitData.used_votes = parseInt(formData.cb_used_votes) || parseInt(formData.used_votes) || 0;
        submitData.valid_votes = parseInt(formData.cb_valid_votes) || parseInt(formData.valid_votes) || 0;
        submitData.invalid_votes = parseInt(formData.cb_invalid_votes) || parseInt(formData.invalid_votes) || 0;
        submitData.total_voters = parseInt(formData.cb_total_voters) || parseInt(formData.total_voters) || 0;
        submitData.cb_status = 'pending';
        submitData.cb_submitted_at = new Date().toISOString();
        // Eski reddedilmiş kaydın approval_status='rejected' kalıntısını temizle
        // (Cloud Function publicElectionResults filter bunu reject olarak sayar)
        submitData.approval_status = null;
        submitData._category = 'cb';
      } else if (category === 'mv') {
        delete submitData.cb_votes;
        delete submitData.signed_protocol_photo;
        delete submitData.cb_total_voters;
        delete submitData.cb_used_votes;
        delete submitData.cb_valid_votes;
        delete submitData.cb_invalid_votes;
        // Paylaşılan alanları MV değerleriyle doldur
        submitData.used_votes = parseInt(formData.mv_used_votes) || parseInt(formData.used_votes) || 0;
        submitData.valid_votes = parseInt(formData.mv_valid_votes) || parseInt(formData.valid_votes) || 0;
        submitData.invalid_votes = parseInt(formData.mv_invalid_votes) || parseInt(formData.invalid_votes) || 0;
        submitData.total_voters = parseInt(formData.mv_total_voters) || parseInt(formData.total_voters) || 0;
        submitData.mv_status = 'pending';
        submitData.mv_submitted_at = new Date().toISOString();
        submitData.approval_status = null;
        submitData._category = 'mv';
      } else if (election?.type === 'genel') {
        submitData.cb_status = 'pending';
        submitData.mv_status = 'pending';
        submitData.approval_status = null;
      }
      
      // Check if protocol photo is missing
      const hasProtocolPhoto = !!(submitData.signed_protocol_photo || submitData.signedProtocolPhoto);
      
      const labelPrefix = category === 'cb' ? 'CB sonucu' : (category === 'mv' ? 'MV sonucu' : 'Seçim sonucu');
      let saveResult;
      if (existingResult) {
        saveResult = await ApiService.updateElectionResult(existingResult.id, submitData);
      } else {
        saveResult = await ApiService.createElectionResult(submitData);
      }

      // Validation/save hatası kontrolü — eskiden başarılı sanılıp veri kayboluyordu
      if (saveResult && saveResult.success === false) {
        const errMsg = saveResult.message || (saveResult.errors || []).join(', ') || 'Kayıt başarısız';
        setMessage(`${labelPrefix} kaydedilemedi: ${errMsg}`);
        setMessageType('error');
        setSaving(false);
        return;
      }

      // Başarılı: state ve mesaj
      // _category Firestore'a yazılmaz, ama submitData'dan da temizleyelim
      const cleanSubmit = { ...submitData };
      delete cleanSubmit._category;

      if (existingResult) {
        setExistingResult(prev => ({ ...(prev || {}), ...cleanSubmit, id: prev?.id || existingResult.id }));
      } else {
        const newId = saveResult?.id || saveResult?.docId;
        if (newId && typeof newId === 'string') {
          setExistingResult({ id: newId, ...cleanSubmit });
        }
      }

      if (!hasProtocolPhoto && !category) {
        setMessage(`${labelPrefix} başarıyla ${existingResult ? 'güncellendi' : 'kaydedildi'}. ⚠️ Tutanak fotoğrafını yüklemeyi unutmayın.`);
        setMessageType('warning');
      } else {
        setMessage(`${labelPrefix} başarıyla ${existingResult ? 'güncellendi' : 'kaydedildi'}.`);
        setMessageType('success');
      }
      
      // Mesaj gösterildikten sonra kısa bir süre bekle ve sonra onSuccess çağır.
      // Kategori-bazlı save'de modal kapanmasın — kullanıcı diğer kategoriye devam edebilsin.
      if (!category) {
        setTimeout(() => {
          if (onSuccess) onSuccess();
        }, hasProtocolPhoto ? 1500 : 2500);
      }
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
      'cb': 'Cumhurbaşkanı Seçimi',
      'mv': 'Milletvekili Genel Seçimi',
      'genel': 'Genel Seçim (CB + MV)',
      'yerel': 'Yerel Seçim (Tüm Alt Türler)',
      'yerel_metropolitan_mayor': 'Büyükşehir Belediye Başkanı',
      'yerel_city_mayor': 'İl Belediye Başkanı',
      'yerel_district_mayor': 'İlçe Belediye Başkanı',
      'yerel_provincial_assembly': 'İl Genel Meclisi Üyesi',
      'yerel_municipal_council': 'Belediye Meclisi Üyesi',
      'referandum': 'Referandum'
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

  // Safety check: hooks above her render'da aynı sırada çalışsın diye burada (early
  // return değil). Election yoksa hata UI'ı dön.
  if (!election) {
    return (
      <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Hata</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Seçim bilgisi bulunamadı. Lütfen tekrar deneyin.</p>
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

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" style={{ height: '100vh', overflow: 'hidden' }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-5xl w-full h-[95vh] overflow-hidden flex flex-col">
        {/* Tutanak Başlığı - Minimal ve Kurumsal */}
        <div className="bg-white dark:bg-gray-800 border-b-2 border-gray-300 dark:border-gray-600 px-6 py-4">
          <div className="flex items-center justify-between">
                <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">Seçim Sonuç Tutanağı</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{election.name} - {getTypeLabel()}</p>
                </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:text-gray-400 transition-colors"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Save Button at Top - Large and Prominent */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-700 dark:text-gray-300 font-medium rounded-lg border border-gray-300 dark:border-gray-600 transition-colors"
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
        <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 relative" style={{ maxHeight: 'calc(95vh - 200px)' }}>
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
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                Sandık Bilgileri
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">İl</label>
                  <div className="text-gray-900 dark:text-gray-100 font-medium">{formData.region_name || '-'}</div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">İlçe</label>
                  <div className="text-gray-900 dark:text-gray-100 font-medium">{formData.district_name || '-'}</div>
                </div>
                {formData.town_name && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Belde</label>
                    <div className="text-gray-900 dark:text-gray-100 font-medium">{formData.town_name}</div>
                  </div>
                )}
                {formData.neighborhood_name && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Mahalle</label>
                    <div className="text-gray-900 dark:text-gray-100 font-medium">{formData.neighborhood_name}</div>
                  </div>
                )}
                {formData.village_name && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Köy</label>
                    <div className="text-gray-900 dark:text-gray-100 font-medium">{formData.village_name}</div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Sandık No</label>
                  <div className="text-gray-900 dark:text-gray-100 font-medium">{ballotNumber || '-'}</div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Toplam Seçmen</label>
                  <div className="text-gray-900 dark:text-gray-100 font-medium">{formData.total_voters || '-'}</div>
                </div>
              </div>
            </div>

            {/* Oy Sayıları — Genel seçim DEĞİLSE göster (cb/mv tek başına, yerel, vb.).
                Genel seçimde CB ve MV tutanakları farklı sayılara sahip olabildiği için
                oy sayıları her tutanak kartının kendi içinde toplanır. */}
            {election?.type !== 'genel' && (
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                Oy Sayıları
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Oy Kullanan Seçmen Sayısı *
                  </label>
                  <input
                    type="number"
                    name="used_votes"
                    value={formData.used_votes}
                    onChange={handleInputChange}
                    min="0"
                    inputMode="numeric"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base"
                    required
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Geçersiz Oy Sayısı *
                  </label>
                  <input
                    type="number"
                    name="invalid_votes"
                    value={formData.invalid_votes}
                    onChange={handleInputChange}
                    min="0"
                    inputMode="numeric"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base"
                    required
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Geçerli Oy Sayısı *
                  </label>
                  <input
                    type="number"
                    name="valid_votes"
                    value={formData.valid_votes}
                    onChange={handleInputChange}
                    min="0"
                    inputMode="numeric"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-base"
                    required
                    placeholder="0"
                  />
                  {/* Her kategori için geçerli oy sayısı gösterimi */}
                  {(() => {
                    const validVotesByCategory = calculateValidVotesByCategory();
                    const isVil = isVillage();
                    
                    if (election?.type === 'cb') {
                      return (
                        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <div>CB oyları toplamı: <span className="font-semibold">{validVotesByCategory.cb || 0}</span></div>
                        </div>
                      );
                    } else if (election?.type === 'mv') {
                      return (
                        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <div>MV oyları toplamı: <span className="font-semibold">{validVotesByCategory.mv || 0}</span></div>
                        </div>
                      );
                    } else if (election?.type === 'genel') {
                      return (
                        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <div>CB oyları toplamı: <span className="font-semibold">{validVotesByCategory.cb || 0}</span></div>
                          <div>MV oyları toplamı: <span className="font-semibold">{validVotesByCategory.mv || 0}</span></div>
                          <div className="text-gray-500 dark:text-gray-400 italic">Her kategori için geçerli oy sayısı ayrı ayrı kontrol edilir</div>
                        </div>
                      );
                    } else if (election?.type === 'yerel_metropolitan_mayor' || election?.type === 'yerel_city_mayor' || election?.type === 'yerel_district_mayor') {
                      return (
                        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <div>Belediye Başkanı oyları toplamı: <span className="font-semibold">{validVotesByCategory.mayor || 0}</span></div>
                        </div>
                      );
                    } else if (election?.type === 'yerel_provincial_assembly') {
                      return (
                        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <div>İl Genel Meclisi oyları toplamı: <span className="font-semibold">{validVotesByCategory.provincial_assembly || 0}</span></div>
                        </div>
                      );
                    } else if (election?.type === 'yerel_municipal_council') {
                      return (
                        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <div>Belediye Meclisi oyları toplamı: <span className="font-semibold">{validVotesByCategory.municipal_council || 0}</span></div>
                        </div>
                      );
                    } else if (election?.type === 'yerel') {
                      if (isVil) {
                        return (
                          <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                            <div className="text-amber-600 font-semibold">⚠️ Köy: Sadece İl Genel Meclisi için oy kullanılır</div>
                            <div>İl Genel Meclisi oyları toplamı: <span className="font-semibold">{validVotesByCategory.provincial_assembly || 0}</span></div>
                          </div>
                        );
                      } else {
                        return (
                          <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                            <div>Belediye Başkanı oyları toplamı: <span className="font-semibold">{validVotesByCategory.mayor || 0}</span></div>
                            <div>Belediye Meclisi oyları toplamı: <span className="font-semibold">{validVotesByCategory.municipal_council || 0}</span></div>
                            <div>İl Genel Meclisi oyları toplamı: <span className="font-semibold">{validVotesByCategory.provincial_assembly || 0}</span></div>
                            <div className="text-gray-500 dark:text-gray-400 italic">Her kategori için geçerli oy sayısı ayrı ayrı kontrol edilir</div>
                          </div>
                        );
                      }
                    } else if (election?.type === 'referandum') {
                      return (
                        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <div>Referandum oyları toplamı: <span className="font-semibold">{validVotesByCategory.referendum || 0}</span></div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            </div>
            )}

            {/* Cumhurbaşkanı Seçimi: Sadece CB Oyları */}
            {election?.type === 'cb' && (
              <div className="space-y-5">
                {/* Cumhurbaşkanı Oyları */}
                {election.cb_candidates && election.cb_candidates.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                      Cumhurbaşkanı Adayları ve Aldıkları Oy Sayıları
                    </h2>
                    <div className="space-y-2">
                      {election.cb_candidates.map((candidate) => (
                        <div key={candidate} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {candidate}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.cb_votes[candidate] || ''}
                            onChange={(e) => handleCbVoteChange(candidate, e.target.value)}
                            inputMode="numeric"
                            className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                            placeholder="0"
                          />
                        </div>
                      ))}
                      {/* Bağımsız CB Adayları */}
                      {election.independent_cb_candidates && election.independent_cb_candidates.length > 0 && (
                        <>
                          {election.independent_cb_candidates.map((candidate) => (
                            <div key={`ind_cb_${candidate}`} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                              <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                                {candidate} <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Bağımsız)</span>
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={formData.cb_votes[candidate] || ''}
                                onChange={(e) => handleCbVoteChange(candidate, e.target.value)}
                                inputMode="numeric"
                                className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                                placeholder="0"
                              />
                            </div>
                          ))}
                        </>
                      )}
                      {/* Diğer CB Adayları */}
                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0 bg-amber-50">
                        <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                          Diğer <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Formda olmayan adaylar)</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.cb_votes['Diğer'] || ''}
                          onChange={(e) => handleCbVoteChange('Diğer', e.target.value)}
                          inputMode="numeric"
                          className="w-32 px-3 py-1.5 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm text-right bg-white dark:bg-gray-800"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Milletvekili Genel Seçimi: Sadece MV Oyları */}
            {election?.type === 'mv' && (
              <div className="space-y-5">
                {/* Milletvekili Oyları (Parti Bazlı) */}
                {election.parties && election.parties.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                      Milletvekili Parti Oyları
                    </h2>
                    <div className="space-y-2">
                      {election.parties.map((party) => (
                        <div key={party.name || party} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {party.name || party}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.mv_votes[party.name || party] || ''}
                            onChange={(e) => handleMvVoteChange(party.name || party, e.target.value)}
                            inputMode="numeric"
                            className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                            placeholder="0"
                          />
                        </div>
                      ))}
                      {/* Bağımsız MV Adayları */}
                      {election.independent_mv_candidates && election.independent_mv_candidates.length > 0 && (
                        <>
                          {election.independent_mv_candidates.map((candidate) => (
                            <div key={`ind_mv_${candidate}`} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                              <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                                {candidate} <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Bağımsız)</span>
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={formData.mv_votes[candidate] || ''}
                                onChange={(e) => handleMvVoteChange(candidate, e.target.value)}
                                inputMode="numeric"
                                className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                                placeholder="0"
                              />
                            </div>
                          ))}
                        </>
                      )}
                      {/* Diğer MV Partileri */}
                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0 bg-amber-50">
                        <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                          Diğer <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Formda olmayan partiler)</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.mv_votes['Diğer'] || ''}
                          onChange={(e) => handleMvVoteChange('Diğer', e.target.value)}
                          inputMode="numeric"
                          className="w-32 px-3 py-1.5 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm text-right bg-white dark:bg-gray-800"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Genel Seçim: CB ve MV Oyları (Birlikte) */}
            {election?.type === 'genel' && (
              <div className="space-y-5">
                {/* Cumhurbaşkanı Oyları */}
                {election.cb_candidates && election.cb_candidates.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                      Cumhurbaşkanı Adayları ve Aldıkları Oy Sayıları
                    </h2>
                    <div className="space-y-2">
                      {election.cb_candidates.map((candidate) => (
                        <div key={candidate} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {candidate}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.cb_votes[candidate] || ''}
                            onChange={(e) => handleCbVoteChange(candidate, e.target.value)}
                            inputMode="numeric"
                            className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                            placeholder="0"
                          />
                        </div>
                      ))}
                      {/* Bağımsız CB Adayları */}
                      {election.independent_cb_candidates && election.independent_cb_candidates.length > 0 && (
                        <>
                          {election.independent_cb_candidates.map((candidate) => (
                            <div key={`ind_cb_${candidate}`} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                              <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                                {candidate} <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Bağımsız)</span>
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={formData.cb_votes[candidate] || ''}
                                onChange={(e) => handleCbVoteChange(candidate, e.target.value)}
                                inputMode="numeric"
                                className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                                placeholder="0"
                              />
                            </div>
                          ))}
                        </>
                      )}
                      {/* Diğer CB Adayları */}
                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0 bg-amber-50">
                        <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                          Diğer <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Formda olmayan adaylar)</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.cb_votes['Diğer'] || ''}
                          onChange={(e) => handleCbVoteChange('Diğer', e.target.value)}
                          inputMode="numeric"
                          className="w-32 px-3 py-1.5 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm text-right bg-white dark:bg-gray-800"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Milletvekili Oyları (Parti Bazlı) */}
                {election.parties && election.parties.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                      Milletvekili Parti Oyları
                    </h2>
                    <div className="space-y-2">
                      {election.parties.map((party) => (
                        <div key={party.name || party} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {party.name || party}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.mv_votes[party.name || party] || ''}
                            onChange={(e) => handleMvVoteChange(party.name || party, e.target.value)}
                            inputMode="numeric"
                            className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                            placeholder="0"
                          />
                        </div>
                      ))}
                      {/* Bağımsız MV Adayları */}
                      {election.independent_mv_candidates && election.independent_mv_candidates.length > 0 && (
                        <>
                          {election.independent_mv_candidates.map((candidate) => (
                            <div key={`ind_mv_${candidate}`} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                              <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                                {candidate} <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Bağımsız)</span>
                              </label>
                              <input
                                type="number"
                                min="0"
                                value={formData.mv_votes[candidate] || ''}
                                onChange={(e) => handleMvVoteChange(candidate, e.target.value)}
                                inputMode="numeric"
                                className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                                placeholder="0"
                              />
                            </div>
                          ))}
                        </>
                      )}
                      {/* Diğer MV Partileri */}
                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0 bg-amber-50">
                        <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                          Diğer <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Formda olmayan partiler)</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.mv_votes['Diğer'] || ''}
                          onChange={(e) => handleMvVoteChange('Diğer', e.target.value)}
                          inputMode="numeric"
                          className="w-32 px-3 py-1.5 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm text-right bg-white dark:bg-gray-800"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Büyükşehir Belediye Başkanı Seçimi */}
            {election?.type === 'yerel_metropolitan_mayor' && (
              <div className="space-y-5">
                {/* Belediye Başkanı Parti Oyları */}
                {election.mayor_parties && Array.isArray(election.mayor_parties) && election.mayor_parties.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                      Büyükşehir Belediye Başkanı Parti Oyları
                    </h2>
                    <div className="space-y-2">
                      {election.mayor_parties.map((party) => {
                        const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
                        return (
                          <div key={partyName} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                            <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {partyName}
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={formData.mayor_votes[partyName] || ''}
                              onChange={(e) => handleMayorVoteChange(partyName, e.target.value)}
                              inputMode="numeric"
                              className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                              placeholder="0"
                            />
                          </div>
                        );
                      })}
                      {/* Diğer Belediye Başkanı Partileri */}
                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0 bg-amber-50">
                        <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                          Diğer <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Formda olmayan partiler/adaylar)</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.mayor_votes['Diğer'] || ''}
                          onChange={(e) => handleMayorVoteChange('Diğer', e.target.value)}
                          inputMode="numeric"
                          className="w-32 px-3 py-1.5 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm text-right bg-white dark:bg-gray-800"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Bağımsız Belediye Başkanı Adayları */}
                {election.mayor_candidates && Array.isArray(election.mayor_candidates) && election.mayor_candidates.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                      Bağımsız Büyükşehir Belediye Başkanı Adayları ve Aldıkları Oy Sayıları
                    </h2>
                    <div className="space-y-2">
                      {election.mayor_candidates.map((candidate) => (
                        <div key={candidate} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {candidate} <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Bağımsız)</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.mayor_votes[candidate] || ''}
                            onChange={(e) => handleMayorVoteChange(candidate, e.target.value)}
                            inputMode="numeric"
                            className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* İl Belediye Başkanı Seçimi */}
            {election?.type === 'yerel_city_mayor' && (
              <div className="space-y-5">
                {/* Belediye Başkanı Parti Oyları */}
                {election.mayor_parties && Array.isArray(election.mayor_parties) && election.mayor_parties.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                      İl Belediye Başkanı Parti Oyları
                    </h2>
                    <div className="space-y-2">
                      {election.mayor_parties.map((party) => {
                        const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
                        return (
                          <div key={partyName} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                            <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {partyName}
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={formData.mayor_votes[partyName] || ''}
                              onChange={(e) => handleMayorVoteChange(partyName, e.target.value)}
                              inputMode="numeric"
                              className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                              placeholder="0"
                            />
                          </div>
                        );
                      })}
                      {/* Diğer Belediye Başkanı Partileri */}
                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0 bg-amber-50">
                        <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                          Diğer <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Formda olmayan partiler/adaylar)</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.mayor_votes['Diğer'] || ''}
                          onChange={(e) => handleMayorVoteChange('Diğer', e.target.value)}
                          inputMode="numeric"
                          className="w-32 px-3 py-1.5 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm text-right bg-white dark:bg-gray-800"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Bağımsız Belediye Başkanı Adayları */}
                {election.mayor_candidates && Array.isArray(election.mayor_candidates) && election.mayor_candidates.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                      Bağımsız İl Belediye Başkanı Adayları ve Aldıkları Oy Sayıları
                    </h2>
                    <div className="space-y-2">
                      {election.mayor_candidates.map((candidate) => (
                        <div key={candidate} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {candidate} <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Bağımsız)</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.mayor_votes[candidate] || ''}
                            onChange={(e) => handleMayorVoteChange(candidate, e.target.value)}
                            inputMode="numeric"
                            className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* İlçe Belediye Başkanı Seçimi */}
            {election?.type === 'yerel_district_mayor' && (
              <div className="space-y-5">
                {/* Belediye Başkanı Parti Oyları */}
                {election.mayor_parties && Array.isArray(election.mayor_parties) && election.mayor_parties.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                      İlçe Belediye Başkanı Parti Oyları
                    </h2>
                    <div className="space-y-2">
                      {election.mayor_parties.map((party) => {
                        const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
                        return (
                          <div key={partyName} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                            <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {partyName}
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={formData.mayor_votes[partyName] || ''}
                              onChange={(e) => handleMayorVoteChange(partyName, e.target.value)}
                              inputMode="numeric"
                              className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                              placeholder="0"
                            />
                          </div>
                        );
                      })}
                      {/* Diğer Belediye Başkanı Partileri */}
                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0 bg-amber-50">
                        <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                          Diğer <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Formda olmayan partiler/adaylar)</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.mayor_votes['Diğer'] || ''}
                          onChange={(e) => handleMayorVoteChange('Diğer', e.target.value)}
                          inputMode="numeric"
                          className="w-32 px-3 py-1.5 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm text-right bg-white dark:bg-gray-800"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Bağımsız Belediye Başkanı Adayları */}
                {election.mayor_candidates && Array.isArray(election.mayor_candidates) && election.mayor_candidates.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                      Bağımsız İlçe Belediye Başkanı Adayları ve Aldıkları Oy Sayıları
                    </h2>
                    <div className="space-y-2">
                      {election.mayor_candidates.map((candidate) => (
                        <div key={candidate} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {candidate} <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Bağımsız)</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.mayor_votes[candidate] || ''}
                            onChange={(e) => handleMayorVoteChange(candidate, e.target.value)}
                            inputMode="numeric"
                            className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* İl Genel Meclisi Üyesi Seçimi */}
            {election?.type === 'yerel_provincial_assembly' && (
              <div className="space-y-5">
                {/* İl Genel Meclisi Üyesi Oyları (Parti Bazlı) */}
                {election.provincial_assembly_parties && Array.isArray(election.provincial_assembly_parties) && election.provincial_assembly_parties.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                      İl Genel Meclisi Parti Oyları
                    </h2>
                    <div className="space-y-2">
                      {election.provincial_assembly_parties.map((party) => {
                        const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
                        return (
                          <div key={partyName} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                            <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {partyName}
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={formData.provincial_assembly_votes[partyName] || ''}
                              onChange={(e) => handleProvincialAssemblyVoteChange(partyName, e.target.value)}
                              inputMode="numeric"
                              className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                              placeholder="0"
                            />
                          </div>
                        );
                      })}
                      {/* Diğer İl Genel Meclisi Partileri */}
                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0 bg-amber-50">
                        <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                          Diğer <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Formda olmayan partiler)</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.provincial_assembly_votes['Diğer'] || ''}
                          onChange={(e) => handleProvincialAssemblyVoteChange('Diğer', e.target.value)}
                          inputMode="numeric"
                          className="w-32 px-3 py-1.5 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm text-right bg-white dark:bg-gray-800"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Belediye Meclisi Üyesi Seçimi */}
            {election?.type === 'yerel_municipal_council' && (
              <div className="space-y-5">
                {/* Belediye Meclis Üyesi Oyları (Parti Bazlı) */}
                {election.municipal_council_parties && Array.isArray(election.municipal_council_parties) && election.municipal_council_parties.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                      Belediye Meclis Parti Oyları
                    </h2>
                    <div className="space-y-2">
                      {election.municipal_council_parties.map((party) => {
                        const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
                        return (
                          <div key={partyName} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                            <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {partyName}
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={formData.municipal_council_votes[partyName] || ''}
                              onChange={(e) => handleMunicipalCouncilVoteChange(partyName, e.target.value)}
                              inputMode="numeric"
                              className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                              placeholder="0"
                            />
                          </div>
                        );
                      })}
                      {/* Diğer Belediye Meclisi Partileri */}
                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0 bg-amber-50">
                        <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                          Diğer <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Formda olmayan partiler)</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.municipal_council_votes['Diğer'] || ''}
                          onChange={(e) => handleMunicipalCouncilVoteChange('Diğer', e.target.value)}
                          inputMode="numeric"
                          className="w-32 px-3 py-1.5 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm text-right bg-white dark:bg-gray-800"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Yerel Seçim: Belediye Başkanı, İl Genel Meclisi, Belediye Meclisi (Tüm Alt Türler - Eski Sistem Uyumluluğu) */}
            {election?.type === 'yerel' && (
              <div className="space-y-5">
                {/* Köy bilgilendirmesi — köyde sadece İl Genel Meclisi seçimi olur,
                    Belediye Başkanı ve Belediye Meclisi kartları DOM'dan tamamen kaldırılır. */}
                {isVillage() && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded p-4">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      📍 Köy sandığı: Aşağıda yalnızca İl Genel Meclisi için oy giriniz. Köyde Belediye Başkanı ve Belediye Meclisi seçimi yapılmaz.
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

                {/* Belediye Başkanı Parti Oyları — Köyde HİÇ render edilmez (DOM'dan kaldırılır) */}
                {!isVillage() && election.mayor_parties && Array.isArray(election.mayor_parties) && election.mayor_parties.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                      Belediye Başkanı Parti Oyları
                    </h2>
                    <div className="space-y-2">
                      {election.mayor_parties.map((party) => {
                        const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
                        return (
                        <div key={partyName} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {partyName}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.mayor_votes[partyName] || ''}
                            onChange={(e) => handleMayorVoteChange(partyName, e.target.value)}
                            inputMode="numeric"
                            disabled={isVillage()}
                            className={`w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right ${isVillage() ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
                            placeholder="0"
                          />
            </div>
                        );
                      })}
                      {/* Diğer Belediye Başkanı Partileri */}
                      <div className={`flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0 bg-amber-50 ${isVillage() ? 'opacity-50' : ''}`}>
                        <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                          Diğer <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Formda olmayan partiler/adaylar)</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.mayor_votes['Diğer'] || ''}
                          onChange={(e) => handleMayorVoteChange('Diğer', e.target.value)}
                          inputMode="numeric"
                          disabled={isVillage()}
                          className={`w-32 px-3 py-1.5 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm text-right bg-white dark:bg-gray-800 ${isVillage() ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Bağımsız Belediye Başkanı Adayları — Köyde HİÇ render edilmez */}
                {!isVillage() && election.mayor_candidates && Array.isArray(election.mayor_candidates) && election.mayor_candidates.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                      Bağımsız Belediye Başkanı Adayları ve Aldıkları Oy Sayıları
                    </h2>
                    <div className="space-y-2">
                      {election.mayor_candidates.map((candidate) => (
                        <div key={candidate} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {candidate} <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Bağımsız)</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.mayor_votes[candidate] || ''}
                            onChange={(e) => handleMayorVoteChange(candidate, e.target.value)}
                            inputMode="numeric"
                            disabled={isVillage()}
                            className={`w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right ${isVillage() ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* İl Genel Meclisi Üyesi Oyları (Parti Bazlı) */}
                {election.provincial_assembly_parties && Array.isArray(election.provincial_assembly_parties) && election.provincial_assembly_parties.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                      İl Genel Meclisi Parti Oyları
                    </h2>
                    <div className="space-y-2">
                      {election.provincial_assembly_parties.map((party) => {
                        const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
                        return (
                        <div key={partyName} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {partyName}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.provincial_assembly_votes[partyName] || ''}
                            onChange={(e) => handleProvincialAssemblyVoteChange(partyName, e.target.value)}
                            inputMode="numeric"
                            className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                            placeholder="0"
                          />
                        </div>
                        );
                      })}
                      {/* Diğer İl Genel Meclisi Partileri */}
                      <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0 bg-amber-50">
                        <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                          Diğer <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Formda olmayan partiler)</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.provincial_assembly_votes['Diğer'] || ''}
                          onChange={(e) => handleProvincialAssemblyVoteChange('Diğer', e.target.value)}
                          inputMode="numeric"
                          className="w-32 px-3 py-1.5 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm text-right bg-white dark:bg-gray-800"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Belediye Meclis Üyesi Oyları — Köyde HİÇ render edilmez */}
                {!isVillage() && election.municipal_council_parties && Array.isArray(election.municipal_council_parties) && election.municipal_council_parties.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                      Belediye Meclis Parti Oyları
                    </h2>
                    <div className="space-y-2">
                      {election.municipal_council_parties.map((party) => {
                        const partyName = typeof party === 'string' ? party : (party?.name || String(party) || 'Bilinmeyen');
                        return (
                        <div key={partyName} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                          <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                            {partyName}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.municipal_council_votes[partyName] || ''}
                            onChange={(e) => handleMunicipalCouncilVoteChange(partyName, e.target.value)}
                            inputMode="numeric"
                            disabled={isVillage()}
                            className={`w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right ${isVillage() ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
                            placeholder="0"
                          />
                        </div>
                        );
                      })}
                      {/* Diğer Belediye Meclisi Partileri */}
                      <div className={`flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0 bg-amber-50 ${isVillage() ? 'opacity-50' : ''}`}>
                        <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                          Diğer <span className="text-xs text-gray-500 dark:text-gray-400 font-normal">(Formda olmayan partiler)</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={formData.municipal_council_votes['Diğer'] || ''}
                          onChange={(e) => handleMunicipalCouncilVoteChange('Diğer', e.target.value)}
                          inputMode="numeric"
                          disabled={isVillage()}
                          className={`w-32 px-3 py-1.5 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm text-right bg-white dark:bg-gray-800 ${isVillage() ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Referandum: Evet/Hayır */}
            {election?.type === 'referandum' && (
              <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                  Referandum Oyları
                </h2>
                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                    <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                      Evet
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.referendum_votes['Evet'] || 0}
                      onChange={(e) => handleReferendumVoteChange('Evet', e.target.value)}
                      inputMode="numeric"
                      className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                      placeholder="0"
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <label className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100">
                      Hayır
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.referendum_votes['Hayır'] || 0}
                      onChange={(e) => handleReferendumVoteChange('Hayır', e.target.value)}
                      inputMode="numeric"
                      className="w-32 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-right"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Legacy Support: Eski seçim türleri için geriye dönük uyumluluk */}
            {(election?.type === 'yerel' || election?.type === 'genel') && election?.parties && Array.isArray(election.parties) && election.parties.length > 0 && typeof election.parties[0] === 'string' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
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
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
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
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                Tutanak Fotoğrafları
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {election?.type === 'genel'
                      ? 'Cumhurbaşkanı (CB) İmzalı Tutanak'
                      : 'İmzalı Tutanak Fotoğrafı'}
                </label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded cursor-pointer bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:bg-gray-700 transition-colors">
                    {uploadingPhotos.signed ? (
                      <div className="flex flex-col items-center justify-center w-full">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 dark:border-gray-600 border-t-indigo-600 mb-2"></div>
                        <span className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          {uploadProgress.signed > 0 ? `Yükleniyor... %${uploadProgress.signed}` : 'Yükleniyor...'}
                        </span>
                        {uploadProgress.signed > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress.signed}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    ) : formData.signed_protocol_photo ? (
                      <div className="relative w-full h-full">
                        <img
                          src={formData.signed_protocol_photo}
                          alt="İmzalı Tutanak"
                          className="w-full h-full object-cover rounded"
                          loading="lazy"
                          onError={(e) => { e.target.style.display = 'none'; }}
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
                        <span className="text-xs text-gray-600 dark:text-gray-400">Fotoğraf Yükle</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) handlePhotoUpload(file, 'signed');
                      }}
                      className="hidden"
                      disabled={uploadingPhotos.signed}
                    />
                  </label>
                  {/* AI ile Doldur Butonu */}
                  {formData.signed_protocol_photo && !fillingWithAI && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleAIFill(election?.type === 'genel' ? 'cb' : undefined)}
                        disabled={!isOnline}
                        className="mt-2 w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        {election?.type === 'genel' ? 'AI — CB Tutanağını Oku' : 'AI ile Otomatik Doldur'}
                      </button>
                      {!isOnline && (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          ⚠️ Çevrimdışıyken AI okuma kapalı. Manuel doldurabilirsiniz; internet gelince form otomatik gönderilecek.
                        </p>
                      )}
                    </>
                  )}
                  {/* Genel seçimde CB tutanağına özel oy sayıları (MV ile bağımsız) */}
                  {election?.type === 'genel' && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">CB Toplam Seçmen</label>
                        <input type="number" name="cb_total_voters" value={formData.cb_total_voters} onChange={handleInputChange} min="0" className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">CB Kullanılan</label>
                        <input type="number" name="cb_used_votes" value={formData.cb_used_votes} onChange={handleInputChange} min="0" className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">CB Geçerli</label>
                        <input type="number" name="cb_valid_votes" value={formData.cb_valid_votes} onChange={handleInputChange} min="0" className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500" placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">CB Geçersiz</label>
                        <input type="number" name="cb_invalid_votes" value={formData.cb_invalid_votes} onChange={handleInputChange} min="0" className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500" placeholder="0" />
                      </div>
                    </div>
                  )}
                  {/* "CB Sonucunu Kaydet" butonu kaldırıldı — üstteki tek "Kaydet"
                      butonu yeterli. Kullanıcı kafa karışıklığı yaşıyordu. */}

                  {/* MV Tutanağı — Sadece genel seçim için */}
                  {election?.type === 'genel' && (
                    <div className="mt-4">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Milletvekili (MV) İmzalı Tutanak
                      </label>
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded cursor-pointer bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 transition-colors">
                        {uploadingPhotos.mv_signed ? (
                          <div className="flex flex-col items-center justify-center w-full">
                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 dark:border-gray-600 border-t-indigo-600 mb-2"></div>
                            <span className="text-xs text-gray-600 dark:text-gray-400">
                              {uploadProgress.mv_signed > 0 ? `Yükleniyor... %${uploadProgress.mv_signed}` : 'Yükleniyor...'}
                            </span>
                          </div>
                        ) : formData.signed_mv_protocol_photo ? (
                          <div className="relative w-full h-full">
                            <img
                              src={formData.signed_mv_protocol_photo}
                              alt="MV İmzalı Tutanak"
                              className="w-full h-full object-cover rounded"
                              loading="lazy"
                              onError={(e) => { e.target.style.display = 'none'; }}
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
                            <span className="text-xs text-gray-600 dark:text-gray-400">MV Tutanağı Yükle</span>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) handlePhotoUpload(file, 'mv_signed');
                          }}
                          className="hidden"
                          disabled={uploadingPhotos.mv_signed}
                        />
                      </label>
                      {formData.signed_mv_protocol_photo && !fillingWithAI && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAIFill('mv')}
                            disabled={!isOnline}
                            className="mt-2 w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center justify-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            AI — MV Tutanağını Oku
                          </button>
                          {!isOnline && (
                            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                              ⚠️ Çevrimdışıyken AI okuma kapalı. Manuel doldurabilirsiniz.
                            </p>
                          )}
                        </>
                      )}
                      {/* MV tutanağına özel oy sayıları (CB ile bağımsız) */}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">MV Toplam Seçmen</label>
                          <input type="number" name="mv_total_voters" value={formData.mv_total_voters} onChange={handleInputChange} min="0" className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-purple-500" placeholder="0" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">MV Kullanılan</label>
                          <input type="number" name="mv_used_votes" value={formData.mv_used_votes} onChange={handleInputChange} min="0" className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-purple-500" placeholder="0" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">MV Geçerli</label>
                          <input type="number" name="mv_valid_votes" value={formData.mv_valid_votes} onChange={handleInputChange} min="0" className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-purple-500" placeholder="0" />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">MV Geçersiz</label>
                          <input type="number" name="mv_invalid_votes" value={formData.mv_invalid_votes} onChange={handleInputChange} min="0" className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-purple-500" placeholder="0" />
                        </div>
                      </div>
                      {/* "MV Sonucunu Kaydet" kaldırıldı — üst Kaydet yeterli */}
                    </div>
                  )}
                  {fillingWithAI && (
                    <div className="mt-2 w-full px-4 py-2 bg-purple-100 text-purple-700 font-medium rounded-lg flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-300 border-t-purple-600"></div>
                      AI tutanağı okuyor...
                    </div>
                  )}
              </div>

                {formData.has_objection && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  İtiraz Tutanağı
                </label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded cursor-pointer bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:bg-gray-700 transition-colors">
                    {uploadingPhotos.objection ? (
                      <div className="flex flex-col items-center justify-center w-full">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 dark:border-gray-600 border-t-indigo-600 mb-2"></div>
                        <span className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          {uploadProgress.objection > 0 ? `Yükleniyor... %${uploadProgress.objection}` : 'Yükleniyor...'}
                        </span>
                        {uploadProgress.objection > 0 && (
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${uploadProgress.objection}%` }}
                            ></div>
                          </div>
                        )}
                      </div>
                    ) : formData.objection_protocol_photo ? (
                      <div className="relative w-full h-full">
                        <img
                          src={formData.objection_protocol_photo}
                          alt="İtiraz Tutanağı"
                          className="w-full h-full object-cover rounded"
                          loading="lazy"
                          onError={(e) => { e.target.style.display = 'none'; }}
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
                        <span className="text-xs text-gray-600 dark:text-gray-400">Fotoğraf Yükle</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) handlePhotoUpload(file, 'objection');
                      }}
                      className="hidden"
                      disabled={uploadingPhotos.objection}
                    />
                  </label>
                </div>
                )}
              </div>
            </div>

            {/* İtiraz Bilgileri */}
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
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
                    className="w-5 h-5 text-red-600 border-2 border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-red-500 cursor-pointer"
                />
                  <label htmlFor="has_objection" className="text-sm font-semibold text-gray-900 dark:text-gray-100 cursor-pointer">
                  İtiraz Edildi
                </label>
              </div>
              
              {formData.has_objection && (
                  <div className="ml-8">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      İtiraz Sebebi *
                    </label>
                    <textarea
                      name="objection_reason"
                      value={formData.objection_reason}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm resize-none"
                      placeholder="İtiraz sebebini detaylı olarak yazınız..."
                      required={formData.has_objection}
                    />
                </div>
              )}
              </div>
            </div>

            {/* Notlar */}
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-5">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 uppercase mb-4 border-b border-gray-300 dark:border-gray-600 pb-2">
                Notlar
              </h2>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none"
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

      {/* Validation onay dialog'u — window.confirm() yerine.
          Köylü dostu mesajlar, "Düzelt" / "Yine de Kaydet" ayrımı net. */}
      {pendingValidation && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6 animate-scale-in">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Sayılarda uyuşmazlık var</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                  Aşağıdaki sayıları kontrol etmenizi öneriyoruz. Tutanaktaki sayıları yeniden kontrol edip düzeltebilirsiniz, ya da emin iseniz yine de kaydedebilirsiniz.
                </p>
              </div>
            </div>

            <ul className="space-y-2.5 mb-6 max-h-64 overflow-y-auto">
              {pendingValidation.warnings.map((w, i) => (
                <li key={i} className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 px-3 py-2 rounded text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                  {w}
                </li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={pendingValidation.onCancel}
                className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors"
              >
                Düzeltmeye Geri Dön
              </button>
              <button
                type="button"
                onClick={pendingValidation.onConfirm}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-lg transition-colors"
              >
                Yine de Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ElectionResultForm;
