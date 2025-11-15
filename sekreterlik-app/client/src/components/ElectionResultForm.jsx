import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import { storage, auth } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signInWithEmailAndPassword } from 'firebase/auth';

const ElectionResultForm = ({ election, ballotBoxId, ballotNumber, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [existingResult, setExistingResult] = useState(null);
  
  const [formData, setFormData] = useState({
    election_id: election.id,
    ballot_box_id: ballotBoxId,
    ballot_number: ballotNumber,
    used_votes: '',
    invalid_votes: '',
    valid_votes: '',
    party_votes: {},
    candidate_votes: {},
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

  useEffect(() => {
    fetchExistingResult();
  }, [election.id, ballotBoxId]);

  const fetchExistingResult = async () => {
    try {
      const results = await ApiService.getElectionResults(election.id, ballotBoxId);
      if (results && results.length > 0) {
        const result = results[0];
        setExistingResult(result);
        
        setFormData(prev => ({
          ...prev,
          used_votes: result.used_votes || '',
          invalid_votes: result.invalid_votes || '',
          valid_votes: result.valid_votes || '',
          party_votes: result.party_votes || {},
          candidate_votes: result.candidate_votes || {},
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
      
      const timestamp = Date.now();
      const fileName = `election_results/${election.id}/${ballotBoxId}/${type}_${timestamp}_${file.name}`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, file);
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

  const calculateValidVotes = () => {
    if (election.type === 'cb' && election.candidates) {
      return Object.values(formData.candidate_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    } else if ((election.type === 'yerel' || election.type === 'genel') && election.parties) {
      return Object.values(formData.party_votes || {}).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    }
    return 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    if (!ballotBoxId) {
      setMessage('Sandık bilgisi bulunamadı. Lütfen tekrar giriş yapın.');
      setMessageType('error');
      setSaving(false);
      return;
    }

    const calculatedValidVotes = calculateValidVotes();
    const enteredValidVotes = parseInt(formData.valid_votes) || 0;

    if (calculatedValidVotes !== enteredValidVotes) {
      setMessage(`Geçerli oy sayısı (${enteredValidVotes}) parti/aday oyları toplamı (${calculatedValidVotes}) ile eşleşmiyor`);
      setMessageType('error');
      setSaving(false);
      return;
    }

    const usedVotes = parseInt(formData.used_votes) || 0;
    const invalidVotes = parseInt(formData.invalid_votes) || 0;
    const validVotes = parseInt(formData.valid_votes) || 0;

    if (usedVotes !== (invalidVotes + validVotes)) {
      setMessage(`Kullanılan oy (${usedVotes}) geçersiz oy (${invalidVotes}) + geçerli oy (${validVotes}) toplamı ile eşleşmiyor`);
      setMessageType('error');
      setSaving(false);
      return;
    }

    try {
      const submitData = {
        ...formData,
        ballot_box_id: ballotBoxId,
        ballot_number: ballotNumber || formData.ballot_number
      };
      
      if (existingResult) {
        await ApiService.updateElectionResult(existingResult.id, submitData);
        setMessage('Seçim sonucu başarıyla güncellendi');
      } else {
        await ApiService.createElectionResult(submitData);
        setMessage('Seçim sonucu başarıyla kaydedildi');
      }
      
      setMessageType('success');
      
      setTimeout(() => {
        if (onSuccess) onSuccess();
      }, 1500);
    } catch (error) {
      console.error('Error saving election result:', error);
      setMessage(error.message || 'Seçim sonucu kaydedilirken hata oluştu');
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const getTypeColor = () => {
    const colors = {
      'yerel': 'from-blue-500 to-blue-600',
      'genel': 'from-purple-500 to-purple-600',
      'cb': 'from-indigo-500 to-indigo-600'
    };
    return colors[election.type] || 'from-gray-500 to-gray-600';
  };

  const getTypeLabel = () => {
    const labels = {
      'yerel': 'Yerel Seçim',
      'genel': 'Genel Seçim',
      'cb': 'Cumhurbaşkanlığı Seçimi'
    };
    return labels[election.type] || election.type;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col animate-scale-in">
        {/* Modern Gradient Header */}
        <div className={`relative overflow-hidden bg-gradient-to-r ${getTypeColor()} text-white`}>
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white rounded-full blur-xl"></div>
          </div>
          
          <div className="relative px-6 py-5 sm:px-8 sm:py-6 flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold">{election.name}</h2>
                  <p className="text-sm text-white/80 mt-0.5">{getTypeLabel()}</p>
                </div>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
            {/* Message Alert */}
            {message && (
              <div className={`p-4 rounded-xl border-l-4 animate-slide-down ${
                messageType === 'success' 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-800 dark:text-green-200' 
                  : 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-800 dark:text-red-200'
              }`}>
                <div className="flex items-center gap-3">
                  {messageType === 'success' ? (
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  <p className="font-medium">{message}</p>
                </div>
              </div>
            )}

            {/* Oy Sayıları - Modern Cards */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-700/50 dark:to-gray-800/50 rounded-2xl p-6 border border-indigo-100 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-full"></div>
                Oy Sayıları
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Kullanılan Oy *
                  </label>
                  <input
                    type="number"
                    name="used_votes"
                    value={formData.used_votes}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100 transition-all duration-200 text-lg font-medium"
                    required
                    placeholder="0"
                  />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Geçersiz Oy *
                  </label>
                  <input
                    type="number"
                    name="invalid_votes"
                    value={formData.invalid_votes}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100 transition-all duration-200 text-lg font-medium"
                    required
                    placeholder="0"
                  />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Geçerli Oy * 
                    <span className="ml-2 text-xs font-normal text-indigo-600 dark:text-indigo-400">
                      (Otomatik: {calculateValidVotes()})
                    </span>
                  </label>
                  <input
                    type="number"
                    name="valid_votes"
                    value={formData.valid_votes}
                    onChange={handleInputChange}
                    min="0"
                    className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100 transition-all duration-200 text-lg font-medium"
                    required
                    placeholder="0"
                  />
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Parti/Aday oyları toplamı: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{calculateValidVotes()}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Parti/Aday Oyları */}
            {(election.type === 'yerel' || election.type === 'genel') && election.parties && election.parties.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
                  Parti Oyları
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

            {election.type === 'cb' && election.candidates && election.candidates.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-purple-600 rounded-full"></div>
                  Aday Oyları
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

            {/* Fotoğraf Yükleme - Modern Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Seçim Tutanağı Fotoğrafı
                </label>
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    {uploadingPhotos.signed ? (
                      <div className="flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-200 border-t-indigo-600 mb-2"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Yükleniyor...</span>
                      </div>
                    ) : formData.signed_protocol_photo ? (
                      <div className="relative w-full h-full">
                        <img 
                          src={formData.signed_protocol_photo} 
                          alt="Tutanak" 
                          className="w-full h-full object-cover rounded-xl"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                          <span className="text-white text-sm font-medium">Yeniden Yükle</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Fotoğraf Yükle</span>
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
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  İtiraz Tutanağı (Varsa)
                </label>
                <div className="space-y-3">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl cursor-pointer bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    {uploadingPhotos.objection ? (
                      <div className="flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-200 border-t-orange-600 mb-2"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Yükleniyor...</span>
                      </div>
                    ) : formData.objection_protocol_photo ? (
                      <div className="relative w-full h-full">
                        <img 
                          src={formData.objection_protocol_photo} 
                          alt="İtiraz Tutanağı" 
                          className="w-full h-full object-cover rounded-xl"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                          <span className="text-white text-sm font-medium">Yeniden Yükle</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center">
                        <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Fotoğraf Yükle</span>
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
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
                  className="w-6 h-6 text-red-600 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 cursor-pointer"
                />
                <label htmlFor="has_objection" className="text-lg font-bold text-gray-900 dark:text-gray-100 cursor-pointer flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  İtiraz Edildi
                </label>
              </div>
              
              {formData.has_objection && (
                <div className="ml-9 space-y-4 animate-fade-in">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      İtiraz Sebebi *
                    </label>
                    <textarea
                      name="objection_reason"
                      value={formData.objection_reason}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-700 dark:text-gray-100 transition-all duration-200"
                      placeholder="İtiraz sebebini detaylı olarak yazın..."
                      required
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notlar */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Notlar
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100 transition-all duration-200"
                placeholder="Ek notlarınızı buraya yazabilirsiniz..."
              />
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span>Kaydediliyor...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{existingResult ? 'Güncelle' : 'Kaydet'}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
              >
                İptal
              </button>
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
