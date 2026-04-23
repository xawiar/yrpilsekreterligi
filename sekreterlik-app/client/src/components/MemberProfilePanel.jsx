import React from 'react';
import ProfilePhotoUpload from './ProfilePhotoUpload';
import BiographyEditor from './BiographyEditor';

/**
 * MemberProfilePanel
 * Üyenin "Profilim" paneli:
 * - Üstte büyük dairesel profil fotoğrafı + "Fotoğraf Değiştir" butonu
 * - Altında okunabilir, hassas alanları maskelenmiş üye bilgileri
 * - "Değişiklik Talep Et" butonu (TC/telefon için) — ikinci ajan modal'ı bağlayacak
 *
 * Props:
 *   member: {
 *     id, name, tc_kimlik_no (veya tc), phone, region_name (veya region),
 *     position_name (veya position), photo
 *   }
 *   onRequestChange?: () => void    - Tıklamada çağrılır (opsiyonel)
 *   onPhotoUpdated?: (url) => void  - Yeni fotoğraf URL'i parent'e iletir
 */

// Son 4 hane GİZLENİR (örn: 12345****89 -> ilk 5 açık, sonraki 4 gizli, son 2 açık)
// Kullanıcının isteğindeki örnek: 12345****89 (11 haneli TC için son 4 maskeli, orta ise)
// "TC (son 4 hane maskelenir)" → son 4 kapalı. Ancak örnek "12345****89" son 2 açık.
// Örneği referans alıyoruz: ilk 5 + 4 yıldız + son 2.
const maskTC = (tc) => {
  if (!tc) return '';
  const s = String(tc).replace(/\s+/g, '');
  if (s.length < 7) return s;
  const head = s.slice(0, 5);
  const tail = s.slice(-2);
  return `${head}****${tail}`;
};

// Telefon: ortası maskelenir. Örn verilen: 0532***8765
const maskPhone = (phone) => {
  if (!phone) return '';
  const s = String(phone).replace(/\s+/g, '');
  if (s.length < 7) return s;
  const head = s.slice(0, 4);
  const tail = s.slice(-4);
  return `${head}***${tail}`;
};

const InfoRow = ({ label, value, muted = false }) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-2.5 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
    <span className="text-xs uppercase tracking-wide font-medium text-gray-500 dark:text-gray-400">
      {label}
    </span>
    <span
      className={`text-sm font-medium ${muted ? 'text-gray-600 dark:text-gray-300' : 'text-gray-900 dark:text-gray-100'} sm:text-right break-all`}
    >
      {value || <span className="italic text-gray-400 dark:text-gray-500">Bilgi yok</span>}
    </span>
  </div>
);

const MemberProfilePanel = ({ member, onRequestChange, onPhotoUpdated, onBiographyUpdated }) => {
  if (!member) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
          Üye bilgisi yükleniyor...
        </p>
      </div>
    );
  }

  const tc = member.tc_kimlik_no || member.tc || member.tckn || '';
  const phone = member.phone || member.telephone || member.mobile || '';
  const region =
    member.region_name || member.region || member.regionLabel || '';
  const position =
    member.position_name || member.position || member.positionLabel || '';
  const fullName = member.name || `${member.first_name || ''} ${member.last_name || ''}`.trim();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      {/* Başlık bandı */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-indigo-700 dark:to-indigo-900 px-6 py-5">
        <h2 className="text-lg font-semibold text-white">Profilim</h2>
        <p className="text-xs text-indigo-100 mt-0.5">
          Kişisel bilgilerinizi görüntüleyin ve profil fotoğrafınızı güncelleyin
        </p>
      </div>

      {/* Fotoğraf alanı */}
      <div className="px-6 pt-6 pb-4">
        <ProfilePhotoUpload
          memberId={member.id}
          currentPhotoUrl={member.photo}
          memberName={fullName}
          onPhotoUpdated={onPhotoUpdated}
        />
      </div>

      {/* Bilgi listesi */}
      <div className="px-6 pb-4">
        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <InfoRow label="Ad Soyad" value={fullName} />
          <InfoRow label="TC Kimlik No" value={maskTC(tc)} muted />
          <InfoRow label="Telefon" value={maskPhone(phone)} muted />
          <InfoRow label="Bölge" value={region} />
          <InfoRow label="Görev" value={position} />
        </div>
      </div>

      {/* Özgeçmiş editörü */}
      <div className="px-6 pb-4">
        <BiographyEditor
          memberId={member.id}
          initialValue={member.biography || ''}
          onSaved={onBiographyUpdated}
        />
      </div>

      {/* Bilgi + değişiklik talebi */}
      <div className="px-6 pb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M12 20a8 8 0 100-16 8 8 0 000 16z"
              />
            </svg>
            <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
              TC veya telefon numaranızı değiştirmek için yetkililere talep göndermeniz gerekir.
              Değişiklik onaylandığında bilgileriniz güncellenecektir.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (typeof onRequestChange === 'function') onRequestChange();
            }}
            disabled={typeof onRequestChange !== 'function'}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 dark:focus:ring-offset-gray-900 transition-colors whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Değişiklik Talep Et
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemberProfilePanel;
