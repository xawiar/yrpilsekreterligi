import React, { useState } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import ApiService from '../utils/ApiService';
import ProtocolOCRService from '../services/ProtocolOCRService';
import { queueOfflineResult } from '../utils/offlineQueue';

// Köylü dostu, 3 aşamalı tek-ekran sonuç giriş formu.
// Genel seçimde CB → MV sırayla; diğer seçimlerde tek aşama.
const ChiefObserverQuickForm = ({
  election,
  ballotBoxId,
  ballotNumber,
  onClose,
  onSuccess,
  onSwitchToAdvanced, // detaylı düzenleme isteyenler için çıkış
}) => {
  const { user } = useAuth();
  const isGenel = election?.type === 'genel';

  // Stage machine
  const [stage, setStage] = useState('photo'); // photo | review | success
  // Genel seçimde önce CB sonra MV — diğerlerinde null
  const [category, setCategory] = useState(isGenel ? 'cb' : null);

  // Photo
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // OCR / form
  const [aiRunning, setAiRunning] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [formData, setFormData] = useState({});
  const [warnings, setWarnings] = useState([]);

  // Save
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Edit modal
  const [editing, setEditing] = useState(null); // { label, value, onSave }

  // Genel seçimde CB tamamlandığında MV'ye geçerken CB veriyi tut
  const [cbData, setCbData] = useState(null);

  // -----------------------------------------------------------------
  // Foto seç + parallel upload + parallel OCR
  // -----------------------------------------------------------------
  const handlePhotoSelect = async (file) => {
    if (!file) return;
    setError(null);
    setWarnings([]);

    // 1) Lokal data URL (OCR ve önizleme için)
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    }).catch(() => null);
    if (!dataUrl) {
      setError('Fotoğraf okunamadı, tekrar deneyin.');
      return;
    }
    setPhotoDataUrl(dataUrl);
    setStage('review');

    // 2) Storage'a paralel upload (kullanıcı beklemesin)
    if (navigator.onLine) {
      uploadPhoto(file).catch((e) => {
        console.warn('[QuickForm] Photo upload failed:', e);
      });
    }

    // 3) OCR paralel başlat
    runAI(dataUrl);
  };

  const uploadPhoto = async (file) => {
    try {
      const timestamp = Date.now();
      const subtype = category === 'mv' ? 'mv_signed' : 'signed';
      const fileName = `election_results/${election.id}/${ballotBoxId}/${subtype}_${timestamp}_${file.name}`;
      const sref = ref(storage, fileName);
      const task = uploadBytesResumable(sref, file, {
        contentType: file.type,
        customMetadata: {
          electionId: String(election.id),
          ballotBoxId: String(ballotBoxId),
          type: subtype,
          uploadedAt: new Date().toISOString(),
        },
      });
      task.on('state_changed', (snap) => {
        const p = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setUploadProgress(p);
      });
      await task;
      const url = await getDownloadURL(sref);
      setPhotoUrl(url);
    } catch (e) {
      console.warn('[QuickForm] Storage upload error:', e);
    }
  };

  const runAI = async (photoSource) => {
    if (!photoSource) return;
    try {
      setAiRunning(true);
      const electionInfo = {
        type: election.type,
        cb_candidates: election.cb_candidates || [],
        parties: election.parties || [],
        independent_cb_candidates: election.independent_cb_candidates || [],
        independent_mv_candidates: election.independent_mv_candidates || [],
        mayor_candidates: election.mayor_candidates || [],
        mayor_parties: election.mayor_parties || [],
        provincial_assembly_parties: election.provincial_assembly_parties || [],
        municipal_council_parties: election.municipal_council_parties || [],
        is_village: false,
        is_metropolitan: election.is_metropolitan || false,
        focus: category || null,
      };
      const extracted = await ProtocolOCRService.readProtocol(photoSource, electionInfo);

      // Tutanak tipi mismatch uyarısı (block etmez, sadece banner)
      const detected = (extracted?.tutanak_tipi || '').toLowerCase().trim();
      const expectedMap = { cb: 'cb', mv: 'mv' };
      const expected = expectedMap[category || ''];
      const newWarnings = [];
      if (expected && detected && detected !== expected) {
        const lbl = { cb: 'CB', mv: 'MV', mayor: 'Belediye Başkanı', other: 'tanımsız' };
        newWarnings.push(
          `⚠ Bu, ${lbl[expected]} tutanağı olması lazım ama AI "${lbl[detected] || detected}" gibi okudu. Tutanak doğru mu kontrol et.`
        );
      }

      const safe = { ...extracted };
      delete safe.tutanak_tipi;
      setFormData(safe);
      setWarnings(newWarnings);
      setAiDone(true);
    } catch (e) {
      console.error('[QuickForm] OCR error:', e);
      setError('AI okuma yapılamadı, sayıları kendin gir.');
      setAiDone(true);
    } finally {
      setAiRunning(false);
    }
  };

  // -----------------------------------------------------------------
  // Edit modal — numpad
  // -----------------------------------------------------------------
  const openEdit = (label, value, onSave) => {
    setEditing({ label, value: String(value ?? ''), onSave });
  };
  const closeEdit = () => setEditing(null);
  const saveEdit = () => {
    if (!editing) return;
    const n = parseInt(editing.value, 10);
    editing.onSave(isNaN(n) ? 0 : n);
    closeEdit();
  };

  // -----------------------------------------------------------------
  // Submit
  // -----------------------------------------------------------------
  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      // Storage upload bitmediyse bekle (max 30sn)
      let finalPhotoUrl = photoUrl;
      const start = Date.now();
      while (!finalPhotoUrl && navigator.onLine && Date.now() - start < 30000) {
        await new Promise((r) => setTimeout(r, 500));
        finalPhotoUrl = photoUrl;
      }

      // Önceki CB verisini de ekle (genel seçim MV aşaması)
      const merged = isGenel && cbData ? { ...cbData, ...formData } : formData;

      const submitData = {
        ...merged,
        election_id: election.id,
        ballot_box_id: ballotBoxId,
        ballot_number: ballotNumber,
        filled_by_ai: true,
        _category: category, // FirebaseApiService kullanır, Firestore'a yazılmaz
      };

      // Foto URL'i kategoriye göre yaz
      if (category === 'mv') {
        if (finalPhotoUrl) submitData.signed_mv_protocol_photo = finalPhotoUrl;
      } else {
        if (finalPhotoUrl) submitData.signed_protocol_photo = finalPhotoUrl;
      }

      // Offline kuyruğu
      if (!navigator.onLine) {
        await queueOfflineResult(submitData);
        proceedAfterSave({ offline: true });
        return;
      }

      const res = await ApiService.createElectionResult(submitData);
      if (res?.success === false) {
        throw new Error(res.message || res.errors?.join(', ') || 'Kaydedilemedi');
      }
      proceedAfterSave({ offline: false });
    } catch (e) {
      console.error('[QuickForm] submit error:', e);
      setError(e.message || 'Bilinmeyen hata');
    } finally {
      setSaving(false);
    }
  };

  const proceedAfterSave = ({ offline }) => {
    // Genel seçim CB bitti → MV'ye geç
    if (isGenel && category === 'cb') {
      setCbData(formData);
      setCategory('mv');
      setStage('photo');
      setPhotoDataUrl(null);
      setPhotoUrl(null);
      setUploadProgress(0);
      setAiDone(false);
      setFormData({});
      setWarnings([]);
      return;
    }
    setStage('success');
    setTimeout(() => {
      if (onSuccess) onSuccess({ offline });
      if (onClose) onClose();
    }, 1800);
  };

  // -----------------------------------------------------------------
  // Render — Stage components
  // -----------------------------------------------------------------
  const categoryLabel =
    category === 'cb' ? 'CUMHURBAŞKANI'
      : category === 'mv' ? 'MİLLETVEKİLİ'
      : '';

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-700 text-white px-4 py-3 flex items-center justify-between flex-shrink-0 shadow">
        <div>
          <div className="text-xs opacity-80">Sandık {ballotNumber || '-'}</div>
          <div className="text-base font-bold">
            {election?.name || 'Seçim'}
            {isGenel && <span className="ml-2 px-2 py-0.5 bg-indigo-900 rounded text-xs">{categoryLabel}</span>}
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xl"
          aria-label="Kapat"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {stage === 'photo' && (
          <PhotoStage
            categoryLabel={categoryLabel}
            isGenel={isGenel}
            onPick={handlePhotoSelect}
            onSwitchToAdvanced={onSwitchToAdvanced}
          />
        )}
        {stage === 'review' && (
          <ReviewStage
            photoDataUrl={photoDataUrl}
            uploadProgress={uploadProgress}
            aiRunning={aiRunning}
            aiDone={aiDone}
            warnings={warnings}
            formData={formData}
            setFormData={setFormData}
            openEdit={openEdit}
            category={category}
            election={election}
            isGenel={isGenel}
            onRetake={() => {
              setStage('photo');
              setPhotoDataUrl(null);
              setPhotoUrl(null);
              setUploadProgress(0);
              setAiDone(false);
              setFormData({});
              setWarnings([]);
              setError(null);
            }}
            onSubmit={handleSubmit}
            saving={saving}
            error={error}
            onSwitchToAdvanced={onSwitchToAdvanced}
          />
        )}
        {stage === 'success' && (
          <SuccessStage isGenel={isGenel} category={category} />
        )}
      </div>

      {/* Inline Numpad Edit Modal */}
      {editing && (
        <NumpadModal
          label={editing.label}
          value={editing.value}
          onChange={(v) => setEditing((e) => ({ ...e, value: v }))}
          onSave={saveEdit}
          onCancel={closeEdit}
        />
      )}
    </div>
  );
};

