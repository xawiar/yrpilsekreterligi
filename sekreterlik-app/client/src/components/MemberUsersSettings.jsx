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
      
      if (chiefObservers.length === 0) {
        setMessage('Başmüşahit bulunamadı');
        setMessageType('error');
        return;
      }

      // Mevcut kullanıcıları al
      const existingUsers = await ApiService.getMemberUsers();
      const existingUsernames = new Set(existingUsers.users?.map(u => u.username) || []);
      
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
              onClick={handleCreateDistrictPresidentUsers}
              disabled={isUpdating}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200 flex items-center"
            >
              {isUpdating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Oluşturuluyor...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  İlçe Başkanı Kullanıcısı Oluştur
                </>
              )}
            </button>
            <button
              onClick={handleCreateTownPresidentUsers}
              disabled={isUpdating}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200 flex items-center"
            >
              {isUpdating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Oluşturuluyor...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Belde Başkanı Kullanıcısı Oluştur
                </>
              )}
            </button>
            <button
              onClick={handleCreateObserverUsers}
              disabled={isUpdating}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200 flex items-center"
            >
              {isUpdating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Oluşturuluyor...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Müşahit Şifresi Oluştur
                </>
              )}
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition duration-200"
            >
              {showCreateForm ? 'İptal' : 'Yeni Üye Kullanıcısı Oluştur'}
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
