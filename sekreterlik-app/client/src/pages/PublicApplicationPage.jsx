import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const RATE_KEY = 'application_submissions';
const SUBMITTED_TCS_KEY = 'application_submitted_tcs';
const MAX_DAILY = 3;

// Kademeler
const LEVELS_REQUIRING_DISTRICT = [
  'ilce_yonetimi',
  'kadin_kollari',
  'genclik_kollari',
  'mahalle_temsilcisi',
  'basmusahit'
];

const PublicApplicationPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    tc: '',
    phone: '',
    district_id: '',
    town_id: '',
    neighborhood_id: '',
    village_id: '',
    ballot_number: '',
    application_level: '',
    reason: '',
    kvkk_consent: false,
  });
  const [districts, setDistricts] = useState([]);
  const [towns, setTowns] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [villages, setVillages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  // Dark mode detection
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(prefersDark);
    const handler = (e) => setDarkMode(e.matches);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Fetch districts/towns/neighborhoods/villages from Firestore
  useEffect(() => {
    const fetchAll = async () => {
      try {
        if (!db) return;
        const [dSnap, tSnap, nSnap, vSnap] = await Promise.all([
          getDocs(collection(db, 'districts')),
          getDocs(collection(db, 'towns')).catch(() => null),
          getDocs(collection(db, 'neighborhoods')).catch(() => null),
          getDocs(collection(db, 'villages')).catch(() => null),
        ]);
        const sortByName = (list) =>
          list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr'));

        const dList = dSnap ? dSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];
        sortByName(dList);
        setDistricts(dList);

        if (tSnap) {
          const tList = tSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          sortByName(tList);
          setTowns(tList);
        }
        if (nSnap) {
          const nList = nSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          sortByName(nList);
          setNeighborhoods(nList);
        }
        if (vSnap) {
          const vList = vSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          sortByName(vList);
          setVillages(vList);
        }
      } catch (err) {
        console.warn('Lokasyon verileri yuklenemedi:', err.message);
      }
    };
    fetchAll();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const next = { ...prev, [name]: type === 'checkbox' ? checked : value };

      // Cascade reset: kademe değişince ilçe/belde/mahalle/köy/sandık sıfırla
      if (name === 'application_level') {
        next.town_id = '';
        next.neighborhood_id = '';
        next.village_id = '';
        next.ballot_number = '';
      }
      // İlçe değişince alt seçimleri sıfırla
      if (name === 'district_id') {
        next.town_id = '';
        next.neighborhood_id = '';
        next.village_id = '';
      }
      // Belde değişince mahalle/köy sıfırla
      if (name === 'town_id') {
        next.neighborhood_id = '';
        next.village_id = '';
      }
      // Mahalle seçildiğinde köyü, köy seçildiğinde mahalleyi temizle (XOR)
      if (name === 'neighborhood_id' && value) {
        next.village_id = '';
      }
      if (name === 'village_id' && value) {
        next.neighborhood_id = '';
      }
      return next;
    });
    if (error) setError('');
  };

  // Cascade filtreler
  const filteredTowns = useMemo(() => {
    if (!formData.district_id) return [];
    return towns.filter(t => String(t.district_id) === String(formData.district_id));
  }, [towns, formData.district_id]);

  const filteredNeighborhoods = useMemo(() => {
    if (!formData.district_id) return [];
    return neighborhoods.filter(n => {
      const districtMatch = String(n.district_id) === String(formData.district_id);
      if (!districtMatch) return false;
      if (formData.town_id) {
        return String(n.town_id) === String(formData.town_id);
      }
      // Belde seçilmemişse: town_id'si boş/null olanlar (merkez mahalleleri)
      return !n.town_id;
    });
  }, [neighborhoods, formData.district_id, formData.town_id]);

  const filteredVillages = useMemo(() => {
    if (!formData.district_id) return [];
    return villages.filter(v => {
      const districtMatch = String(v.district_id) === String(formData.district_id);
      if (!districtMatch) return false;
      if (formData.town_id) {
        return String(v.town_id) === String(formData.town_id);
      }
      return !v.town_id;
    });
  }, [villages, formData.district_id, formData.town_id]);

  const validateTC = (tc) => {
    if (!tc || tc.length !== 11) return false;
    if (!/^\d{11}$/.test(tc)) return false;
    if (tc[0] === '0') return false;
    return true;
  };

  const validatePhone = (phone) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 11;
  };

  const checkRateLimit = () => {
    try {
      const submissions = JSON.parse(localStorage.getItem(RATE_KEY) || '[]');
      const today = new Date().toDateString();
      const todaySubmissions = submissions.filter(s => new Date(s).toDateString() === today);
      return todaySubmissions.length < MAX_DAILY;
    } catch {
      return true;
    }
  };

  const recordSubmission = () => {
    try {
      const submissions = JSON.parse(localStorage.getItem(RATE_KEY) || '[]');
      submissions.push(new Date().toISOString());
      localStorage.setItem(RATE_KEY, JSON.stringify(submissions));
    } catch {
      // Ignore localStorage errors
    }
  };

  // TC daha önce bu cihazdan başvurmuş mu?
  const hasSubmittedBefore = (tc) => {
    if (!tc) return false;
    try {
      const list = JSON.parse(localStorage.getItem(SUBMITTED_TCS_KEY) || '[]');
      return Array.isArray(list) && list.includes(String(tc).trim());
    } catch {
      return false;
    }
  };

  const recordSubmittedTC = (tc) => {
    if (!tc) return;
    try {
      const list = JSON.parse(localStorage.getItem(SUBMITTED_TCS_KEY) || '[]');
      const arr = Array.isArray(list) ? list : [];
      const t = String(tc).trim();
      if (!arr.includes(t)) arr.push(t);
      localStorage.setItem(SUBMITTED_TCS_KEY, JSON.stringify(arr));
    } catch {
      // ignore
    }
  };

  const isBasmusahit = formData.application_level === 'basmusahit';
  const isMahalleTemsilcisi = formData.application_level === 'mahalle_temsilcisi';
  const requiresDistrict = LEVELS_REQUIRING_DISTRICT.includes(formData.application_level);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name.trim()) {
      setError('Ad Soyad alanini doldurunuz.');
      return;
    }
    if (!validateTC(formData.tc)) {
      setError('Gecerli bir TC Kimlik Numarasi giriniz (11 hane).');
      return;
    }
    if (!validatePhone(formData.phone)) {
      setError('Gecerli bir telefon numarasi giriniz (10-11 hane).');
      return;
    }
    if (!formData.application_level) {
      setError('Lutfen basvurmak istediginiz kademeyi seciniz.');
      return;
    }

    // Kademe-spesifik zorunluluklar
    if (requiresDistrict && !formData.district_id) {
      setError('Bu kademe icin Ilce secimi zorunludur.');
      return;
    }
    if (isBasmusahit) {
      if (!formData.neighborhood_id && !formData.village_id) {
        setError('Basmusahit basvurusu icin Mahalle veya Koy secimi zorunludur.');
        return;
      }
    }
    if (isMahalleTemsilcisi) {
      if (!formData.neighborhood_id) {
        setError('Mahalle Temsilcisi basvurusu icin Mahalle secimi zorunludur.');
        return;
      }
    }

    if (!formData.kvkk_consent) {
      setError('KVKK metnini onaylamaniz gerekmektedir.');
      return;
    }

    // Rate limiting
    if (!checkRateLimit()) {
      setError('Gunluk basvuru limitine ulastiniz (3/gun). Lutfen yarin tekrar deneyiniz.');
      return;
    }

    // Aynı TC ile önceki başvuru kontrolü (cihaz bazlı, localStorage)
    if (hasSubmittedBefore(formData.tc)) {
      const proceed = window.confirm(
        `Bu T.C. Kimlik Numarası (${formData.tc}) ile daha önce başvuru yaptınız.\n\n` +
        'Yeniden başvurmak ister misiniz? (Önceki başvurunuz işleme alınmış olabilir)'
      );
      if (!proceed) {
        setError('Başvuru iptal edildi. Daha önce yaptığınız başvuru işleme alınmaktadır.');
        return;
      }
    }

    setLoading(true);
    try {
      if (!db) {
        throw new Error('Veritabani baglantisi kurulamadi.');
      }

      // Write application to Firestore
      await addDoc(collection(db, 'membership_applications'), {
        name: formData.name.trim(),
        tc: formData.tc.trim(),
        phone: formData.phone.trim(),
        district_id: formData.district_id || '',
        town_id: formData.town_id || '',
        neighborhood_id: formData.neighborhood_id || '',
        village_id: formData.village_id || '',
        ballot_number: formData.ballot_number ? formData.ballot_number.trim() : '',
        application_level: formData.application_level,
        reason: formData.reason.trim(),
        kvkk_consent: true,
        kvkk_consent_date: new Date().toISOString(),
        status: 'pending',
        created_at: serverTimestamp(),
        ip_address: '',
      });

      // Sadece admin'e bildirim gonder (tum uyelere DEGIL)
      try {
        var NotificationService = (await import('../services/NotificationService')).default;
        const levelLabels = {
          'il_yonetimi': 'İl Yönetimi',
          'ilce_yonetimi': 'İlçe Yönetimi',
          'kadin_kollari': 'Kadın Kolları',
          'genclik_kollari': 'Gençlik Kolları',
          'mahalle_temsilcisi': 'Mahalle Temsilcisi',
          'basmusahit': 'Başmüşahit'
        };
        const levelLabel = levelLabels[formData.application_level] || formData.application_level;
        await NotificationService.createNotification({
          title: 'Yeni Yönetim Başvurusu',
          body: formData.name.trim() + ' ' + levelLabel + ' için başvurdu',
          type: 'member_application',
          target: { type: 'role', value: 'admin' },
          url: '/settings?tab=membership-applications'
        });
      } catch (notifErr) {
        console.warn('Bildirim olusturulamadi:', notifErr.message);
      }
      try { /* backward compat placeholder */ } catch (masterNotifErr) {
        console.warn('Master bildirim olusturulamadi:', masterNotifErr.message);
      }

      recordSubmission();
      recordSubmittedTC(formData.tc);
      setSubmitted(true);
    } catch (err) {
      console.error('Basvuru hatasi:', err);
      setError('Basvuru gonderilirken bir hata olustu. Lutfen tekrar deneyiniz.');
    } finally {
      setLoading(false);
    }
  };

  const containerClass = darkMode ? 'bg-gray-900 text-gray-100' : 'bg-gray-50 text-gray-900';
  const cardClass = darkMode
    ? 'bg-gray-800 border-gray-700 shadow-lg'
    : 'bg-white border-gray-200 shadow-lg';
  const inputClass = darkMode
    ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500';
  const labelClass = darkMode ? 'text-gray-300' : 'text-gray-700';

  // Success state
  if (submitted) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 ${containerClass}`}>
        <div className={`max-w-md w-full rounded-2xl border p-8 text-center ${cardClass}`}>
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Basvurunuz Alindi</h2>
          <p className={`${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            En kisa surede degerlendirilecektir. Tesekkur ederiz.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 ${containerClass}`}>
      <div className={`max-w-lg w-full rounded-2xl border p-6 sm:p-8 ${cardClass}`}>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Parti Yönetim Kademesi Başvuru Formu</h1>
          <p className={`mt-1 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Asagidaki formu doldurarak uyelik basvurunuzu yapabilirsiniz.
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ad Soyad */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${labelClass}`}>
              Ad Soyad <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Adiniz Soyadiniz"
              className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors ${inputClass}`}
              required
            />
          </div>

          {/* TC Kimlik No */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${labelClass}`}>
              TC Kimlik Numarasi <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="tc"
              value={formData.tc}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                setFormData(prev => ({ ...prev, tc: val }));
                if (error) setError('');
              }}
              placeholder="11 haneli TC Kimlik No"
              maxLength={11}
              inputMode="numeric"
              className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors ${inputClass}`}
              required
            />
          </div>

          {/* Telefon */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${labelClass}`}>
              Telefon Numarasi <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                setFormData(prev => ({ ...prev, phone: val }));
                if (error) setError('');
              }}
              placeholder="05XX XXX XX XX"
              maxLength={11}
              inputMode="tel"
              className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors ${inputClass}`}
              required
            />
          </div>

          {/* Başvurulan Kademe */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${labelClass}`}>
              Başvurmak İstediğiniz Kademe <span className="text-red-500">*</span>
            </label>
            <select
              name="application_level"
              value={formData.application_level}
              onChange={handleChange}
              required
              className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors ${inputClass}`}
            >
              <option value="">Kademe seçiniz...</option>
              <option value="il_yonetimi">İl Yönetimi</option>
              <option value="ilce_yonetimi">İlçe Yönetimi</option>
              <option value="kadin_kollari">Kadın Kolları</option>
              <option value="genclik_kollari">Gençlik Kolları</option>
              <option value="mahalle_temsilcisi">Mahalle Temsilcisi</option>
              <option value="basmusahit">Başmüşahit</option>
            </select>
          </div>

          {/* Ilce Dropdown */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${labelClass}`}>
              İlçe {requiresDistrict && <span className="text-red-500">*</span>}
            </label>
            <select
              name="district_id"
              value={formData.district_id}
              onChange={handleChange}
              required={requiresDistrict}
              className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors ${inputClass}`}
            >
              <option value="">İlçe seçiniz...</option>
              {districts.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Belde — sadece basmusahit veya mahalle_temsilcisi'nde göster */}
          {(isBasmusahit || isMahalleTemsilcisi) && (
            <div>
              <label className={`block text-sm font-medium mb-1 ${labelClass}`}>
                Belde <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>(opsiyonel)</span>
              </label>
              <select
                name="town_id"
                value={formData.town_id}
                onChange={handleChange}
                disabled={!formData.district_id}
                className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors ${inputClass} ${!formData.district_id ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <option value="">Merkez (belde yok)</option>
                {filteredTowns.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {!formData.district_id && (
                <p className={`text-xs mt-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  Önce ilçe seçiniz.
                </p>
              )}
            </div>
          )}

          {/* Mahalle — basmusahit (mahalle VEYA köy zorunlu) ve mahalle_temsilcisi (zorunlu) */}
          {(isBasmusahit || isMahalleTemsilcisi) && (
            <div>
              <label className={`block text-sm font-medium mb-1 ${labelClass}`}>
                Mahalle {isMahalleTemsilcisi && <span className="text-red-500">*</span>}
                {isBasmusahit && (
                  <span className={`text-xs ml-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    (Mahalle veya Köy biri zorunlu)
                  </span>
                )}
              </label>
              <select
                name="neighborhood_id"
                value={formData.neighborhood_id}
                onChange={handleChange}
                disabled={!formData.district_id}
                required={isMahalleTemsilcisi}
                className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors ${inputClass} ${!formData.district_id ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <option value="">Mahalle seçiniz...</option>
                {filteredNeighborhoods.map(n => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Köy — sadece basmusahit'te */}
          {isBasmusahit && (
            <div>
              <label className={`block text-sm font-medium mb-1 ${labelClass}`}>
                Köy <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>(Mahalle yerine seçilebilir)</span>
              </label>
              <select
                name="village_id"
                value={formData.village_id}
                onChange={handleChange}
                disabled={!formData.district_id}
                className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors ${inputClass} ${!formData.district_id ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <option value="">Köy seçiniz...</option>
                {filteredVillages.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sandık No — sadece basmusahit, opsiyonel */}
          {isBasmusahit && (
            <div>
              <label className={`block text-sm font-medium mb-1 ${labelClass}`}>
                Sandık No <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>(opsiyonel)</span>
              </label>
              <input
                type="text"
                name="ballot_number"
                value={formData.ballot_number}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setFormData(prev => ({ ...prev, ballot_number: val }));
                  if (error) setError('');
                }}
                placeholder="Örn: 1042"
                inputMode="numeric"
                className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors ${inputClass}`}
              />
            </div>
          )}

          {/* Basvuru Nedeni */}
          <div>
            <label className={`block text-sm font-medium mb-1 ${labelClass}`}>
              Basvuru Nedeni
            </label>
            <textarea
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Basvuru nedeninizi yazabilirsiniz (opsiyonel)"
              rows={3}
              className={`w-full px-4 py-2.5 rounded-lg border text-sm transition-colors resize-none ${inputClass}`}
            />
          </div>

          {/* KVKK Onay */}
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              name="kvkk_consent"
              checked={formData.kvkk_consent}
              onChange={handleChange}
              id="kvkk_consent"
              className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="kvkk_consent" className={`text-sm cursor-pointer ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Kisisel verilerimin 6698 sayili KVKK kapsaminda islenmesini ve saklanmasini kabul ediyorum.{' '}
              <span className="text-red-500">*</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 px-4 rounded-lg text-white font-medium text-sm transition-all duration-200 ${
              loading
                ? 'bg-indigo-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-md hover:shadow-lg'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Gonderiliyor...
              </span>
            ) : (
              'Basvuruyu Gonder'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PublicApplicationPage;
