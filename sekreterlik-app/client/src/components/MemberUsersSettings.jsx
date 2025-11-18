import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import { decryptData } from '../utils/crypto';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import FirebaseService from '../services/FirebaseService';

const MemberUsersSettings = () => {
  const [memberUsers, setMemberUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [towns, setTowns] = useState([]);
  const [districts, setDistricts] = useState([]);
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
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isClearingAuthUids, setIsClearingAuthUids] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({
    username: '',
    password: ''
  });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMemberUsers();
    fetchMembers();
    fetchTowns();
    fetchDistricts();
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

  const fetchDistricts = async () => {
    try {
      const response = await ApiService.getDistricts();
      setDistricts(response || []);
    } catch (error) {
      console.error('Error fetching districts:', error);
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
        // Firebase Auth güncellemesi başarılı mı kontrol et
        let message = 'Kullanıcı bilgileri başarıyla güncellendi';
        if (response.firebaseAuthUpdated === false) {
          message += '\n⚠️ Not: Firebase Auth şifresi güncellenemedi (kullanıcı Firebase Auth\'da bulunamadı). Kullanıcı bir sonraki login\'de yeni şifre ile giriş yapabilir.';
        }
        setMessage(message);
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
      setMessage('Kullanıcı güncellenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata'));
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
    if (window.confirm(`${userName} kullanıcısını silmek istediğinizden emin misiniz?\n\nBu işlem:\n- Kullanıcıyı Firestore'dan siler\n- Backend servisi varsa Firebase Auth'dan da siler\n- Backend servisi yoksa Firebase Auth'da kalır (senkronizasyon ile temizlenebilir)`)) {
      try {
        const response = await ApiService.deleteMemberUser(userId);
        if (response.success) {
          if (response.warning) {
            setMessage(response.message);
            setMessageType('warning');
          } else {
            setMessage(response.message || 'Kullanıcı başarıyla silindi');
          setMessageType('success');
          }
          await fetchMemberUsers();
        } else {
          setMessage(response.message || 'Kullanıcı silinirken hata oluştu');
          setMessageType('error');
        }
      } catch (error) {
        console.error('Error deleting user:', error);
        setMessage('Kullanıcı silinirken hata oluştu: ' + error.message);
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

  // İlçe başkanları için kullanıcı oluştur
  const handleCreateDistrictPresidentUsers = async () => {
    try {
      setIsUpdating(true);
      setMessage('');
      
      // Tüm ilçe yöneticilerini al
      const districtOfficials = await ApiService.getDistrictOfficials();
      const districtPresidents = districtOfficials.filter(official => 
        official.chairman_name && official.chairman_phone
      );
      
      if (districtPresidents.length === 0) {
        setMessage('İlçe başkanı bulunamadı (başkan adı ve telefonu olan ilçeler)');
        setMessageType('error');
        return;
      }

      // Mevcut kullanıcıları al
      const existingUsers = await ApiService.getMemberUsers();
      const existingUsernames = new Set(existingUsers.users?.map(u => u.username) || []);
      
      let createdCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const official of districtPresidents) {
        try {
          // İlçe bilgisini al
          const district = districts.find(d => String(d.id) === String(official.district_id));
          if (!district) {
            errors.push(`${official.chairman_name || 'Bilinmeyen'}: İlçe bulunamadı`);
            errorCount++;
            continue;
          }

          // Kullanıcı adı ve şifre belirle
          const username = district.name.toLowerCase()
            .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
            .replace(/ü/g, 'u').replace(/Ü/g, 'U')
            .replace(/ş/g, 's').replace(/Ş/g, 'S')
            .replace(/ı/g, 'i').replace(/İ/g, 'I')
            .replace(/ö/g, 'o').replace(/Ö/g, 'O')
            .replace(/ç/g, 'c').replace(/Ç/g, 'C')
            .replace(/[^a-z0-9]/g, '');
          const password = (official.chairman_phone || '').replace(/\D/g, '');

          if (!password || password.length < 6) {
            errors.push(`${official.chairman_name}: Geçerli telefon numarası yok`);
            errorCount++;
            continue;
          }

          // Kullanıcı zaten var mı kontrol et
          const existingUser = existingUsers.users?.find(u => 
            u.username === username || 
            (u.userType === 'district_president' && String(u.districtId) === String(official.district_id))
          );
          
          if (!existingUser) {
            // Yeni kullanıcı oluştur
            const email = `${username}@ilsekreterlik.local`;
            let authUser = null;
            try {
              authUser = await createUserWithEmailAndPassword(auth, email, password);
            } catch (authError) {
              if (authError.code !== 'auth/email-already-in-use') {
                throw authError;
              }
            }

            const userData = {
              username,
              password,
              userType: 'district_president',
              districtId: official.district_id,
              isActive: true,
              chairmanName: official.chairman_name,
              authUid: authUser?.user?.uid || null
            };

            await FirebaseService.create('member_users', null, userData, false);
            createdCount++;
          } else {
            // Kullanıcı varsa güncelle
            const updateData = {
              userType: 'district_president',
              districtId: official.district_id,
              chairmanName: official.chairman_name
            };
            
            if (existingUser.password !== password) {
              updateData.password = password;
            }

            await FirebaseService.update('member_users', existingUser.id, updateData, false);
            updatedCount++;
          }
        } catch (error) {
          errorCount++;
          errors.push(`${official.chairman_name || 'Bilinmeyen'}: ${error.message || 'Bilinmeyen hata'}`);
          console.error('İlçe başkanı kullanıcısı oluşturma hatası:', error);
        }
      }

      // Sonuç mesajı
      let message = `İlçe başkanı kullanıcıları oluşturuldu!\n`;
      message += `• Yeni oluşturulan: ${createdCount}\n`;
      message += `• Güncellenen: ${updatedCount}\n`;
      if (errorCount > 0) {
        message += `• Hata: ${errorCount}\n`;
        message += `\nHatalar:\n${errors.slice(0, 5).join('\n')}`;
        setMessageType('warning');
      } else {
        setMessageType('success');
      }
      
      setMessage(message);
      await fetchMemberUsers();
    } catch (error) {
      console.error('Error creating district president users:', error);
      setMessage('İlçe başkanı kullanıcıları oluşturulurken hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Belde başkanları için kullanıcı oluştur
  const handleCreateTownPresidentUsers = async () => {
    try {
      setIsUpdating(true);
      setMessage('');
      
      // Tüm belde yöneticilerini al
      const townOfficials = await ApiService.getTownOfficials();
      const townPresidents = townOfficials.filter(official => 
        official.chairman_name && official.chairman_phone
      );
      
      if (townPresidents.length === 0) {
        setMessage('Belde başkanı bulunamadı (başkan adı ve telefonu olan beldeler)');
        setMessageType('error');
        return;
      }

      // Mevcut kullanıcıları al
      const existingUsers = await ApiService.getMemberUsers();
      const existingUsernames = new Set(existingUsers.users?.map(u => u.username) || []);
      
      let createdCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const official of townPresidents) {
        try {
          // Belde bilgisini al
          const town = towns.find(t => String(t.id) === String(official.town_id));
          if (!town) {
            errors.push(`${official.chairman_name || 'Bilinmeyen'}: Belde bulunamadı`);
            errorCount++;
            continue;
          }

          // Kullanıcı adı ve şifre belirle
          const username = town.name.toLowerCase()
            .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
            .replace(/ü/g, 'u').replace(/Ü/g, 'U')
            .replace(/ş/g, 's').replace(/Ş/g, 'S')
            .replace(/ı/g, 'i').replace(/İ/g, 'I')
            .replace(/ö/g, 'o').replace(/Ö/g, 'O')
            .replace(/ç/g, 'c').replace(/Ç/g, 'C')
            .replace(/[^a-z0-9]/g, '');
          const password = (official.chairman_phone || '').replace(/\D/g, '');

          if (!password || password.length < 6) {
            errors.push(`${official.chairman_name}: Geçerli telefon numarası yok`);
            errorCount++;
            continue;
          }

          // Kullanıcı zaten var mı kontrol et
          const existingUser = existingUsers.users?.find(u => 
            u.username === username || 
            (u.userType === 'town_president' && String(u.townId) === String(official.town_id))
          );
          
          if (!existingUser) {
            // Yeni kullanıcı oluştur
            const email = `${username}@ilsekreterlik.local`;
            let authUser = null;
            try {
              authUser = await createUserWithEmailAndPassword(auth, email, password);
            } catch (authError) {
              if (authError.code !== 'auth/email-already-in-use') {
                throw authError;
              }
            }

            const userData = {
              username,
              password,
              userType: 'town_president',
              townId: official.town_id,
              isActive: true,
              chairmanName: official.chairman_name,
              authUid: authUser?.user?.uid || null
            };

            await FirebaseService.create('member_users', null, userData, false);
            createdCount++;
          } else {
            // Kullanıcı varsa güncelle
            const updateData = {
              userType: 'town_president',
              townId: official.town_id,
              chairmanName: official.chairman_name
            };
            
            if (existingUser.password !== password) {
              updateData.password = password;
            }

            await FirebaseService.update('member_users', existingUser.id, updateData, false);
            updatedCount++;
          }
        } catch (error) {
          errorCount++;
          errors.push(`${official.chairman_name || 'Bilinmeyen'}: ${error.message || 'Bilinmeyen hata'}`);
          console.error('Belde başkanı kullanıcısı oluşturma hatası:', error);
        }
      }

      // Sonuç mesajı
      let message = `Belde başkanı kullanıcıları oluşturuldu!\n`;
      message += `• Yeni oluşturulan: ${createdCount}\n`;
      message += `• Güncellenen: ${updatedCount}\n`;
      if (errorCount > 0) {
        message += `• Hata: ${errorCount}\n`;
        message += `\nHatalar:\n${errors.slice(0, 5).join('\n')}`;
        setMessageType('warning');
      } else {
        setMessageType('success');
      }
      
      setMessage(message);
      await fetchMemberUsers();
    } catch (error) {
      console.error('Error creating town president users:', error);
      setMessage('Belde başkanı kullanıcıları oluşturulurken hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Başmüşahitler için kullanıcı oluştur
  const handleCreateObserverUsers = async () => {
    try {
      setIsUpdating(true);
      setMessage('');
      
      // Tüm başmüşahitleri al
      const observers = await ApiService.getBallotBoxObservers();
      const chiefObservers = observers.filter(obs => obs.is_chief_observer === true || obs.is_chief_observer === 1);
      
      // Mevcut kullanıcıları al
      const existingUsers = await ApiService.getMemberUsers();
      const musahitUsers = (existingUsers.users || []).filter(u => u.userType === 'musahit' && u.observerId);
      
      // Mevcut başmüşahitlerin observerId'lerini bir Set'e koy
      const currentObserverIds = new Set(chiefObservers.map(obs => String(obs.id)));
      
      // Silinen başmüşahitlerin kullanıcılarını bul ve sil
      let deletedCount = 0;
      const deletedErrors = [];
      
      for (const musahitUser of musahitUsers) {
        const observerId = String(musahitUser.observerId);
        // Eğer bu observerId mevcut başmüşahitlerde yoksa, kullanıcıyı sil
        if (!currentObserverIds.has(observerId)) {
          try {
            await ApiService.deleteMemberUser(musahitUser.id);
            deletedCount++;
            console.log(`✅ Silinen başmüşahit kullanıcısı silindi: ${musahitUser.username} (observerId: ${observerId})`);
          } catch (deleteError) {
            deletedErrors.push(`${musahitUser.username || 'Bilinmeyen'}: ${deleteError.message || 'Silme hatası'}`);
            console.error('Başmüşahit kullanıcısı silme hatası:', deleteError);
          }
        }
      }
      
      if (chiefObservers.length === 0) {
        let message = deletedCount > 0 
          ? `Silinen başmüşahit kullanıcıları temizlendi!\n• Silinen: ${deletedCount}\n`
          : 'Başmüşahit bulunamadı';
        if (deletedErrors.length > 0) {
          message += `\nSilme hataları:\n${deletedErrors.slice(0, 5).join('\n')}`;
          setMessageType('warning');
        } else {
          setMessageType(deletedCount > 0 ? 'success' : 'error');
        }
        setMessage(message);
        await fetchMemberUsers();
        return;
      }

      // Mevcut kullanıcıları tekrar al (silme işleminden sonra)
      const updatedUsers = await ApiService.getMemberUsers();
      const existingUsernames = new Set(updatedUsers.users?.map(u => u.username) || []);
      
      // Sandık bilgilerini al
      const ballotBoxes = await ApiService.getBallotBoxes();
      
      let createdCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const observer of chiefObservers) {
        try {
          // TC'yi decrypt et
          let tc = observer.tc || '';
          try {
            if (tc && tc.startsWith('U2FsdGVkX1')) {
              tc = decryptData(tc);
            }
          } catch (e) {
            console.error('TC decrypt hatası:', e);
          }

          // Kullanıcı adı ve şifre belirle
          let username, password;
          if (observer.ballot_box_id) {
            const ballotBox = ballotBoxes.find(bb => String(bb.id) === String(observer.ballot_box_id));
            if (ballotBox && ballotBox.ballot_number) {
              username = String(ballotBox.ballot_number);
            } else {
              username = tc;
            }
          } else {
            username = tc;
          }
          password = tc;

          // Kullanıcı zaten var mı kontrol et (username ile)
          const existingUser = existingUsers.users?.find(u => u.username === username);
          
          if (!existingUser) {
            // Yeni kullanıcı oluştur - userType='musahit', observerId ile
            const email = `${username}@ilsekreterlik.local`;
            let authUser = null;
            try {
              authUser = await createUserWithEmailAndPassword(auth, email, password);
            } catch (authError) {
              if (authError.code !== 'auth/email-already-in-use') {
                throw authError;
              }
            }

            const userData = {
              username,
              password,
              userType: 'musahit',
              observerId: observer.id,
              isActive: true,
              name: observer.name,
              tc: observer.tc,
              authUid: authUser?.user?.uid || null
            };

            // Firestore'a kaydet
            await FirebaseService.create('member_users', null, userData, false);
            createdCount++;
          } else {
            // Kullanıcı varsa güncelle (observerId ve userType ekle/güncelle)
            const updateData = {
              userType: 'musahit',
              observerId: observer.id,
              name: observer.name
            };
            
            // Şifre güncellemesi gerekirse
            if (existingUser.password !== password) {
              updateData.password = password;
            }

            await FirebaseService.update('member_users', existingUser.id, updateData, false);
            
            // Firebase Auth şifre güncellemesi kaldırıldı
            // Login sırasında Firebase Auth'da kullanıcı yoksa otomatik oluşturulacak
            // Mevcut şifreyi güncellemek karmaşık ve hata veriyor
            
            updatedCount++;
          }
        } catch (error) {
          errorCount++;
          errors.push(`${observer.name || 'Bilinmeyen'}: ${error.message || 'Bilinmeyen hata'}`);
          console.error('Başmüşahit kullanıcısı oluşturma hatası:', error);
        }
      }

      // Sonuç mesajı
      let message = `Müşahit şifreleri oluşturuldu!\n`;
      if (deletedCount > 0) {
        message += `• Silinen: ${deletedCount}\n`;
      }
      message += `• Yeni oluşturulan: ${createdCount}\n`;
      message += `• Güncellenen: ${updatedCount}\n`;
      
      const allErrors = [...deletedErrors, ...errors];
      if (errorCount > 0 || deletedErrors.length > 0) {
        message += `• Hata: ${errorCount + deletedErrors.length}\n`;
        if (allErrors.length > 0) {
          message += `\nHatalar:\n${allErrors.slice(0, 5).join('\n')}`;
        }
        setMessageType('warning');
      } else {
        setMessageType('success');
      }
      
      setMessage(message);
      await fetchMemberUsers();
    } catch (error) {
      console.error('Error creating observer users:', error);
      setMessage('Müşahit şifreleri oluşturulurken hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFixEncryptedPasswords = async () => {
    try {
      setIsUpdating(true);
      setMessage('');
      
      const response = await ApiService.fixEncryptedPasswords();
      
      if (response.success) {
        setMessage(`✅ ${response.message}`);
        setMessageType('success');
        // Kullanıcı listesini yenile
        await fetchMemberUsers();
      } else {
        setMessage(`❌ ${response.message || 'Şifrelenmiş password\'lar düzeltilirken hata oluştu'}`);
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error fixing encrypted passwords:', error);
      setMessage('Şifrelenmiş password\'lar düzeltilirken hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateAllCredentials = async () => {
    try {
      setIsUpdating(true);
      setMessage('');
      
      // Önce şifrelenmiş password'ları düzelt
      const fixResponse = await ApiService.fixEncryptedPasswords();
      if (fixResponse.success && fixResponse.fixed > 0) {
        console.log(`🔓 Fixed ${fixResponse.fixed} encrypted passwords`);
      }
      
      const response = await ApiService.updateAllCredentials();
      
      if (response.success) {
        const { results } = response;
        const totalUpdated = results.memberUsers.updated + results.districtPresidents.updated + results.townPresidents.updated;
        const totalErrors = results.memberUsers.errors.length + results.districtPresidents.errors.length + results.townPresidents.errors.length;
        const totalDeleted = results.cleaned?.deleted || 0;
        
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
    if (!window.confirm('Üye kullanıcıları ile Firebase Auth\'ı senkronize etmek istediğinize emin misiniz?\n\nBu işlem:\n- Firestore\'da olan ama Auth\'da olmayan kullanıcıları oluşturur\n- Email ve displayName bilgilerini günceller\n- Backend servisi varsa: Firestore\'da olmayan ama Auth\'da olan kullanıcıları siler\n\nNot: Firebase Auth\'dan kullanıcı silme işlemi backend servisi gerektirir. Backend yoksa sadece kullanıcı oluşturma ve güncelleme yapılır.\n\nDevam etmek istiyor musunuz?')) {
      return;
    }

    try {
      setIsSyncingToAuth(true);
      setMessage('');
      setSyncProgress({ current: 0, total: 0 });

      // Önce backend'i dene
      let useBackend = false;
      let API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      
      // Eğer VITE_API_BASE_URL set edilmişse ama /api ile bitmiyorsa, ekle
      if (API_BASE_URL) {
        // Trailing slash'leri temizle
        API_BASE_URL = API_BASE_URL.replace(/\/+$/, '');
        // /api ile bitmiyorsa ekle
        if (!API_BASE_URL.endsWith('/api')) {
          API_BASE_URL = API_BASE_URL + '/api';
        }
      } else {
        // VITE_API_BASE_URL set edilmemişse, fallback kullan
        if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
          // Render.com'da backend URL'ini belirle
          API_BASE_URL = 'https://sekreterlik-backend.onrender.com/api';
        } else {
          API_BASE_URL = 'http://localhost:5000/api';
        }
      }
      
      console.log('🔍 Backend URL:', API_BASE_URL);
      console.log('🔍 VITE_API_BASE_URL env:', import.meta.env.VITE_API_BASE_URL);
      
      // Backend'i dene (5 saniye timeout)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${API_BASE_URL}/auth/sync-member-users-with-auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const responseText = await response.text();
          if (responseText && responseText.trim() !== '') {
            const result = JSON.parse(responseText);
            setMessage(result.message || 'Senkronizasyon tamamlandı (Backend)');
            setMessageType('success');
            
            if (result.results) {
              const details = `Oluşturulan: ${result.results.created}\nSilinen: ${result.results.deleted}\nGüncellenen: ${result.results.updated}\nHata: ${result.results.errors}`;
              let message = result.message || 'Senkronizasyon tamamlandı (Backend)';
              if (result.results.deleted > 0) {
                message += `\n\n${details}`;
              }
              if (result.results.errors > 0) {
                setMessageType('warning');
                message += `\n\nHatalar:\n${result.results.details?.slice(0, 500) || 'Detaylar konsolda'}`;
              }
              setMessage(message);
            }
            
            await fetchMemberUsers();
            return; // Backend başarılı, çık
          }
        }
      } catch (backendError) {
        // Backend servisi yoksa veya CORS hatası varsa, bu normal bir durum
        // Sessizce client-side senkronizasyona geçiyoruz
        if (backendError.name === 'AbortError') {
          console.log('ℹ️ Backend servisi timeout (5 saniye), client-side senkronizasyon kullanılıyor');
        } else if (backendError.message?.includes('CORS') || backendError.message?.includes('Failed to fetch')) {
          console.log('ℹ️ Backend servisi erişilemiyor (CORS/Network), client-side senkronizasyon kullanılıyor');
        } else {
          console.warn('⚠️ Backend servisi kullanılamıyor, client-side senkronizasyon kullanılıyor:', backendError.message);
        }
      }

      // Backend başarısız, client-side senkronizasyon kullan
      console.log('🔄 Using client-side synchronization...');
      
      // Mevcut admin kullanıcısını koru
      const currentUser = auth.currentUser;
      const currentUserEmail = currentUser ? currentUser.email : null;
      const currentUserUid = currentUser ? currentUser.uid : null;
      
      // Admin bilgilerini al (Firestore'dan)
      let adminEmail = 'admin@ilsekreterlik.local';
      let adminPassword = 'admin123';
      try {
        const { default: FirebaseApiService } = await import('../utils/FirebaseApiService');
        const adminDoc = await FirebaseService.getById(FirebaseApiService.COLLECTIONS.ADMIN, 'main');
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
          
          // Şifreyi normalize et (sadece rakamlar)
          password = (password || '').toString().replace(/\D/g, '');
          
          if (!password) {
            errors.push(`${user.username}: Şifre bulunamadı`);
            errorCount++;
            continue;
          }
          
          // Firebase Auth minimum 6 karakter şifre ister
          if (password.length < 6) {
            password = password.padStart(6, '0');
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
            // Email ve password validasyonu
            if (!email || email.length < 3) {
              errors.push(`${user.username}: Email geçersiz (${email})`);
              errorCount++;
              continue;
            }
            
            if (!password || password.length < 6) {
              errors.push(`${user.username}: Şifre çok kısa (minimum 6 karakter)`);
              errorCount++;
              continue;
            }
            
            // Email formatını kontrol et
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
              errors.push(`${user.username}: Email formatı geçersiz (${email})`);
              errorCount++;
              continue;
            }
            
            console.log(`🔄 Creating Firebase Auth user: ${email} (password length: ${password.length})`);
            
            const authUser = await createUserWithEmailAndPassword(auth, email, password);
            console.log(`✅ Firebase Auth user created: ${user.username} -> ${authUser.user.uid}`);
            
            // Firestore'da authUid'yi güncelle
            const { default: FirebaseApiService } = await import('../utils/FirebaseApiService');
            await FirebaseService.update(FirebaseApiService.COLLECTIONS.MEMBER_USERS, user.id, {
              authUid: authUser.user.uid
            }, false);
            
            successCount++;
            
            // Admin kullanıcısını geri yükle (eğer farklıysa)
            if (currentUserUid && currentUserUid !== authUser.user.uid && currentUserEmail === adminEmail) {
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
              // Email zaten kullanılıyorsa, bu normal bir durum (kullanıcı zaten Firebase Auth'da)
              console.log(`ℹ️ Email already in use: ${email} - Kullanıcı zaten Firebase Auth'da, atlanıyor`);
              successCount++;
            } else {
              // Diğer hatalar için detaylı log
              console.error(`❌ Firebase Auth error for ${user.username}:`, {
                code: authError.code,
                message: authError.message,
                email,
                passwordLength: password.length
              });
              
              if (authError.code === 'auth/invalid-email') {
                errors.push(`${user.username}: Geçersiz email formatı (${email})`);
                errorCount++;
              } else if (authError.code === 'auth/weak-password') {
                errors.push(`${user.username}: Şifre çok zayıf (minimum 6 karakter)`);
                errorCount++;
              } else if (authError.code === 'auth/operation-not-allowed') {
                errors.push(`${user.username}: Email/Password authentication devre dışı`);
                errorCount++;
              } else {
                const errorMsg = `${user.username}: ${authError.code || 'Unknown error'} - ${authError.message || 'Firebase Auth error'}`;
                errors.push(errorMsg);
                errorCount++;
              }
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
        }
      }
      
      // Sonuç mesajı
      let message = `Firebase Auth'a aktarım tamamlandı! (Client-side)\n`;
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
      setMessage('Senkronizasyon sırasında hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setIsSyncingToAuth(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  };

  const handleSyncToFirebaseAuthOld = async () => {
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
        const { default: FirebaseApiService } = await import('../utils/FirebaseApiService');
        const adminDoc = await FirebaseService.getById(FirebaseApiService.COLLECTIONS.ADMIN, 'main');
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
          
          // Şifreyi normalize et (sadece rakamlar)
          password = (password || '').toString().replace(/\D/g, '');
          
          if (!password) {
            errors.push(`${user.username}: Şifre bulunamadı`);
            errorCount++;
            continue;
          }
          
          // Firebase Auth minimum 6 karakter şifre ister
          // Eğer şifre 6 karakterden kısa ise, başına "0" ekle
          if (password.length < 6) {
            password = password.padStart(6, '0');
            console.log(`⚠️ Password too short for ${user.username}, padded to 6 characters`);
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
            // FirebaseApiService.COLLECTIONS.MEMBER_USERS kullan
            const { default: FirebaseApiService } = await import('../utils/FirebaseApiService');
            await FirebaseService.update(FirebaseApiService.COLLECTIONS.MEMBER_USERS, user.id, {
              authUid: authUser.user.uid
            }, false); // encrypt = false (authUid şifrelenmez)
            
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
              const errorMsg = `${user.username}: ${authError.code || 'Unknown error'} - ${authError.message || 'Firebase Auth error'}`;
              errors.push(errorMsg);
              errorCount++;
              console.error(`❌ Error creating Firebase Auth user for ${user.username}:`, {
                code: authError.code,
                message: authError.message,
                email,
                passwordLength: password.length,
                passwordPreview: password.substring(0, 3) + '***'
              });
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

  // Gereksiz Firebase Auth kullanıcılarını temizle (orphaned users)
  const handleCleanupOrphanedAuthUsers = async () => {
    if (!window.confirm('Firestore\'da olmayan ama Firebase Auth\'da olan gereksiz kullanıcıları temizlemek istediğinize emin misiniz?\n\nBu işlem:\n- @ilsekreterlik.local email\'li kullanıcıları kontrol eder\n- Firestore\'daki member_users\'da olmayan kullanıcıları Firebase Auth\'dan siler\n- Admin kullanıcısını korur\n\nDevam etmek istiyor musunuz?')) {
      return;
    }

    try {
      setIsCleaningUp(true);
      setMessage('');
      setMessageType('info');

      // Backend URL'ini belirle
      let API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
      
      // Eğer VITE_API_BASE_URL set edilmişse ama /api ile bitmiyorsa, ekle
      if (API_BASE_URL) {
        // Trailing slash'leri temizle
        API_BASE_URL = API_BASE_URL.replace(/\/+$/, '');
        // /api ile bitmiyorsa ekle
        if (!API_BASE_URL.endsWith('/api')) {
          API_BASE_URL = API_BASE_URL + '/api';
        }
      } else {
        // VITE_API_BASE_URL set edilmemişse, fallback kullan
        if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
          // Render.com'da backend URL'ini belirle
          API_BASE_URL = 'https://sekreterlik-backend.onrender.com/api';
        } else {
          API_BASE_URL = 'http://localhost:5000/api';
        }
      }
      
      console.log('🔍 Backend URL:', API_BASE_URL);
      console.log('🔍 VITE_API_BASE_URL env:', import.meta.env.VITE_API_BASE_URL);

      // Health check'i kaldırdık - direkt cleanup endpoint'ini deneyeceğiz
      // Eğer backend çalışmıyorsa, cleanup endpoint'i zaten 404 dönecek

      // Backend cleanup endpoint'ini çağır
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 saniye timeout

      const response = await fetch(`${API_BASE_URL}/auth/cleanup-orphaned-auth-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        setMessage(`✅ Temizleme tamamlandı!\n\nSilinen: ${result.deleted || 0} kullanıcı\nHata: ${result.errors || 0} kullanıcı`);
        setMessageType('success');
        
        if (result.deletedUsers && result.deletedUsers.length > 0) {
          console.log('✅ Silinen kullanıcılar:', result.deletedUsers);
        }
        
        if (result.errors && result.errors.length > 0) {
          console.warn('⚠️ Silme hataları:', result.errors);
          setMessageType('warning');
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        setMessage('Temizleme işlemi timeout oldu (30 saniye). Backend servisi yanıt vermiyor olabilir.');
        setMessageType('warning');
      } else if (error.message?.includes('CORS') || error.message?.includes('Failed to fetch')) {
        setMessage('Backend servisi erişilemiyor. Backend servisi oluşturuldu mu?');
        setMessageType('error');
      } else {
        console.error('Error cleaning up orphaned auth users:', error);
        setMessage('Temizleme işlemi sırasında hata oluştu: ' + error.message);
        setMessageType('error');
      }
    } finally {
      setIsCleaningUp(false);
    }
  };

  // Firestore'daki tüm authUid'leri temizle (Firebase Auth'da olmayan authUid'leri)
  const handleClearAuthUids = async () => {
    if (!window.confirm('Firestore\'daki tüm authUid field\'larını temizlemek istediğinize emin misiniz?\n\nBu işlem:\n- Tüm member_users dokümanlarındaki authUid field\'ını siler\n- Firebase Auth\'daki kullanıcıları SİLMEZ\n- Sadece Firestore\'daki referansları temizler\n\nSonrasında "Firebase Auth\'a Senkronize Et" butonuna tıklamanız gerekecek.\n\nDevam etmek istiyor musunuz?')) {
      return;
    }

    try {
      setIsClearingAuthUids(true);
      setMessage('');
      setMessageType('info');

      const { default: FirebaseApiService } = await import('../utils/FirebaseApiService');
      const { collection, getDocs, updateDoc, doc, deleteField } = await import('firebase/firestore');

      // Tüm member_users'ları al
      const querySnapshot = await getDocs(collection(FirebaseService.db, 'member_users'));
      
      console.log(`📊 Toplam ${querySnapshot.size} kullanıcı bulundu`);
      setMessage(`AuthUid'ler temizleniyor... (0/${querySnapshot.size})`);

      let clearedCount = 0;
      let skipCount = 0;
      const errors = [];

      for (const docSnapshot of querySnapshot.docs) {
        const data = docSnapshot.data();
        const username = data.username || docSnapshot.id;

        if (data.authUid) {
          try {
            await updateDoc(doc(FirebaseService.db, 'member_users', docSnapshot.id), {
              authUid: deleteField()
            });
            clearedCount++;
            setMessage(`AuthUid'ler temizleniyor... (${clearedCount}/${querySnapshot.size})`);
            console.log(`✅ ${clearedCount}/${querySnapshot.size} - Temizlendi: ${username}`);
          } catch (error) {
            errors.push(`${username}: ${error.message}`);
            console.error(`❌ Hata (${username}):`, error.message);
          }
        } else {
          skipCount++;
        }
      }

      // Sonuç mesajı
      let finalMessage = `✅ AuthUid temizleme tamamlandı!\n\n`;
      finalMessage += `• Temizlenen: ${clearedCount} authUid\n`;
      finalMessage += `• Atlanan: ${skipCount} (zaten yoktu)\n`;
      if (errors.length > 0) {
        finalMessage += `• Hata: ${errors.length}\n`;
        finalMessage += `\nHatalar:\n${errors.slice(0, 5).join('\n')}`;
        setMessageType('warning');
      } else {
        finalMessage += `\n⏭️ Sonraki adım: "Firebase Auth'a Senkronize Et" butonuna tıklayın`;
        setMessageType('success');
      }

      setMessage(finalMessage);
      await fetchMemberUsers();

    } catch (error) {
      console.error('Error clearing authUids:', error);
      setMessage('AuthUid temizleme sırasında hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setIsClearingAuthUids(false);
    }
  };

  // Üyeler için kullanıcı oluştur (sonuç döndürür)
  const handleCreateMemberUsersWithResults = async () => {
    try {
      // Tüm üyeleri al
      const allMembers = members.filter(m => m.tc && m.phone);
      
      if (allMembers.length === 0) {
        return { created: 0, updated: 0, errors: 0, message: 'TC ve telefon numarası olan üye bulunamadı' };
      }

      // Mevcut kullanıcıları al
      const existingUsers = await ApiService.getMemberUsers();
      const existingUsersList = existingUsers.users || existingUsers || [];
      
      let createdCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const member of allMembers) {
        try {
          // TC'yi decrypt et
          let tc = member.tc || '';
          try {
            if (tc && typeof tc === 'string' && tc.startsWith('U2FsdGVkX1')) {
              tc = decryptData(tc);
            }
          } catch (e) {
            console.error('TC decrypt hatası:', e);
          }

          // Telefon numarasını decrypt et
          let phone = member.phone || '';
          try {
            if (phone && typeof phone === 'string' && phone.startsWith('U2FsdGVkX1')) {
              phone = decryptData(phone);
            }
          } catch (e) {
            console.error('Telefon decrypt hatası:', e);
          }

          // Kullanıcı adı ve şifre belirle
          const username = (tc || '').toString().replace(/\D/g, ''); // Sadece rakamlar
          const password = (phone || '').toString().replace(/\D/g, ''); // Sadece rakamlar

          if (!username || username.length < 11) {
            errors.push(`${member.name || 'Bilinmeyen'}: Geçerli TC numarası yok`);
            errorCount++;
            continue;
          }

          if (!password || password.length < 6) {
            errors.push(`${member.name || 'Bilinmeyen'}: Geçerli telefon numarası yok (minimum 6 karakter)`);
            errorCount++;
            continue;
          }

          // Kullanıcı zaten var mı kontrol et (username veya member_id ile)
          const existingUser = existingUsersList.find(u => 
            u.username === username || 
            (u.member_id === member.id || u.memberId === member.id) ||
            (u.member_id === String(member.id) || u.memberId === String(member.id))
          );
          
          if (!existingUser) {
            // Yeni kullanıcı oluştur
            const email = `${username}@ilsekreterlik.local`;
            let authUser = null;
            try {
              authUser = await createUserWithEmailAndPassword(auth, email, password);
            } catch (authError) {
              if (authError.code !== 'auth/email-already-in-use') {
                throw authError;
              }
              // Email zaten kullanılıyorsa, mevcut kullanıcıyı bul
              console.log(`Email zaten kullanılıyor: ${email}, devam ediliyor...`);
            }

            const userData = {
              username,
              password,
              userType: 'member',
              member_id: member.id,
              memberId: member.id,
              isActive: true,
              name: member.name,
              authUid: authUser?.user?.uid || null
            };

            await FirebaseService.create('member_users', null, userData, false);
            createdCount++;
          } else {
            // Kullanıcı varsa güncelle (sadece değişmişse)
            const needsUpdate = 
              existingUser.name !== member.name ||
              existingUser.member_id !== member.id && existingUser.memberId !== member.id ||
              existingUser.userType !== 'member';
            
            if (needsUpdate) {
              const updateData = {
                userType: 'member',
                member_id: member.id,
                memberId: member.id,
                name: member.name
              };
              
              // Şifre değişmişse güncelle
              const currentPassword = existingUser.password || '';
              let decryptedCurrentPassword = currentPassword;
              try {
                if (currentPassword && typeof currentPassword === 'string' && currentPassword.startsWith('U2FsdGVkX1')) {
                  decryptedCurrentPassword = decryptData(currentPassword);
                }
              } catch (e) {
                // Decrypt edilemezse, yeni şifreyi kullan
              }
              
              if (decryptedCurrentPassword !== password) {
                updateData.password = password;
              }

              await FirebaseService.update('member_users', existingUser.id, updateData, false);
              updatedCount++;
            }
          }
        } catch (error) {
          errorCount++;
          errors.push(`${member.name || 'Bilinmeyen'}: ${error.message || 'Bilinmeyen hata'}`);
          console.error('Üye kullanıcısı oluşturma hatası:', error);
        }
      }

      return {
        created: createdCount,
        updated: updatedCount,
        errors: errorCount,
        errorMessages: errors
      };
    } catch (error) {
      console.error('Error creating member users:', error);
      return {
        created: 0,
        updated: 0,
        errors: 1,
        message: 'Üye kullanıcıları oluşturulurken hata oluştu: ' + error.message
      };
    }
  };

  // Üyeler için kullanıcı oluştur (UI için)
  const handleCreateMemberUsers = async () => {
    try {
      setIsUpdating(true);
      setMessage('');
      
      const result = await handleCreateMemberUsersWithResults();
      
      // Sonuç mesajı
      let message = `Üye kullanıcıları oluşturuldu!\n`;
      message += `• Yeni oluşturulan: ${result.created}\n`;
      message += `• Güncellenen: ${result.updated}\n`;
      if (result.errors > 0) {
        message += `• Hata: ${result.errors}\n`;
        if (result.errorMessages && result.errorMessages.length > 0) {
          message += `\nHatalar:\n${result.errorMessages.slice(0, 5).join('\n')}`;
        }
        setMessageType('warning');
      } else {
        setMessageType('success');
      }
      
      setMessage(message);
      await fetchMemberUsers();
    } catch (error) {
      console.error('Error creating member users:', error);
      setMessage('Üye kullanıcıları oluşturulurken hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Tüm kullanıcıları oluştur (Temizlik YAPMA)
  const handleProcessAllUsers = async () => {
    if (!window.confirm('Tüm kullanıcıları oluşturmak istediğinize emin misiniz?\n\nBu işlem:\n1. Üye kullanıcılarını oluşturur/günceller (TC ve telefon ile)\n2. İlçe Başkanı kullanıcılarını oluşturur/günceller\n3. Belde Başkanı kullanıcılarını oluşturur/günceller\n4. Müşahit kullanıcılarını oluşturur/günceller\n\n⚠️ NOT: Bu işlem kullanıcıları SADECE OLUŞTURUR, silmez.\n\nDevam etmek istiyor musunuz?')) {
      return;
    }

    try {
      setIsProcessingAll(true);
      setMessage('');
      setMessageType('info');

      const results = {
        members: { created: 0, updated: 0, errors: 0 },
        districtPresidents: { created: 0, updated: 0, errors: 0 },
        townPresidents: { created: 0, updated: 0, errors: 0 },
        observers: { created: 0, updated: 0, deleted: 0, errors: 0 }
      };

      // 1. Üye Kullanıcıları
      setMessage('Üye kullanıcıları oluşturuluyor...');
      try {
        const memberResult = await handleCreateMemberUsersWithResults();
        results.members.created = memberResult.created || 0;
        results.members.updated = memberResult.updated || 0;
        results.members.errors = memberResult.errors || 0;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Üye kullanıcıları hatası:', error);
        results.members.errors++;
      }

      // 2. İlçe Başkanı Kullanıcıları
      setMessage('İlçe Başkanı kullanıcıları oluşturuluyor...');
      try {
        await handleCreateDistrictPresidentUsers();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('İlçe Başkanı kullanıcıları hatası:', error);
        results.districtPresidents.errors++;
      }

      // 3. Belde Başkanı Kullanıcıları
      setMessage('Belde Başkanı kullanıcıları oluşturuluyor...');
      try {
        await handleCreateTownPresidentUsers();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Belde Başkanı kullanıcıları hatası:', error);
        results.townPresidents.errors++;
      }

      // 4. Müşahit Kullanıcıları
      setMessage('Müşahit kullanıcıları oluşturuluyor...');
      try {
        await handleCreateObserverUsers();
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Müşahit kullanıcıları hatası:', error);
        results.observers.errors++;
      }

        // Sonuç mesajı
        let finalMessage = '✅ Tüm kullanıcılar oluşturuldu!\n\n';
        finalMessage += `• Üye: ${results.members.created} oluşturuldu, ${results.members.updated} güncellendi`;
        if (results.members.errors > 0) {
          finalMessage += `, ${results.members.errors} hata`;
        }
        finalMessage += `\n`;
        finalMessage += `• İlçe Başkanı: ${results.districtPresidents.created} oluşturuldu, ${results.districtPresidents.updated} güncellendi`;
        if (results.districtPresidents.errors > 0) {
          finalMessage += `, ${results.districtPresidents.errors} hata`;
        }
        finalMessage += `\n`;
        finalMessage += `• Belde Başkanı: ${results.townPresidents.created} oluşturuldu, ${results.townPresidents.updated} güncellendi`;
        if (results.townPresidents.errors > 0) {
          finalMessage += `, ${results.townPresidents.errors} hata`;
        }
        finalMessage += `\n`;
        finalMessage += `• Müşahit: ${results.observers.created} oluşturuldu, ${results.observers.updated} güncellendi`;
        if (results.observers.errors > 0) {
          finalMessage += `, ${results.observers.errors} hata`;
        }
        finalMessage += `\n`;

        // Hata varsa warning, yoksa success
        const totalErrors = results.members.errors + results.districtPresidents.errors + 
                           results.townPresidents.errors + results.observers.errors;
        if (totalErrors > 0) {
          setMessageType('warning');
        } else {
          setMessageType('success');
        }

        setMessage(finalMessage);

      // Listeyi yenile
      await fetchMemberUsers();

    } catch (error) {
      console.error('Error processing all users:', error);
      setMessage('İşlemler sırasında hata oluştu: ' + error.message);
      setMessageType('error');
    } finally {
      setIsProcessingAll(false);
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

  // Kullanıcıları tipine göre ayır
  const memberTypeUsers = memberUsers.filter(u => 
    !u.userType || u.userType === 'member' || (u.userType !== 'musahit' && u.userType !== 'district_president' && u.userType !== 'town_president')
  );
  const districtPresidentUsers = memberUsers.filter(u => u.userType === 'district_president');
  const townPresidentUsers = memberUsers.filter(u => u.userType === 'town_president');
  const observerTypeUsers = memberUsers.filter(u => u.userType === 'musahit');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">Kullanıcı Yönetimi</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Üye ve başmüşahit kullanıcılarını görüntüleyebilirsiniz.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200"
            >
              {showCreateForm ? 'İptal' : 'Yeni Üye Kullanıcısı Oluştur'}
            </button>
            <button
              onClick={handleProcessAllUsers}
              disabled={isProcessingAll || isUpdating}
              className="bg-gradient-to-r from-blue-600 via-green-600 to-purple-600 hover:from-blue-700 hover:via-green-700 hover:to-purple-700 disabled:from-gray-400 disabled:via-gray-400 disabled:to-gray-400 text-white px-6 py-2 rounded-lg text-sm font-medium transition duration-200 flex items-center shadow-lg"
              title="Tüm kullanıcıları oluştur: İlçe Başkanı + Belde Başkanı + Müşahit (Silme yapmaz)"
            >
              {isProcessingAll || isUpdating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Oluşturuluyor...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Tüm Kullanıcıları Oluştur
                </>
              )}
            </button>
            <button
              onClick={handleClearAuthUids}
              disabled={isClearingAuthUids}
              className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200 flex items-center"
              title="Firestore'daki authUid field'larını temizle (Firebase Auth'daki kullanıcıları silmez)"
            >
              {isClearingAuthUids ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Temizleniyor...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                  </svg>
                  AuthUid'leri Temizle
                </>
              )}
            </button>
            <button
              onClick={handleSyncToFirebaseAuth}
              disabled={isSyncingToAuth}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200 flex items-center"
              title="Firestore'daki kullanıcıları Firebase Auth'a senkronize et (Eksikleri ekler)"
            >
              {isSyncingToAuth ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Senkronize Ediliyor...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Firebase Auth'a Senkronize Et
                </>
              )}
            </button>
            <button
              onClick={handleCleanupOrphanedAuthUsers}
              disabled={isCleaningUp}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200 flex items-center"
              title="⚠️ DİKKAT: Firestore'da olmayan Firebase Auth kullanıcılarını siler"
            >
              {isCleaningUp ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Temizleniyor...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Gereksiz Auth Kullanıcılarını Temizle
                </>
              )}
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

      {/* Search Box */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 border border-gray-100 dark:border-gray-700">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition duration-200"
            placeholder="Üye adı, TC, telefon veya kullanıcı adı ile ara..."
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* İlçe Başkanı Kullanıcıları Table */}
      {districtPresidentUsers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
          <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            İlçe Başkanı Kullanıcıları ({districtPresidentUsers.length})
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    İlçe ve Başkan Bilgileri
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
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {districtPresidentUsers
                  .filter((user) => {
                    if (!searchTerm) return true;
                    const searchLower = searchTerm.toLowerCase();
                    const district = districts.find(d => String(d.id) === String(user.districtId));
                    const displayName = district?.name || user.chairmanName || 'Bilinmeyen';
                    const username = (user.username || '').toLowerCase();
                    const password = (getDecryptedPassword(user) || '').toLowerCase();
                    return displayName.toLowerCase().includes(searchLower) ||
                      username.includes(searchLower) ||
                      password.includes(searchLower);
                  })
                  .map((user) => {
                    const district = districts.find(d => String(d.id) === String(user.districtId));
                    const displayName = district?.name || user.chairmanName || 'Bilinmeyen İlçe';
                    return (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{user.chairmanName || 'İlçe Başkanı'}</div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                İlçe Başkanı
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
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Belde Başkanı Kullanıcıları Table */}
      {townPresidentUsers.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
          <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Belde Başkanı Kullanıcıları ({townPresidentUsers.length})
          </h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Belde ve Başkan Bilgileri
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
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {townPresidentUsers
                  .filter((user) => {
                    if (!searchTerm) return true;
                    const searchLower = searchTerm.toLowerCase();
                    const town = towns.find(t => String(t.id) === String(user.townId));
                    const displayName = town?.name || user.chairmanName || 'Bilinmeyen';
                    const username = (user.username || '').toLowerCase();
                    const password = (getDecryptedPassword(user) || '').toLowerCase();
                    return displayName.toLowerCase().includes(searchLower) ||
                      username.includes(searchLower) ||
                      password.includes(searchLower);
                  })
                  .map((user) => {
                    const town = towns.find(t => String(t.id) === String(user.townId));
                    const displayName = town?.name || user.chairmanName || 'Bilinmeyen Belde';
                    return (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{displayName}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{user.chairmanName || 'Belde Başkanı'}</div>
                            <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              <span className="inline-flex px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                                Belde Başkanı
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
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Üye Kullanıcıları Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          Üye Kullanıcıları ({memberTypeUsers.length})
        </h4>
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
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {(() => {
                // Filter MEMBER users based on search term (exclude musahit)
                const filteredUsers = memberTypeUsers.filter((user) => {
                  if (!searchTerm) return true;
                  
                  const searchLower = searchTerm.toLowerCase();
                  
                  // Get user display info
                  let displayName = 'Bilinmeyen';
                  let displayInfo = '-';
                  
                  if (user.userType === 'town_president' && user.townId) {
                    const town = towns.find(t => String(t.id) === String(user.townId));
                    displayName = town?.name || user.chairmanName || 'Bilinmeyen Belde';
                    displayInfo = user.chairmanName || '';
                  } else if (user.userType === 'district_president' && user.districtId) {
                    displayName = user.chairmanName || 'Bilinmeyen İlçe';
                    displayInfo = 'İlçe Başkanı';
                  } else {
                    const member = members.find(m => m.id === user.member_id || m.id === user.memberId || String(m.id) === String(user.member_id) || String(m.id) === String(user.memberId));
                    displayName = member?.name || 'Bilinmeyen Üye';
                    const memberRegion = member?.region || member?.region_name || '-';
                    const memberPosition = member?.position || member?.position_name || '-';
                    displayInfo = `${memberRegion} - ${memberPosition}`;
                  }
                  
                  // Search in name, username, password, TC, phone
                  const username = (user.username || '').toLowerCase();
                  const password = (getDecryptedPassword(user) || '').toLowerCase();
                  const name = displayName.toLowerCase();
                  const info = displayInfo.toLowerCase();
                  
                  return (
                    name.includes(searchLower) ||
                    username.includes(searchLower) ||
                    password.includes(searchLower) ||
                    info.includes(searchLower)
                  );
                });
                
                if (filteredUsers.length === 0) {
                  return (
                    <tr>
                      <td colSpan="4" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz üye kullanıcısı bulunmuyor'}
                      </td>
                    </tr>
                  );
                }
                
                return filteredUsers.map((user) => {
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
                  </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Başmüşahit Kullanıcıları Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Başmüşahit Kullanıcıları ({observerTypeUsers.length})
        </h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Başmüşahit Bilgileri
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Kullanıcı Adı (Sandık No)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Şifre (TC)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Durum
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {(() => {
                // Filter OBSERVER users based on search term
                const filteredObservers = observerTypeUsers.filter((user) => {
                  if (!searchTerm) return true;
                  
                  const searchLower = searchTerm.toLowerCase();
                  const username = (user.username || '').toLowerCase();
                  const password = (getDecryptedPassword(user) || '').toLowerCase();
                  const name = (user.name || '').toLowerCase();
                  
                  return (
                    name.includes(searchLower) ||
                    username.includes(searchLower) ||
                    password.includes(searchLower)
                  );
                });
                
                if (filteredObservers.length === 0) {
                  return (
                    <tr>
                      <td colSpan="4" className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz başmüşahit kullanıcısı bulunmuyor'}
                      </td>
                    </tr>
                  );
                }
                
                return filteredObservers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name || 'Bilinmeyen'}</div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          <span className="inline-flex px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                            Başmüşahit
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100 font-mono">{user.username}</div>
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
                  </tr>
                ));
              })()}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default MemberUsersSettings;
