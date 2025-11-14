import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
    // Oy sayıları
    used_votes: '', // Kullanılan oy
    invalid_votes: '', // Geçersiz oy
    valid_votes: '', // Geçerli oy
    // Yerel/Genel seçim için parti oyları
    party_votes: {},
    // CB seçimi için aday oyları
    candidate_votes: {},
    // Tutanak fotoğrafları
    signed_protocol_photo: null,
    objection_protocol_photo: null,
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
        
        // Form verilerini doldur
        setFormData(prev => ({
          ...prev,
          used_votes: result.used_votes || '',
          invalid_votes: result.invalid_votes || '',
          valid_votes: result.valid_votes || '',
          party_votes: result.party_votes || {},
          candidate_votes: result.candidate_votes || {},
          signed_protocol_photo: result.signed_protocol_photo || null,
          objection_protocol_photo: result.objection_protocol_photo || null,
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

    try {
      setUploadingPhotos(prev => ({ ...prev, [type]: true }));
      
      // Firebase Storage'a yükle
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
      setMessage('Fotoğraf yüklenirken hata oluştu');
      setMessageType('error');
    } finally {
      setUploadingPhotos(prev => ({ ...prev, [type]: false }));
    }
  };

  // Geçerli oy hesaplama ve validasyon
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

    // Validasyon: Geçerli oy = parti/aday oyları toplamı
    const calculatedValidVotes = calculateValidVotes();
    const enteredValidVotes = parseInt(formData.valid_votes) || 0;

    if (calculatedValidVotes !== enteredValidVotes) {
      setMessage(`Geçerli oy sayısı (${enteredValidVotes}) parti/aday oyları toplamı (${calculatedValidVotes}) ile eşleşmiyor`);
      setMessageType('error');
      setSaving(false);
      return;
    }

    // Validasyon: Kullanılan oy = Geçersiz oy + Geçerli oy
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
      if (existingResult) {
        // Güncelle
        await ApiService.updateElectionResult(existingResult.id, formData);
        setMessage('Seçim sonucu başarıyla güncellendi');
      } else {
        // Yeni kayıt
        await ApiService.createElectionResult(formData);
        setMessage('Seçim sonucu başarıyla kaydedildi');
      }
      
      setMessageType('success');
      
      // Başarılı kayıt sonrası callback çağır
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {election.name} - Seçim Sonuç Formu
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {message && (
            <div className={`p-4 rounded-lg ${
              messageType === 'success' 
                ? 'bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-200' 
                : 'bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-200'
            }`}>
              {message}
            </div>
          )}

          {/* Oy Sayıları */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Kullanılan Oy *
              </label>
              <input
                type="number"
                name="used_votes"
                value={formData.used_votes}
                onChange={handleInputChange}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Geçersiz Oy *
              </label>
              <input
                type="number"
                name="invalid_votes"
                value={formData.invalid_votes}
                onChange={handleInputChange}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Geçerli Oy * (Otomatik: {calculateValidVotes()})
              </label>
              <input
                type="number"
                name="valid_votes"
                value={formData.valid_votes}
                onChange={handleInputChange}
                min="0"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                required
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Parti/Aday oyları toplamı: {calculateValidVotes()}
              </p>
            </div>
          </div>

          {/* Yerel/Genel Seçim - Parti Oyları */}
          {(election.type === 'yerel' || election.type === 'genel') && election.parties && election.parties.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Parti Oyları
              </h3>
              <div className="grid gap-4">
                {election.parties.map((party) => (
                  <div key={party} className="flex items-center gap-4">
                    <label className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {party}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.party_votes[party] || ''}
                      onChange={(e) => handlePartyVoteChange(party, e.target.value)}
                      className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* CB Seçimi - Aday Oyları */}
          {election.type === 'cb' && election.candidates && election.candidates.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Aday Oyları
              </h3>
              <div className="grid gap-4">
                {election.candidates.map((candidate) => (
                  <div key={candidate} className="flex items-center gap-4">
                    <label className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {candidate}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.candidate_votes[candidate] || ''}
                      onChange={(e) => handleCandidateVoteChange(candidate, e.target.value)}
                      className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Islak İmzalı Seçim Tutanağı Fotoğrafı */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Islak İmzalı Seçim Tutanağı Fotoğrafı
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) handlePhotoUpload(file, 'signed');
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              disabled={uploadingPhotos.signed}
            />
            {uploadingPhotos.signed && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Yükleniyor...</p>
            )}
            {formData.signed_protocol_photo && (
              <div className="mt-2">
                <img 
                  src={formData.signed_protocol_photo} 
                  alt="Tutanak" 
                  className="max-w-xs rounded-lg border border-gray-300 dark:border-gray-600"
                />
              </div>
            )}
          </div>

          {/* İtiraz Tutanağı Fotoğrafı */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              İtiraz Tutanağı Fotoğrafı (Varsa)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) handlePhotoUpload(file, 'objection');
              }}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              disabled={uploadingPhotos.objection}
            />
            {uploadingPhotos.objection && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Yükleniyor...</p>
            )}
            {formData.objection_protocol_photo && (
              <div className="mt-2">
                <img 
                  src={formData.objection_protocol_photo} 
                  alt="İtiraz Tutanağı" 
                  className="max-w-xs rounded-lg border border-gray-300 dark:border-gray-600"
                />
              </div>
            )}
          </div>

          {/* Notlar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notlar
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
              placeholder="Ek notlarınızı buraya yazabilirsiniz..."
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {saving ? 'Kaydediliyor...' : existingResult ? 'Güncelle' : 'Kaydet'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors"
            >
              İptal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ElectionResultForm;

