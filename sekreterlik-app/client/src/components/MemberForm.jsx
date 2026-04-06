import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';

const MemberForm = ({ member, regions, positions, onClose, onMemberSaved }) => {
  const [formData, setFormData] = useState({
    tc: '',
    name: '',
    phone: '',
    position: '',
    region: ''
  });
  const [error, setError] = useState(''); // Add state for error messages
  const [successMessage, setSuccessMessage] = useState(''); // Add state for success messages with credentials
  const [showCredentials, setShowCredentials] = useState(false); // Add state to show credentials
  const [kvkkConsent, setKvkkConsent] = useState(false); // KVKK rıza checkbox
  const [photoFile, setPhotoFile] = useState(null); // Photo file for upload
  const [photoPreview, setPhotoPreview] = useState(null); // Photo preview URL
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Cleanup blob URL to prevent memory leak
  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  useEffect(() => {
    if (member) {
      setFormData({
        tc: member.tc || '',
        name: member.name || '',
        phone: member.phone || '',
        position: member.position || '',
        region: member.region || ''
      });
    }
  }, [member]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // TC ve telefon alanlarinda sadece rakam girisine izin ver
    if (name === 'tc' || name === 'phone') {
      const numericValue = value.replace(/\D/g, '');
      setFormData(prev => ({
        ...prev,
        [name]: numericValue
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Lutfen sadece resim dosyasi secin');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Dosya boyutu 5MB\'dan kucuk olmalidir');
      return;
    }
    // Revoke old blob URL before creating new one
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // KVKK rıza kontrolü (sadece yeni üye eklerken)
    if (!member && !kvkkConsent) {
      setError('KVKK kapsamında kişisel verilerin işlenmesine onay vermeniz gerekmektedir.');
      return;
    }

    // Basic validation
    if (!formData.tc || !formData.name || !formData.phone ||
        !formData.position || !formData.region) {
      setError('Tüm alanlar zorunludur');
      return;
    }

    // TC Kimlik No validasyonu
    if (!/^\d{11}$/.test(formData.tc)) {
      setError('TC Kimlik No tam olarak 11 haneli rakamlardan oluşmalıdır');
      return;
    }
    if (formData.tc.charAt(0) === '0') {
      setError('TC Kimlik No sıfır ile başlayamaz');
      return;
    }

    // Telefon validasyonu
    const phone = formData.phone;
    if (!/^\d+$/.test(phone)) {
      setError('Telefon numarası sadece rakamlardan oluşmalıdır');
      return;
    }
    if (phone.length < 10 || phone.length > 11) {
      setError('Telefon numarası 10 veya 11 haneli olmalıdır (05XX... veya 5XX...)');
      return;
    }
    if (phone.length === 11 && !phone.startsWith('0')) {
      setError('11 haneli telefon numarası 0 ile başlamalıdır (örn: 05XX...)');
      return;
    }
    if (phone.length === 10 && phone.startsWith('0')) {
      setError('10 haneli telefon numarası 0 ile başlamamalıdır (örn: 5XX...)');
      return;
    }
    
    try {
      // KVKK onay tarihini ekle (yeni üye)
      const submitData = { ...formData };
      if (!member && kvkkConsent) {
        submitData.kvkk_consent_date = new Date().toISOString();
      }

      let response;
      if (member) {
        // Update existing member
        response = await ApiService.updateMember(member.id, submitData);
        // Upload photo if selected
        if (photoFile) {
          try {
            setIsUploadingPhoto(true);
            await ApiService.uploadMemberPhoto(member.id, photoFile);
          } catch (photoError) {
            console.error('Photo upload error:', photoError);
          } finally {
            setIsUploadingPhoto(false);
          }
        }
      } else {
        // Create new member
        response = await ApiService.createMember(submitData);

        // Upload photo for new member if selected
        if (photoFile && response?.id) {
          try {
            setIsUploadingPhoto(true);
            await ApiService.uploadMemberPhoto(response.id, photoFile);
          } catch (photoError) {
            console.error('Photo upload error:', photoError);
          } finally {
            setIsUploadingPhoto(false);
          }
        }

        // Eğer kullanıcı bilgileri varsa göster
        if (response.userCredentials) {
          const { username, password } = response.userCredentials;
          setSuccessMessage(
            `Üye başarıyla oluşturuldu!\n\nKullanıcı Bilgileri:\nKullanıcı Adı: ${username}\nŞifre: ${password}\n\nLütfen bu bilgileri not edin.`
          );
          setShowCredentials(true);
          // Manuel kapatmaya bırak, otomatik kapatma yok
          return; // Modal'ı hemen kapatma, kullanıcı bilgilerini göster
        }
      }
      
      // Clear any previous errors
      setError('');

      // Always close modal and refresh - use setTimeout to ensure state updates complete
      setTimeout(() => {
        // Make sure onMemberSaved is called (this also closes modal)
        if (onMemberSaved) {
          onMemberSaved();
        } else if (onClose) {
          // Fallback to onClose if onMemberSaved not provided
          onClose();
        }
      }, 100);
    } catch (error) {
      console.error('Error saving member:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // Handle specific error cases
      if (error.message && error.message.includes('TC kimlik numarası zaten kayıtlı')) {
        setError('Bu TC kimlik numarası zaten kayıtlı. Lütfen farklı bir TC numarası girin.');
      } else if (error.message) {
        // Display the error message with validation errors if any
        const errorMsg = error.message.replace(/\n\n/g, '\n');
        setError(errorMsg);
      } else {
        setError('Üye kaydedilirken bilinmeyen bir hata oluştu.');
      }
      // Don't close modal on error - user needs to see the error
    }
  };

  return (
    <div className="space-y-4">
      {successMessage && showCredentials && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-green-800 mb-2">
                Üye Başarıyla Oluşturuldu
              </h3>
              <div className="text-sm text-green-700 space-y-2">
                {successMessage.split('\n').map((line, idx) => {
                  if (line.includes('Kullanıcı Adı:')) {
                    const parts = line.split(':');
                    const value = parts[1].trim();
                    return (
                      <div key={idx} className="font-semibold flex items-center gap-2">
                        {parts[0]}: <span className="font-mono bg-green-100 px-2 py-1 rounded">{value}</span>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(value); }}
                          className="p-1 text-green-600 hover:text-green-800 hover:bg-green-200 rounded transition-colors"
                          title="Kopyala"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    );
                  } else if (line.includes('Şifre:')) {
                    const parts = line.split(':');
                    const value = parts[1].trim();
                    return (
                      <div key={idx} className="font-semibold flex items-center gap-2">
                        {parts[0]}: <span className="font-mono bg-green-100 px-2 py-1 rounded">{value}</span>
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(value); }}
                          className="p-1 text-green-600 hover:text-green-800 hover:bg-green-200 rounded transition-colors"
                          title="Kopyala"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    );
                  } else if (line.trim() === '') {
                    return <br key={idx} />;
                  } else {
                    return <div key={idx}>{line}</div>;
                  }
                })}
              </div>
              <button
                onClick={() => {
                  setShowCredentials(false);
                  setSuccessMessage('');
                  if (onMemberSaved) {
                    onMemberSaved();
                  } else if (onClose) {
                    onClose();
                  }
                }}
                className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-1">
                {error.includes('\n') ? 'Doğrulama Hatası' : error.split('\n')[0]}
              </h3>
              {error.includes('\n') && (
                <ul className="list-disc list-inside text-sm text-red-700 mt-2 space-y-1">
                  {error.split('\n').slice(1).filter(line => line.trim()).map((line, idx) => (
                    <li key={idx}>{line.trim()}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="member-tc" className="block text-sm font-medium text-gray-700 mb-1">
              TC Kimlik No
            </label>
            <input
              id="member-tc"
              type="text"
              name="tc"
              value={formData.tc}
              onChange={handleChange}
              inputMode="numeric"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
              placeholder="TC kimlik numarası"
              maxLength="11"
            />
          </div>
          
          <div>
            <label htmlFor="member-name" className="block text-sm font-medium text-gray-700 mb-1">
              İsim Soyisim
            </label>
            <input
              id="member-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
              placeholder="İsim soyisim"
            />
          </div>
          
          <div>
            <label htmlFor="member-phone" className="block text-sm font-medium text-gray-700 mb-1">
              Telefon
            </label>
            <input
              id="member-phone"
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              inputMode="numeric"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
              placeholder="Telefon numarası"
              maxLength="11"
            />
          </div>
          
          <div>
            <label htmlFor="member-position" className="block text-sm font-medium text-gray-700 mb-1">
              Görev
            </label>
            <select
              id="member-position"
              name="position"
              value={formData.position}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
            >
              <option value="">Görev seçin</option>
              {positions.map(position => (
                <option key={position.id} value={position.name}>
                  {position.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="member-region" className="block text-sm font-medium text-gray-700 mb-1">
              Bölge
            </label>
            <select
              id="member-region"
              name="region"
              value={formData.region}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
            >
              <option value="">Bölge seçin</option>
              {regions.map(region => (
                <option key={region.id} value={region.name}>
                  {region.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Fotograf Yukleme */}
        <div className="mt-4">
          <label htmlFor="member-photo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Fotograf
          </label>
          <div className="flex items-center gap-4">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Onizleme"
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                loading="lazy"
              />
            ) : member?.photo ? (
              <img
                src={member.photo}
                alt={member.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
                loading="lazy"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center border-2 border-gray-200">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
            <div className="flex-1">
              <input
                id="member-photo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoChange}
                disabled={isUploadingPhoto}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
              />
              {isUploadingPhoto && (
                <p className="text-xs text-gray-500 mt-1">Fotograf yukleniyor...</p>
              )}
            </div>
          </div>
        </div>

        {/* KVKK Açık Rıza Checkbox - Sadece yeni üye eklerken göster */}
        {!member && (
          <div className="flex items-start gap-2 mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
            <input
              type="checkbox"
              id="kvkkConsent"
              checked={kvkkConsent}
              onChange={(e) => setKvkkConsent(e.target.checked)}
              className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              required
            />
            <label htmlFor="kvkkConsent" className="text-sm text-gray-700 dark:text-gray-300">
              6698 sayili KVKK kapsaminda, kimlik bilgilerim (ad, soyad, TC kimlik no), iletisim bilgilerim (telefon, adres) ve ozel nitelikli kisisel verilerim (siyasi parti uyeligi) dahil kisisel verilerimin; uyelik yonetimi, teskilat faaliyetleri, secim organizasyonu ve iletisim amaclarıyla islenmesine, Firebase (ABD - SCCs kapsaminda) ve SMS hizmet saglayicisina aktarilmasina <span className="font-medium">acik rizamla onay veriyorum</span>. Bu onayi diledigim zaman geri cekebilecegimi biliyorum.
              <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline ml-1">
                Aydinlatma Metni
              </a>
            </label>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
          >
            İptal
          </button>
          <button
            type="submit"
            className="px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
          >
            {member ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default MemberForm;