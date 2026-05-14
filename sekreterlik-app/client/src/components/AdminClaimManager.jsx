import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';
import { useToast } from '../contexts/ToastContext';

/**
 * Admin yetki yönetim paneli.
 *
 * 1) İlk admin (bootstrap): Firebase Functions secret'inde tanımlı
 *    BOOTSTRAP_ADMIN_EMAIL ile login olan kullanıcı, "Kendime admin yetkisi
 *    ver" butonuna tıklayarak custom claim alır.
 * 2) Mevcut admin: başka kullanıcılara UID girerek admin atayabilir/kaldırabilir.
 *
 * Custom claim atandıktan sonra kullanıcının token'ını yenilemesi gerekir
 * (re-login veya getIdToken(true)) — bu paneli açan kullanıcıya hatırlatılır.
 */
const AdminClaimManager = () => {
  const toast = useToast();
  const [checking, setChecking] = useState(false);
  const [granting, setGranting] = useState(false);
  const [me, setMe] = useState({ uid: null, email: null, admin: null });
  const [targetUid, setTargetUid] = useState('');
  const [targetAdmin, setTargetAdmin] = useState(true);

  const checkMyClaim = async () => {
    if (!auth?.currentUser) {
      toast.error('Önce giriş yapın');
      return;
    }
    try {
      setChecking(true);
      // Token'ı zorla yenile — son claim'leri görmek için
      await auth.currentUser.getIdToken(true);
      const checkAdminClaim = httpsCallable(functions, 'checkAdminClaim');
      const result = await checkAdminClaim();
      const data = result.data || {};
      setMe({ uid: data.uid, email: data.email, admin: !!data.admin });
      if (data.admin) {
        toast.success('Admin yetkin var.');
      } else {
        toast.warning('Şu an admin yetkin yok.');
      }
    } catch (err) {
      console.error('checkAdminClaim error:', err);
      toast.error('Yetki kontrolü hatası: ' + (err.message || 'bilinmeyen'));
    } finally {
      setChecking(false);
    }
  };

  const grantSelfAdmin = async () => {
    if (!auth?.currentUser) {
      toast.error('Önce giriş yapın');
      return;
    }
    try {
      setGranting(true);
      const setAdminClaim = httpsCallable(functions, 'setAdminClaim');
      await setAdminClaim({ uid: auth.currentUser.uid, admin: true });
      // Token yenile, claim aktif olsun
      await auth.currentUser.getIdToken(true);
      toast.success('Admin yetkisi alındı. Sayfa yenileniyor...');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      console.error('grantSelfAdmin error:', err);
      const msg = err.code === 'functions/permission-denied'
        ? 'Bootstrap email değilsiniz veya admin yetkiniz yok. Doğru email ile giriş yapın.'
        : 'Yetki atama hatası: ' + (err.message || 'bilinmeyen');
      toast.error(msg);
    } finally {
      setGranting(false);
    }
  };

  const grantToOther = async () => {
    const uid = targetUid.trim();
    if (!uid) {
      toast.error('Hedef kullanıcının UID\'sini girin');
      return;
    }
    try {
      setGranting(true);
      const setAdminClaim = httpsCallable(functions, 'setAdminClaim');
      const result = await setAdminClaim({ uid, admin: targetAdmin });
      const data = result.data || {};
      toast.success(
        targetAdmin
          ? `${data.email || uid} kullanıcısına admin yetkisi verildi`
          : `${data.email || uid} kullanıcısının admin yetkisi kaldırıldı`
      );
      setTargetUid('');
    } catch (err) {
      console.error('grantToOther error:', err);
      const msg = err.code === 'functions/permission-denied'
        ? 'Bu işlem için admin yetkisi gerekli. Önce kendinize yetki alın.'
        : err.code === 'functions/not-found'
          ? 'Bu UID ile kullanıcı bulunamadı'
          : 'Yetki atama hatası: ' + (err.message || 'bilinmeyen');
      toast.error(msg);
    } finally {
      setGranting(false);
    }
  };

  useEffect(() => {
    // Sayfa yüklenince mevcut yetkiyi otomatik kontrol et
    if (auth?.currentUser) {
      checkMyClaim();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Admin Yetki Yönetimi
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Push bildirim gönderme gibi admin işlemleri için custom claim kontrolü.
        </p>
      </div>

      {/* Mevcut yetki durumu */}
      <div className={`p-4 rounded-lg mb-4 border-2 ${
        me.admin === true
          ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
          : me.admin === false
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700'
            : 'bg-gray-50 dark:bg-gray-900/20 border-gray-300 dark:border-gray-700'
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {me.admin === true ? '✅ Admin yetkiniz var' : me.admin === false ? '⚠️ Admin yetkiniz yok' : '⏳ Yetki durumu kontrol edilmedi'}
            </div>
            {me.email && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {me.email} <span className="font-mono opacity-60">({me.uid?.slice(0, 8)}...)</span>
              </div>
            )}
          </div>
          <button
            onClick={checkMyClaim}
            disabled={checking}
            className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {checking ? 'Kontrol ediliyor...' : 'Yenile'}
          </button>
        </div>
      </div>

      {/* Bootstrap: kendine admin yetki ver */}
      {me.admin === false && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <div className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
            Bootstrap: Kendinize admin yetkisi alın
          </div>
          <p className="text-xs text-blue-800 dark:text-blue-200 mb-3 leading-relaxed">
            Eğer Cloud Functions'ta tanımlı bootstrap email ile login olduysanız, aşağıdaki butonla kendinize admin yetkisi atayabilirsiniz. Diğer kullanıcılar için hata alırsınız — onlara mevcut admin yetkisi atamalı.
          </p>
          <button
            onClick={grantSelfAdmin}
            disabled={granting}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {granting ? 'İşleniyor...' : 'Kendime Admin Yetkisi Ver'}
          </button>
        </div>
      )}

      {/* Başka kullanıcıya admin yetki */}
      {me.admin === true && (
        <div className="p-4 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Başka kullanıcıya admin yetkisi
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Hedef Kullanıcı UID
              </label>
              <input
                type="text"
                value={targetUid}
                onChange={(e) => setTargetUid(e.target.value)}
                placeholder="Firebase Auth UID (Authentication → Users → User UID)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm font-mono text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Firebase Console → Authentication → Users → ilgili kullanıcı → User UID kopyalayın.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  checked={targetAdmin}
                  onChange={() => setTargetAdmin(true)}
                  className="text-indigo-600"
                />
                Yetki ver
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  checked={!targetAdmin}
                  onChange={() => setTargetAdmin(false)}
                  className="text-red-600"
                />
                Yetki kaldır
              </label>
            </div>
            <button
              onClick={grantToOther}
              disabled={granting || !targetUid.trim()}
              className={`px-4 py-2 font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                targetAdmin
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {granting ? 'İşleniyor...' : (targetAdmin ? 'Admin Yetkisi Ver' : 'Admin Yetkisi Kaldır')}
            </button>
          </div>
          <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded text-xs text-amber-900 dark:text-amber-100">
            <strong>Not:</strong> Yetki atadığınız kullanıcı bir sonraki girişinde (veya token yenilendiğinde) admin haklarına sahip olur.
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClaimManager;