// =============================================================
// Stage 1 — Photo
// =============================================================
const PhotoStage = ({ categoryLabel, isGenel, onPick, onSwitchToAdvanced }) => (
  <div className="p-6 flex flex-col items-center justify-center min-h-full">
    <div className="text-center mb-6">
      <div className="text-6xl mb-2">📷</div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        Tutanak Fotosu
      </h2>
      <p className="text-gray-600 dark:text-gray-400">
        {isGenel
          ? `${categoryLabel} tutanağının fotoğrafını çek`
          : 'İmzalı tutanağın fotoğrafını çek'}
      </p>
    </div>

    {/* Kamera tetiklemenin en güvenilir yolu: label içinde input + capture.
        Programatik click() bazı tarayıcılarda capture ipucunu kaybediyor. */}
    <label
      className="w-full max-w-md mb-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xl font-bold rounded-2xl py-6 shadow-lg active:scale-95 transition flex items-center justify-center gap-3 cursor-pointer"
    >
      <span>📸</span>
      <span>FOTO ÇEK</span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
    </label>

    {/* Galeriden seç — capture attribute YOK, sadece dosya seçici */}
    <label
      className="w-full max-w-md bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-xl py-3 flex items-center justify-center gap-2 cursor-pointer"
    >
      <span>🖼 Galeriden seç</span>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
    </label>

    {onSwitchToAdvanced && (
      <button
        type="button"
        onClick={onSwitchToAdvanced}
        className="mt-6 text-sm text-gray-500 underline"
      >
        Detaylı düzenleme moduna geç
      </button>
    )}
  </div>
);

