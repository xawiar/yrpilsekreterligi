import React, { useMemo, useRef, useState } from 'react';
import FirebaseApiService from '../utils/FirebaseApiService';
import { normalizePhotoUrl } from '../utils/photoUrlHelper';
import { useToast } from '../contexts/ToastContext';

/**
 * ProfilePhotoUpload
 * - Üyenin mevcut profil fotoğrafını dairesel avatar olarak gösterir.
 * - "Fotoğraf Değiştir" butonuyla JPG/PNG (max 2MB) seçilip Firebase Storage'a yüklenir.
 * - Yükleme sonrası members/{memberId}.photo alanı URL ile güncellenir.
 * - Eski fotoğraf Storage'dan silinmeye çalışılır (başarısızlık yutulur).
 *
 * Props:
 *   memberId: string|number  - Üye ID
 *   currentPhotoUrl: string  - Mevcut fotoğraf URL (opsiyonel)
 *   memberName: string       - Baş harf fallback için (opsiyonel)
 *   onPhotoUpdated: (url:string) => void  - Parent state güncellemesi için
 */
const ALLOWED_TYPES = ['image/jpeg', 'image/png'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const ProfilePhotoUpload = ({ memberId, currentPhotoUrl, memberName = '', onPhotoUpdated }) => {
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [localPhoto, setLocalPhoto] = useState(currentPhotoUrl || null);

  const normalizedPhoto = useMemo(
    () => (localPhoto ? normalizePhotoUrl(localPhoto) : null),
    [localPhoto]
  );

  const initial = (memberName || '').trim().charAt(0).toUpperCase() || '?';

  const handlePickFile = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    // Input'u resetle (aynı dosyayı tekrar seçebilmek için)
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Sadece JPG veya PNG formatı kabul edilir');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('Dosya boyutu 2MB\'dan küçük olmalıdır');
      return;
    }
    if (!memberId) {
      toast.error('Üye bilgisi bulunamadı');
      return;
    }

    try {
      setUploading(true);
      const result = await FirebaseApiService.uploadProfilePhoto(memberId, file);
      if (result?.success && result.url) {
        setLocalPhoto(result.url);
        toast.success('Profil fotoğrafı güncellendi');
        if (typeof onPhotoUpdated === 'function') {
          onPhotoUpdated(result.url);
        }
      } else {
        toast.error(result?.message || 'Fotoğraf yüklenemedi');
      }
    } catch (err) {
      console.error('ProfilePhotoUpload error:', err);
      toast.error('Fotoğraf yüklenirken bir hata oluştu');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="h-32 w-32 rounded-full border-4 border-white dark:border-gray-800 shadow-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center overflow-hidden">
          {normalizedPhoto ? (
            <img
              src={normalizedPhoto}
              alt={memberName || 'Profil fotoğrafı'}
              className="h-full w-full object-cover"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                if (e.currentTarget.nextSibling) {
                  e.currentTarget.nextSibling.style.display = 'flex';
                }
              }}
            />
          ) : null}
          <span
            className={`text-indigo-800 dark:text-indigo-200 text-4xl font-semibold ${normalizedPhoto ? 'hidden' : 'flex'} h-full w-full items-center justify-center`}
          >
            {initial}
          </span>
        </div>

        {uploading && (
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
            <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={handlePickFile}
        disabled={uploading}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-900 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {uploading ? 'Yükleniyor...' : 'Fotoğraf Değiştir'}
      </button>

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        JPG veya PNG, maksimum 2MB
      </p>
    </div>
  );
};

export default ProfilePhotoUpload;
