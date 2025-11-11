import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import { decryptData } from '../utils/crypto';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import FirebaseService from '../services/FirebaseService';

const MemberUsersSettings = () => {
  const [memberUsers, setMemberUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [towns, setTowns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  // Şifre düzenleme özelliği kaldırıldı
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    memberId: '',
    username: '',
    password: ''
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSyncingToAuth, setIsSyncingToAuth] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    username: '',
    password: ''
  });

  useEffect(() => {
    fetchMemberUsers();
    fetchMembers();
    fetchTowns();
  }, []);

  const fetchMemberUsers = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getMemberUsers();
      if (response.success) {
        setMemberUsers(response.users);
      } else {
        setMessage('Üye kullanıcıları alınamadı');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error fetching member users:', error);
      setMessage('Üye kullanıcıları alınırken hata oluştu');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const response = await ApiService.getMembers();
      setMembers(response);
    } catch (error) {
      console.error('Error fetching members:', error);
    }
  };

  const fetchTowns = async () => {
    try {
      const response = await ApiService.getTowns();
      setTowns(response || []);
    } catch (error) {
      console.error('Error fetching towns:', error);
    }
  };

  const handleEditUser = (user) => {
    // Şifreyi decrypt et
    let decryptedPassword = user.password || '';
    try {
      if (decryptedPassword && typeof decryptedPassword === 'string' && decryptedPassword.startsWith('U2FsdGVkX1')) {
        decryptedPassword = decryptData(decryptedPassword);
      }
    } catch (error) {
      console.error('Error decrypting password:', error);
    }
    
    setEditingUser(user);
    setEditForm({
      username: user.username || '',
      password: decryptedPassword
    });
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditForm({ username: '', password: '' });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    
    if (!editingUser) return;
    
    if (!editForm.username || !editForm.password) {
      setMessage('Kullanıcı adı ve şifre zorunludur');
      setMessageType('error');
      return;
    }

    try {
      const response = await ApiService.updateMemberUser(
        editingUser.id,
        editForm.username,
        editForm.password
      );
      
      if (response.success) {
        setMessage('Kullanıcı bilgileri başarıyla güncellendi');
        setMessageType('success');
        setEditingUser(null);
        setEditForm({ username: '', password: '' });
        await fetchMemberUsers();
      } else {
        setMessage(response.message || 'Kullanıcı güncellenirken hata oluştu');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      setMessage('Kullanıcı güncellenirken hata oluştu');
      setMessageType('error');
    }
  };

  const getDecryptedPassword = (user) => {
    let password = user.password || '';
    try {
      if (password && typeof password === 'string' && password.startsWith('U2FsdGVkX1')) {
        password = decryptData(password);
      }
    } catch (error) {
      console.error('Error decrypting password:', error);
    }
    return password;
  };

  const handleToggleStatus = async (userId) => {
    try {
      const response = await ApiService.toggleMemberUserStatus(userId);
      if (response.success) {
        setMessage('Kullanıcı durumu güncellendi');
        setMessageType('success');
        await fetchMemberUsers();
      } else {
        setMessage(response.message || 'Durum güncellenirken hata oluştu');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      setMessage('Kullanıcı durumu güncellenirken hata oluştu');
      setMessageType('error');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (window.confirm(`${userName} kullanıcısını silmek istediğinizden emin misiniz?`)) {
      try {
        const response = await ApiService.deleteMemberUser(userId);
        if (response.success) {
          setMessage('Kullanıcı başarıyla silindi');
          setMessageType('success');
          await fetchMemberUsers();
        } else {
          setMessage(response.message || 'Kullanıcı silinirken hata oluştu');
          setMessageType('error');
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        setMessage('Kullanıcı silinirken hata oluştu');
        setMessageType('error');
      }
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    if (!createForm.memberId || !createForm.username || !createForm.password) {
      setMessage('Tüm alanlar zorunludur');
      setMessageType('error');
      return;
    }

    try {
      const response = await ApiService.createMemberUser(
        createForm.memberId,
        createForm.username,
        createForm.password
      );
      
      if (response.success) {
        setMessage('Kullanıcı başarıyla oluşturuldu');
        setMessageType('success');
        setShowCreateForm(false);
        setCreateForm({ memberId: '', username: '', password: '' });
        await fetchMemberUsers();
      } else {
        setMessage(response.message || 'Kullanıcı oluşturulurken hata oluştu');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setMessage('Kullanıcı oluşturulurken hata oluştu');
      setMessageType('error');
    }
  };

  const handleMemberSelect = (memberId) => {
    const member = members.find(m => m.id === parseInt(memberId));
    if (member) {
      setCreateForm({
        memberId: member.id,
        username: member.tc || '',
        password: member.phone ? member.phone.replace(/\D/g, '') : ''
      });
    }
  };

  const handleUpdateAllCredentials = async () => {
    try {
      setIsUpdating(true);
      setMessage('');
      
      // Önce belirli bir TC'yi kontrol et (debug için)
      const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true';
      if (USE_FIREBASE) {
        try {
          const { checkUserCredentials } = await import('../utils/checkUserCredentials');
          const beforeCheck = await checkUserCredentials('26413642446');
          console.log('📊 BEFORE UPDATE - TC 26413642446:', beforeCheck);
        } catch (checkError) {
          console.warn('Debug check failed (non-critical):', checkError);
        }
      }
      
      const response = await ApiService.updateAllCredentials();
      
      if (response.success) {
        const { results } = response;
        const totalUpdated = results.memberUsers.updated + results.districtPresidents.updated + results.townPresidents.updated;
        const totalErrors = results.memberUsers.errors.length + results.districtPresidents.errors.length + results.townPresidents.errors.length;
        const totalDeleted = results.cleaned?.deleted || 0;
        
        // Güncelleme sonrası tekrar kontrol et (debug için)
        if (USE_FIREBASE) {
          try {
            const { checkUserCredentials } = await import('../utils/checkUserCredentials');
            const afterCheck = await checkUserCredentials('26413642446');
            console.log('📊 AFTER UPDATE - TC 26413642446:', afterCheck);
            
            if (afterCheck.match) {
              console.log('✅ TC 26413642446 credentials match correctly!');
            } else {
              console.warn('⚠️ TC 26413642446 credentials do NOT match:', {
                usernameMatch: afterCheck.usernameMatch,
                passwordMatch: afterCheck.passwordMatch
              });
            }
          } catch (checkError) {
            console.warn('Debug check failed (non-critical):', checkError);
          }
        }
        
        let message = `Güncelleme tamamlandı!\n`;
        message += `• Üye kullanıcıları: ${results.memberUsers.updated} güncellendi/oluşturuldu\n`;
        message += `• İlçe başkanları: ${results.districtPresidents.updated} güncellendi/oluşturuldu\n`;
        message += `• Belde başkanları: ${results.townPresidents.updated} güncellendi/oluşturuldu\n`;
        
        if (totalDeleted > 0) {
          message += `• Silinen kullanıcılar: ${totalDeleted} kullanıcı silindi\n`;
        }
        
        if (totalErrors > 0) {
          message += `\n${totalErrors} hata oluştu.`;
          setMessageType('warning');
        } else {
          setMessageType('success');
        }
        
        setMessage(message);
        
        // Refresh the user list
        await fetchMemberUsers();
      } else {
        setMessage('Güncelleme sırasında hata oluştu: ' + response.message);
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error updating credentials:', error);
      setMessage('Güncelleme sırasında hata oluştu');
      setMessageType('error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Üye kullanıcılarını Firebase Auth'a kaydet
  const handleSyncToFirebaseAuth = async () => {
    try {
      setIsSyncingToAuth(true);
      setMessage('');
      setMessageType('info');
      
      // Mevcut admin kullanıcısını koru
      const currentUser = auth.currentUser;
      const currentUserEmail = currentUser ? currentUser.email : null;
      const currentUserUid = currentUser ? currentUser.uid : null;
      
      // Admin bilgilerini al (Firestore'dan)
      let adminEmail = 'admin@ilsekreterlik.local';
      let adminPassword = 'admin123';
      try {
        const adminDoc = await FirebaseService.getById('admin', 'main');
        if (adminDoc && adminDoc.email) {
          adminEmail = adminDoc.email;
        }
      } catch (error) {
        console.warn('Admin bilgileri alınamadı, varsayılan kullanılıyor');
      }
      
      // Tüm üye kullanıcılarını al
      const allMemberUsers = memberUsers.filter(user => user.isActive !== false);
      setSyncProgress({ current: 0, total: allMemberUsers.length });
      
      let successCount = 0;
      let errorCount = 0;
      const errors = [];
      
      for (let i = 0; i < allMemberUsers.length; i++) {
        const user = allMemberUsers[i];
        setSyncProgress({ current: i + 1, total: allMemberUsers.length });
        
        try {
          // Şifreyi decrypt et
          let password = user.password || '';
          if (password && typeof password === 'string' && password.startsWith('U2FsdGVkX1')) {
            password = decryptData(password);
          }
          
          if (!password) {
            errors.push(`${user.username}: Şifre bulunamadı`);
            errorCount++;
            continue;
          }
          
          // Email formatına çevir
          const email = user.username.includes('@') ? user.username : `${user.username}@ilsekreterlik.local`;
          
          // Eğer zaten authUid varsa, kullanıcı zaten Firebase Auth'da var
          if (user.authUid) {
            console.log(`ℹ️ User ${user.username} already has authUid: ${user.authUid}`);
            successCount++;
            continue;
          }
          
          // Firebase Auth'da kullanıcı oluştur
          try {
            const authUser = await createUserWithEmailAndPassword(auth, email, password);
            console.log(`✅ Firebase Auth user created: ${user.username} -> ${authUser.user.uid}`);
            
            // Firestore'da authUid'yi güncelle
            await FirebaseService.update('member_users', user.id, {
              authUid: authUser.user.uid
            }, true);
            
            successCount++;
            
            // Admin kullanıcısını geri yükle (eğer farklıysa)
            if (currentUserUid && currentUserUid !== authUser.user.uid && currentUserEmail === adminEmail) {
              // Admin kullanıcısını tekrar sign-in et
              try {
                await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
                console.log('✅ Admin user re-authenticated');
              } catch (signInError) {
                console.warn(`⚠️ Admin user re-authentication failed: ${signInError.message}`);
                errors.push(`Admin kullanıcısı tekrar giriş yapılamadı: ${signInError.message}`);
              }
            }
          } catch (authError) {
            if (authError.code === 'auth/email-already-in-use') {
              // Email zaten kullanılıyorsa, sadece Firestore'u güncelle
              console.warn(`⚠️ Email already in use: ${email}`);
              // Firebase Auth'dan kullanıcıyı bulamayız, bu yüzden sadece devam ediyoruz
              successCount++;
            } else {
              errors.push(`${user.username}: ${authError.message}`);
              errorCount++;
              console.error(`❌ Error creating Firebase Auth user for ${user.username}:`, authError);
            }
          }
        } catch (error) {
          errors.push(`${user.username}: ${error.message}`);
          errorCount++;
          console.error(`❌ Error processing user ${user.username}:`, error);
        }
      }
      
      // Tüm kullanıcılar oluşturulduktan sonra admin kullanıcısını tekrar sign-in et
      if (currentUserEmail === adminEmail) {
        try {
          await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
          console.log('✅ Admin user re-authenticated after all users created');
        } catch (signInError) {
          console.warn(`⚠️ Admin user re-authentication failed: ${signInError.message}`);
          errors.push(`Admin kullanıcısı tekrar giriş yapılamadı: ${signInError.message}`);
        }
      }
      
      // Sonuç mesajı
      let message = `Firebase Auth'a aktarım tamamlandı!\n`;
      message += `• Başarılı: ${successCount} kullanıcı\n`;
      if (errorCount > 0) {
        message += `• Hata: ${errorCount} kullanıcı\n`;
        message += `\nHatalar:\n${errors.slice(0, 10).join('\n')}`;
        if (errors.length > 10) {
          message += `\n... ve ${errors.length - 10} hata daha`;
        }
        setMessageType('warning');
      } else {
        setMessageType('success');
      }
      
      setMessage(message);
      
      // Kullanıcı listesini yenile
      await fetchMemberUsers();
      
    } catch (error) {
      console.error('Error syncing to Firebase Auth:', error);
      setMessage('Firebase Auth\'a aktarım sırasında hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setIsSyncingToAuth(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <span className="ml-2 text-gray-600">Üye kullanıcıları yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Üye Kullanıcıları Yönetimi</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Her üye için otomatik olarak oluşturulan kullanıcı hesaplarını yönetebilirsiniz.
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleSyncToFirebaseAuth}
              disabled={isSyncingToAuth || memberUsers.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200 flex items-center"
            >
              {isSyncingToAuth ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Firebase Auth'a Aktarılıyor... ({syncProgress.current}/{syncProgress.total})
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                  Firebase Auth'a Aktar
                </>
              )}
            </button>
            <button
              onClick={handleUpdateAllCredentials}
              disabled={isUpdating}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200 flex items-center"
            >
              {isUpdating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Güncelleniyor...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Tüm Kullanıcıları Güncelle
                </>
              )}
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200"
            >
              {showCreateForm ? 'İptal' : 'Yeni Kullanıcı Oluştur'}
            </button>
          </div>
        </div>
      </div>

      {/* Create User Form */}
      {showCreateForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
          <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">Yeni Kullanıcı Oluştur</h4>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Üye Seçin
              </label>
              <select
                value={createForm.memberId}
                onChange={(e) => {
                  setCreateForm(prev => ({ ...prev, memberId: e.target.value }));
                  handleMemberSelect(e.target.value);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition duration-200"
                required
              >
                <option value="">Üye seçin...</option>
                {members
                  .filter(member => !memberUsers.some(user => user.member_id === member.id))
                  .map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name} - {member.tc}
                    </option>
                  ))
                }
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Kullanıcı Adı (TC)
              </label>
              <input
                type="text"
                value={createForm.username}
                onChange={(e) => setCreateForm(prev => ({ ...prev, username: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition duration-200"
                placeholder="TC kimlik numarası"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Şifre (Telefon)
              </label>
              <input
                type="text"
                value={createForm.password}
                onChange={(e) => setCreateForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition duration-200"
                placeholder="Telefon numarası (sadece rakamlar)"
                required
              />
            </div>
            
            <div className="flex space-x-2">
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200"
              >
                Kullanıcı Oluştur
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition duration-200"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Message */}
      {message && (
        <div className={`p-3 rounded-lg shadow-sm ${
          messageType === 'success' 
            ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 border border-green-200 dark:border-green-700' 
            : messageType === 'warning'
            ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700'
            : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-700'
        }`}>
          {message}
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Üye Bilgileri
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Kullanıcı Adı
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Şifre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Durum
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {memberUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                    Henüz üye kullanıcısı bulunmuyor
                  </td>
                </tr>
              ) : (
                memberUsers.map((user) => {
                  // Kullanıcı tipine göre bilgileri al
                  let displayName = 'Bilinmeyen';
                  let displayInfo = '-';
                  let userTypeLabel = 'Üye';
                  
                  if (user.userType === 'town_president' && user.townId) {
                    // Belde başkanı kullanıcısı
                    const town = towns.find(t => String(t.id) === String(user.townId));
                    displayName = town?.name || user.chairmanName || 'Bilinmeyen Belde';
                    displayInfo = user.chairmanName ? `${user.chairmanName} - Belde Başkanı` : 'Belde Başkanı';
                    userTypeLabel = 'Belde Başkanı';
                  } else if (user.userType === 'district_president' && user.districtId) {
                    // İlçe başkanı kullanıcısı
                    displayName = user.chairmanName || 'Bilinmeyen İlçe';
                    displayInfo = 'İlçe Başkanı';
                    userTypeLabel = 'İlçe Başkanı';
                  } else {
                    // Üye kullanıcısı
                    const member = members.find(m => m.id === user.member_id || m.id === user.memberId || String(m.id) === String(user.member_id) || String(m.id) === String(user.memberId));
                    displayName = member?.name || 'Bilinmeyen Üye';
                    const memberRegion = member?.region || member?.region_name || '-';
                    const memberPosition = member?.position || member?.position_name || '-';
                    displayInfo = `${memberRegion} - ${memberPosition}`;
                    userTypeLabel = 'Üye';
                  }
                  
                  return (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{displayInfo}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          <span className={`inline-flex px-2 py-0.5 rounded-full ${
                            user.userType === 'town_president'
                              ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                              : user.userType === 'district_president'
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                          }`}>
                            {userTypeLabel}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">{user.username}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                        {getDecryptedPassword(user) || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        user.is_active || user.isActive
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                          : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                      }`}>
                        {user.is_active || user.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={() => handleToggleStatus(user.id)}
                          className={`${
                            user.is_active || user.isActive
                              ? 'text-yellow-600 dark:text-yellow-400 hover:text-yellow-900 dark:hover:text-yellow-300' 
                              : 'text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300'
                          }`}
                        >
                          {user.is_active || user.isActive ? 'Pasifleştir' : 'Aktifleştir'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.username)}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        >
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
          <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Kullanıcı Bilgilerini Düzenle
          </h4>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Kullanıcı Adı (TC)
              </label>
              <input
                type="text"
                value={editForm.username}
                onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition duration-200"
                placeholder="TC kimlik numarası"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Şifre (Telefon)
              </label>
              <input
                type="text"
                value={editForm.password}
                onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition duration-200 font-mono"
                placeholder="Telefon numarası (sadece rakamlar)"
                required
              />
            </div>
            
            <div className="flex space-x-2">
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200"
              >
                Kaydet
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition duration-200"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default MemberUsersSettings;