// =============================================================
// Stage 2 — Review
// =============================================================
const ReviewStage = ({
  photoDataUrl,
  uploadProgress,
  aiRunning,
  aiDone,
  warnings,
  formData,
  setFormData,
  openEdit,
  category,
  election,
  isGenel,
  onRetake,
  onSubmit,
  saving,
  error,
  onSwitchToAdvanced,
}) => {
  // Toplam alanları kategori-bazlı çek (genel: cb_used / mv_used; diğer: used)
  const totalKey = category === 'cb' ? 'cb_' : category === 'mv' ? 'mv_' : '';
  const used = formData[`${totalKey}used_votes`] ?? formData.used_votes ?? 0;
  const valid = formData[`${totalKey}valid_votes`] ?? formData.valid_votes ?? 0;
  const invalid = formData[`${totalKey}invalid_votes`] ?? formData.invalid_votes ?? 0;

  const setNumber = (key, n) => {
    setFormData((p) => ({ ...p, [key]: n }));
  };

  // Vote map alanı — kategoriye göre
  const voteFieldKey =
    category === 'cb' ? 'cb_votes'
      : category === 'mv' ? 'mv_votes'
      : 'mv_votes';
  const voteMap = formData[voteFieldKey] || {};
  const updateVote = (key, n) => {
    setFormData((p) => ({
      ...p,
      [voteFieldKey]: { ...(p[voteFieldKey] || {}), [key]: n },
    }));
  };

  return (
    <div className="p-4 space-y-4">
      {/* Foto thumb */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
        <img
          src={photoDataUrl}
          alt="Tutanak"
          className="w-full max-h-48 object-contain rounded"
        />
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mt-2 h-1 bg-gray-200 rounded overflow-hidden">
            <div className="h-full bg-indigo-600 transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
        )}
      </div>

      {/* AI status */}
      {aiRunning && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent" />
          <span className="text-blue-800 font-medium">AI tutanağı okuyor...</span>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded">
          {warnings.map((w, i) => (
            <p key={i} className="text-amber-900 font-medium text-sm">{w}</p>
          ))}
        </div>
      )}

      {/* Top numbers */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">Sayılar</h3>
        <div className="grid grid-cols-3 gap-2">
          <NumberCard
            label="Kullanılan"
            value={used}
            onClick={() => openEdit('Kullanılan oy', used, (n) =>
              setNumber(`${totalKey}used_votes`, n)
            )}
          />
          <NumberCard
            label="Geçerli"
            value={valid}
            onClick={() => openEdit('Geçerli oy', valid, (n) =>
              setNumber(`${totalKey}valid_votes`, n)
            )}
          />
          <NumberCard
            label="Geçersiz"
            value={invalid}
            onClick={() => openEdit('Geçersiz oy', invalid, (n) =>
              setNumber(`${totalKey}invalid_votes`, n)
            )}
          />
        </div>
      </div>

      {/* Vote table */}
      {aiDone && Object.keys(voteMap).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">
            {category === 'cb' ? 'Cumhurbaşkanı Oyları' :
              category === 'mv' ? 'Milletvekili Oyları' :
              'Oylar'}
          </h3>
          <div className="space-y-1">
            {Object.entries(voteMap).map(([key, v]) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  openEdit(key, v, (n) => updateVote(key, n))
                }
                className="w-full flex items-center justify-between py-3 px-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 active:bg-gray-100"
              >
                <span className="text-base text-gray-800 dark:text-gray-200 flex-1 text-left truncate">{key}</span>
                <span className="text-lg font-bold text-indigo-700 dark:text-indigo-400">
                  {parseInt(v) || 0}
                </span>
                <span className="ml-2 text-gray-400">✏️</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty vote table — AI bulamadı */}
      {aiDone && Object.keys(voteMap).length === 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded">
          <p className="text-amber-900 text-sm">
            AI parti/aday oylarını okuyamadı. Aşağıdan manuel giriş yapabilir veya
            detaylı moda geçebilirsin.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded">
          <p className="text-red-900 font-medium">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 pt-3 pb-4 -mx-4 px-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={onSubmit}
          disabled={saving || aiRunning}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-xl font-bold rounded-2xl py-5 shadow-lg active:scale-95 transition flex items-center justify-center gap-3"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
              <span>Gönderiliyor...</span>
            </>
          ) : (
            <>
              <span>✅</span>
              <span>{isGenel && category === 'cb' ? 'CB DOĞRU, MV YE GEÇ' : 'DOĞRU, GÖNDER'}</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onRetake}
          disabled={saving}
          className="mt-2 w-full bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl py-3 font-medium"
        >
          📷 Yeniden çek
        </button>
        {onSwitchToAdvanced && (
          <button
            type="button"
            onClick={onSwitchToAdvanced}
            className="mt-2 w-full text-sm text-gray-500 underline"
          >
            Detaylı düzenleme moduna geç
          </button>
        )}
      </div>
    </div>
  );
};

// =============================================================
// Stage 3 — Success
// =============================================================
const SuccessStage = ({ isGenel, category }) => (
  <div className="flex flex-col items-center justify-center min-h-full p-6">
    <div className="text-7xl mb-4">✅</div>
    <h2 className="text-2xl font-bold text-green-700 mb-2">Gönderildi</h2>
    <p className="text-gray-600 dark:text-gray-400 text-center">
      {isGenel && category === 'cb'
        ? 'CB sonucu kaydedildi. Şimdi MV tutanağına geçiyoruz...'
        : 'Sonuç başarıyla gönderildi. Sorumlu onayına gönderildi.'}
    </p>
  </div>
);

// =============================================================
// Small components
// =============================================================
const NumberCard = ({ label, value, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg p-3 active:scale-95 transition text-center"
  >
    <div className="text-xs text-gray-500 uppercase mb-1">{label}</div>
    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value ?? 0}</div>
  </button>
);

const NumpadModal = ({ label, value, onChange, onSave, onCancel }) => {
  const appendDigit = (d) => onChange((value || '') + d);
  const backspace = () => onChange((value || '').slice(0, -1));
  const clear = () => onChange('');

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-800 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3">
          <div className="text-sm text-gray-500 truncate">{label}</div>
          <div className="text-4xl font-bold text-center bg-gray-50 dark:bg-gray-900 rounded-lg py-3 mt-1">
            {value || '0'}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => appendDigit(String(n))}
              className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 active:bg-gray-300 rounded-lg py-4 text-xl font-bold"
            >
              {n}
            </button>
          ))}
          <button type="button" onClick={clear} className="bg-amber-100 hover:bg-amber-200 rounded-lg py-4 text-lg font-bold text-amber-800">
            C
          </button>
          <button type="button" onClick={() => appendDigit('0')} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 rounded-lg py-4 text-xl font-bold">
            0
          </button>
          <button type="button" onClick={backspace} className="bg-red-100 hover:bg-red-200 rounded-lg py-4 text-lg font-bold text-red-800">
            ⌫
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button type="button" onClick={onCancel} className="bg-gray-200 hover:bg-gray-300 rounded-lg py-3 font-medium">
            İptal
          </button>
          <button type="button" onClick={onSave} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-3 font-bold">
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChiefObserverQuickForm;
