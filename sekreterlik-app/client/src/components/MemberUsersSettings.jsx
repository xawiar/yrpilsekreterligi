import React, { useState, useEffect } from 'react';
import ApiService from '../utils/ApiService';
import { decryptData, encryptData } from '../utils/crypto';
import FirebaseService from '../services/FirebaseService';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../hooks/useConfirm';
import ConfirmDialog from './UI/ConfirmDialog';
import MemberUserBulkActions from './MemberUserBulkActions';
import MemberUserForm from './MemberUserForm';
import MemberUsersList from './MemberUsersList';
import MemberUserPasswordResetModal from './MemberUserPasswordResetModal';

const MemberUsersSettings = () => {
  const toast = useToast();
  const { confirm, confirmDialogProps } = useConfirm();
  const [memberUsers, setMemberUsers] = useState([]);
  const [members, setMembers] = useState([]);
  const [towns, setTowns] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({ memberId: '', username: '', password: '' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isSyncingToAuth, setIsSyncingToAuth] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [isProcessingAll, setIsProcessingAll] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', password: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isCleaningOrphaned, setIsCleaningOrphaned] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [isClearingAuthUids, setIsClearingAuthUids] = useState(false);

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
      if (response.success) { setMemberUsers(response.users); }
      else { setMessage('Üye kullanıcıları alınamadı'); setMessageType('error'); }
    } catch (error) {
      console.error('Error fetching member users:', error);
      setMessage('Üye kullanıcıları alınırken hata oluştu'); setMessageType('error');
    } finally { setLoading(false); }
  };

  const fetchMembers = async () => {
    try { const response = await ApiService.getMembers(); setMembers(response); }
    catch (error) { console.error('Error fetching members:', error); }
  };

  const fetchTowns = async () => {
    try { const response = await ApiService.getTowns(); setTowns(response || []); }
    catch (error) { console.error('Error fetching towns:', error); }
  };

  const fetchDistricts = async () => {
    try { const response = await ApiService.getDistricts(); setDistricts(response || []); }
    catch (error) { console.error('Error fetching districts:', error); }
  };

  const handlePasswordReset = async () => {
    if (!passwordResetUser) return;
    if (!newPassword || newPassword.length < 6) {
      setMessage('Şifre en az 6 karakter olmalıdır'); setMessageType('error'); return;
    }
    try {
      setIsResettingPassword(true);
      const response = await ApiService.updateMemberUser(passwordResetUser.id, passwordResetUser.username, newPassword);
      if (response.success) {
        let msg = 'Sifre basariyla sifirlandi';
        if (response.firebaseAuthUpdated === false) {
          msg += '\n⚠️ Not: Firebase Auth sifresi guncellenemedi (kullanici Firebase Auth\'da bulunamadi). Kullanici bir sonraki login\'de yeni sifre ile giris yapabilir.';
        }
        toast.success(msg);
        setPasswordResetUser(null); setNewPassword('');
        await fetchMemberUsers();
      } else {
        setMessage(response.message || 'Sifre sifirlanirken hata olustu'); setMessageType('error');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      setMessage('Sifre sifirlanirken hata olustu: ' + (error.message || 'Bilinmeyen hata')); setMessageType('error');
    } finally { setIsResettingPassword(false); }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!createForm.memberId || !createForm.username || !createForm.password) {
      setMessage('Tüm alanlar zorunludur'); setMessageType('error'); return;
    }
    try {
      const response = await ApiService.createMemberUser(createForm.memberId, createForm.username, createForm.password);
      if (response.success) {
        setMessage('Kullanıcı başarıyla oluşturuldu'); setMessageType('success');
        setShowCreateForm(false); setCreateForm({ memberId: '', username: '', password: '' });
        await fetchMemberUsers();
      } else { setMessage(response.message || 'Kullanıcı oluşturulurken hata oluştu'); setMessageType('error'); }
    } catch (error) {
      console.error('Error creating user:', error);
      setMessage('Kullanıcı oluşturulurken hata oluştu'); setMessageType('error');
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
      setIsUpdating(true); setMessage('');
      const districtOfficials = await ApiService.getDistrictOfficials();
      const districtPresidents = districtOfficials.filter(official => official.chairman_name && official.chairman_phone);
      if (districtPresidents.length === 0) { setMessage('İlçe başkanı bulunamadı (başkan adı ve telefonu olan ilçeler)'); setMessageType('error'); return; }
      const existingUsers = await ApiService.getMemberUsers();
      let createdCount = 0, updatedCount = 0, errorCount = 0;
      const errors = [];
      for (const official of districtPresidents) {
        try {
          const district = districts.find(d => String(d.id) === String(official.district_id));
          if (!district) { errors.push(`${official.chairman_name || 'Bilinmeyen'}: İlçe bulunamadı`); errorCount++; continue; }
          const username = district.name.toLowerCase().replace(/ğ/g, 'g').replace(/Ğ/g, 'G').replace(/ü/g, 'u').replace(/Ü/g, 'U').replace(/ş/g, 's').replace(/Ş/g, 'S').replace(/ı/g, 'i').replace(/İ/g, 'I').replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/ç/g, 'c').replace(/Ç/g, 'C').replace(/[^a-z0-9]/g, '');
          const password = (official.chairman_phone || '').replace(/\D/g, '');
          if (!password || password.length < 6) { errors.push(`${official.chairman_name}: Geçerli telefon numarası yok`); errorCount++; continue; }
          const existingUser = existingUsers.users?.find(u => u.username === username || (u.userType === 'district_president' && String(u.districtId) === String(official.district_id)));
          if (!existingUser) {
            await FirebaseService.create('member_users', null, { username, password: encryptData(password), userType: 'district_president', districtId: official.district_id, isActive: true, chairmanName: official.chairman_name, authUid: null }, false);
            createdCount++;
          } else {
            const updateData = { userType: 'district_president', districtId: official.district_id, chairmanName: official.chairman_name };
            if (existingUser.password !== password) updateData.password = encryptData(password);
            await FirebaseService.update('member_users', existingUser.id, updateData, false);
            updatedCount++;
          }
        } catch (error) { errorCount++; errors.push(`${official.chairman_name || 'Bilinmeyen'}: ${error.message || 'Bilinmeyen hata'}`); console.error('İlçe başkanı kullanıcısı oluşturma hatası:', error); }
      }
      let message = `İlçe başkanı kullanıcıları oluşturuldu!\n• Yeni oluşturulan: ${createdCount}\n• Güncellenen: ${updatedCount}\n`;
      if (errorCount > 0) { message += `• Hata: ${errorCount}\n\nHatalar:\n${errors.slice(0, 5).join('\n')}`; setMessageType('warning'); } else { setMessageType('success'); }
      setMessage(message); await fetchMemberUsers();
    } catch (error) { console.error('Error creating district president users:', error); setMessage('İlçe başkanı kullanıcıları oluşturulurken hata oluştu: ' + error.message); setMessageType('error'); }
    finally { setIsUpdating(false); }
  };

  // Belde başkanları için kullanıcı oluştur
  const handleCreateTownPresidentUsers = async () => {
    try {
      setIsUpdating(true); setMessage('');
      const townOfficials = await ApiService.getTownOfficials();
      const townPresidents = townOfficials.filter(official => official.chairman_name && official.chairman_phone);
      if (townPresidents.length === 0) { setMessage('Belde başkanı bulunamadı (başkan adı ve telefonu olan beldeler)'); setMessageType('error'); return; }
      const existingUsers = await ApiService.getMemberUsers();
      let createdCount = 0, updatedCount = 0, errorCount = 0;
      const errors = [];
      for (const official of townPresidents) {
        try {
          const town = towns.find(t => String(t.id) === String(official.town_id));
          if (!town) { errors.push(`${official.chairman_name || 'Bilinmeyen'}: Belde bulunamadı`); errorCount++; continue; }
          const username = town.name.toLowerCase().replace(/ğ/g, 'g').replace(/Ğ/g, 'G').replace(/ü/g, 'u').replace(/Ü/g, 'U').replace(/ş/g, 's').replace(/Ş/g, 'S').replace(/ı/g, 'i').replace(/İ/g, 'I').replace(/ö/g, 'o').replace(/Ö/g, 'O').replace(/ç/g, 'c').replace(/Ç/g, 'C').replace(/[^a-z0-9]/g, '');
          const password = (official.chairman_phone || '').replace(/\D/g, '');
          if (!password || password.length < 6) { errors.push(`${official.chairman_name}: Geçerli telefon numarası yok`); errorCount++; continue; }
          const existingUser = existingUsers.users?.find(u => u.username === username || (u.userType === 'town_president' && String(u.townId) === String(official.town_id)));
          if (!existingUser) {
            await FirebaseService.create('member_users', null, { username, password: encryptData(password), userType: 'town_president', townId: official.town_id, isActive: true, chairmanName: official.chairman_name, authUid: null }, false);
            createdCount++;
          } else {
            const updateData = { userType: 'town_president', townId: official.town_id, chairmanName: official.chairman_name };
            if (existingUser.password !== password) updateData.password = encryptData(password);
            await FirebaseService.update('member_users', existingUser.id, updateData, false);
            updatedCount++;
          }
        } catch (error) { errorCount++; errors.push(`${official.chairman_name || 'Bilinmeyen'}: ${error.message || 'Bilinmeyen hata'}`); console.error('Belde başkanı kullanıcısı oluşturma hatası:', error); }
      }
      let message = `Belde başkanı kullanıcıları oluşturuldu!\n• Yeni oluşturulan: ${createdCount}\n• Güncellenen: ${updatedCount}\n`;
      if (errorCount > 0) { message += `• Hata: ${errorCount}\n\nHatalar:\n${errors.slice(0, 5).join('\n')}`; setMessageType('warning'); } else { setMessageType('success'); }
      setMessage(message); await fetchMemberUsers();
    } catch (error) { console.error('Error creating town president users:', error); setMessage('Belde başkanı kullanıcıları oluşturulurken hata oluştu: ' + error.message); setMessageType('error'); }
    finally { setIsUpdating(false); }
  };

  // Başmüşahitler için kullanıcı oluştur
  const handleCreateObserverUsers = async () => {
    try {
      setIsUpdating(true); setMessage('');
      const observers = await ApiService.getBallotBoxObservers();
      const chiefObservers = observers.filter(obs => obs.is_chief_observer === true || obs.is_chief_observer === 1);
      const existingUsers = await ApiService.getMemberUsers();
      const musahitUsers = (existingUsers.users || []).filter(u => u.userType === 'musahit' && u.observerId);
      const currentObserverIds = new Set(chiefObservers.map(obs => String(obs.id)));
      let deletedCount = 0;
      const deletedErrors = [];
      for (const musahitUser of musahitUsers) {
        const observerId = String(musahitUser.observerId);
        if (!currentObserverIds.has(observerId)) {
          try { await ApiService.deleteMemberUser(musahitUser.id); deletedCount++; }
          catch (deleteError) { deletedErrors.push(`${musahitUser.username || 'Bilinmeyen'}: ${deleteError.message || 'Silme hatası'}`); }
        }
      }
      if (chiefObservers.length === 0) {
        let message = deletedCount > 0 ? `Silinen başmüşahit kullanıcıları temizlendi!\n• Silinen: ${deletedCount}\n` : 'Başmüşahit bulunamadı';
        if (deletedErrors.length > 0) { message += `\nSilme hataları:\n${deletedErrors.slice(0, 5).join('\n')}`; setMessageType('warning'); }
        else { setMessageType(deletedCount > 0 ? 'success' : 'error'); }
        setMessage(message); await fetchMemberUsers(); return;
      }
      const updatedUsers = await ApiService.getMemberUsers();
      const ballotBoxes = await ApiService.getBallotBoxes();
      let createdCount = 0, updatedCount = 0, errorCount = 0;
      const errors = [];
      for (const observer of chiefObservers) {
        try {
          let tc = observer.tc || '';
          try { if (tc && tc.startsWith('U2FsdGVkX1')) tc = decryptData(tc); } catch (e) { console.error('TC decrypt hatası:', e); }
          let username, password;
          if (observer.ballot_box_id) {
            const ballotBox = ballotBoxes.find(bb => String(bb.id) === String(observer.ballot_box_id));
            username = (ballotBox && ballotBox.ballot_number) ? String(ballotBox.ballot_number) : tc;
          } else { username = tc; }
          password = tc;
          const existingUser = updatedUsers.users?.find(u => u.username === username);
          if (!existingUser) {
            await FirebaseService.create('member_users', null, { username, password: encryptData(password), userType: 'musahit', observerId: observer.id, isActive: true, name: observer.name, tc: observer.tc, authUid: null }, false);
            createdCount++;
          } else {
            const updateData = { userType: 'musahit', observerId: observer.id, name: observer.name };
            if (existingUser.password !== password) updateData.password = encryptData(password);
            await FirebaseService.update('member_users', existingUser.id, updateData, false);
            updatedCount++;
          }
        } catch (error) { errorCount++; errors.push(`${observer.name || 'Bilinmeyen'}: ${error.message || 'Bilinmeyen hata'}`); console.error('Başmüşahit kullanıcısı oluşturma hatası:', error); }
      }
      let message = `Müşahit şifreleri oluşturuldu!\n`;
      if (deletedCount > 0) message += `• Silinen: ${deletedCount}\n`;
      message += `• Yeni oluşturulan: ${createdCount}\n• Güncellenen: ${updatedCount}\n`;
      const allErrors = [...deletedErrors, ...errors];
      if (errorCount > 0 || deletedErrors.length > 0) { message += `• Hata: ${errorCount + deletedErrors.length}\n`; if (allErrors.length > 0) message += `\nHatalar:\n${allErrors.slice(0, 5).join('\n')}`; setMessageType('warning'); }
      else { setMessageType('success'); }
      setMessage(message); await fetchMemberUsers();
    } catch (error) { console.error('Error creating observer users:', error); setMessage('Müşahit şifreleri oluşturulurken hata oluştu: ' + error.message); setMessageType('error'); }
    finally { setIsUpdating(false); }
  };

  // Üyeler için kullanıcı oluştur (sonuç döndürür)
  const handleCreateMemberUsersWithResults = async () => {
    try {
      const allMembers = members.filter(m => m.tc && m.phone);
      if (allMembers.length === 0) return { created: 0, updated: 0, errors: 0, message: 'TC ve telefon numarası olan üye bulunamadı' };
      const existingUsers = await ApiService.getMemberUsers();
      const existingUsersList = existingUsers.users || existingUsers || [];
      let createdCount = 0, updatedCount = 0, errorCount = 0;
      const errors = [];
      for (const member of allMembers) {
        try {
          let tc = member.tc || '';
          try { if (tc && typeof tc === 'string' && tc.startsWith('U2FsdGVkX1')) tc = decryptData(tc); } catch (e) { console.error('TC decrypt hatası:', e); }
          let phone = member.phone || '';
          try { if (phone && typeof phone === 'string' && phone.startsWith('U2FsdGVkX1')) phone = decryptData(phone); } catch (e) { console.error('Telefon decrypt hatası:', e); }
          const username = (tc || '').toString().replace(/\D/g, '');
          const password = (phone || '').toString().replace(/\D/g, '');
          if (!username || username.length < 11) { errors.push(`${member.name || 'Bilinmeyen'}: Geçerli TC numarası yok`); errorCount++; continue; }
          if (!password || password.length < 6) { errors.push(`${member.name || 'Bilinmeyen'}: Geçerli telefon numarası yok (minimum 6 karakter)`); errorCount++; continue; }
          const existingUser = existingUsersList.find(u => u.username === username || (u.member_id === member.id || u.memberId === member.id) || (u.member_id === String(member.id) || u.memberId === String(member.id)));
          if (!existingUser) {
            // Firebase Auth hesabı onMemberUserCreate trigger'ı tarafından otomatik oluşturulur
            await FirebaseService.create('member_users', null, { username, password: encryptData(password), userType: 'member', member_id: member.id, memberId: member.id, isActive: true, name: member.name, authUid: null }, false);
            createdCount++;
          } else {
            const needsUpdate = existingUser.name !== member.name || (existingUser.member_id !== member.id && existingUser.memberId !== member.id) || existingUser.userType !== 'member';
            if (needsUpdate) {
              const updateData = { userType: 'member', member_id: member.id, memberId: member.id, name: member.name };
              let decryptedCurrentPassword = existingUser.password || '';
              try { if (decryptedCurrentPassword && typeof decryptedCurrentPassword === 'string' && decryptedCurrentPassword.startsWith('U2FsdGVkX1')) decryptedCurrentPassword = decryptData(decryptedCurrentPassword); } catch (e) {}
              if (decryptedCurrentPassword !== password) updateData.password = encryptData(password);
              await FirebaseService.update('member_users', existingUser.id, updateData, false);
              updatedCount++;
            }
          }
        } catch (error) { errorCount++; errors.push(`${member.name || 'Bilinmeyen'}: ${error.message || 'Bilinmeyen hata'}`); console.error('Üye kullanıcısı oluşturma hatası:', error); }
      }
      return { created: createdCount, updated: updatedCount, errors: errorCount, errorMessages: errors };
    } catch (error) { console.error('Error creating member users:', error); return { created: 0, updated: 0, errors: 1, message: 'Üye kullanıcıları oluşturulurken hata oluştu: ' + error.message }; }
  };

  // Sorumluları için kullanıcı oluştur
  const handleCreateCoordinatorUsers = async () => {
    try {
      setIsUpdating(true); setMessage('');
      const coordinators = await ApiService.getElectionCoordinators();
      if (coordinators.length === 0) { setMessage('Sorumlu bulunamadı'); setMessageType('error'); return; }
      const existingUsers = await ApiService.getMemberUsers();
      let createdCount = 0, updatedCount = 0, errorCount = 0;
      const errors = [];
      for (const coordinator of coordinators) {
        try {
          if (!coordinator.tc || !coordinator.phone) continue;
          const username = coordinator.tc;
          let password = coordinator.phone.replace(/\D/g, '');
          if (!password || password.length < 6) { if (!password) { errors.push(`${coordinator.name || 'Bilinmeyen'}: Geçerli telefon numarası yok`); errorCount++; continue; } password = password.padStart(6, '0'); }
          const existingUser = (existingUsers.users || []).find(u => u.coordinatorId === coordinator.id || u.coordinator_id === coordinator.id || (u.userType === 'coordinator' && u.username === username));
          if (existingUser) {
            const updateData = { userType: 'coordinator', coordinatorId: coordinator.id, coordinator_id: coordinator.id };
            if (existingUser.password !== password) updateData.password = encryptData(password);
            await FirebaseService.update('member_users', existingUser.id, updateData, false);
            updatedCount++;
          } else {
            await FirebaseService.create('member_users', null, { username, password: encryptData(password), userType: 'coordinator', coordinatorId: coordinator.id, coordinator_id: coordinator.id, isActive: true, name: coordinator.name, tc: coordinator.tc, phone: coordinator.phone, authUid: null }, false);
            createdCount++;
          }
        } catch (error) { errorCount++; errors.push(`${coordinator.name || 'Bilinmeyen'}: ${error.message || 'Bilinmeyen hata'}`); console.error('Sorumlu kullanıcısı oluşturma hatası:', error); }
      }
      let message = `Sorumlu kullanıcıları oluşturuldu!\n• Yeni oluşturulan: ${createdCount}\n• Güncellenen: ${updatedCount}\n`;
      if (errorCount > 0) { message += `• Hata: ${errorCount}\n\nHatalar:\n${errors.slice(0, 5).join('\n')}`; setMessageType('warning'); } else { setMessageType('success'); }
      setMessage(message); await fetchMemberUsers();
    } catch (error) { console.error('Error creating coordinator users:', error); setMessage('Sorumlu kullanıcıları oluşturulurken hata oluştu: ' + error.message); setMessageType('error'); }
    finally { setIsUpdating(false); }
  };

  // Tüm kullanıcıları oluştur
  const handleProcessAllUsers = async () => {
    const confirmed = await confirm({ title: 'Tüm Kullanıcıları Oluştur', message: 'Tüm kullanıcıları oluşturmak istediğinize emin misiniz?\n\nBu işlem:\n1. Üye kullanıcılarını oluşturur/günceller (TC ve telefon ile)\n2. İlçe Başkanı kullanıcılarını oluşturur/günceller\n3. Belde Başkanı kullanıcılarını oluşturur/günceller\n4. Müşahit kullanıcılarını oluşturur/günceller\n5. Sorumlu kullanıcılarını oluşturur/günceller\n\nDevam etmek istiyor musunuz?' });
    if (!confirmed) return;
    try {
      setIsProcessingAll(true); setMessage(''); setMessageType('info');
      const results = { members: { created: 0, updated: 0, errors: 0 }, districtPresidents: { created: 0, updated: 0, errors: 0 }, townPresidents: { created: 0, updated: 0, errors: 0 }, observers: { created: 0, updated: 0, deleted: 0, errors: 0 }, coordinators: { created: 0, updated: 0, errors: 0 } };

      setMessage('Üye kullanıcıları oluşturuluyor...');
      try { const memberResult = await handleCreateMemberUsersWithResults(); results.members.created = memberResult.created || 0; results.members.updated = memberResult.updated || 0; results.members.errors = memberResult.errors || 0; await new Promise(resolve => setTimeout(resolve, 1000)); } catch (error) { console.error('Üye kullanıcıları hatası:', error); results.members.errors++; }

      setMessage('İlçe Başkanı kullanıcıları oluşturuluyor...');
      try { await handleCreateDistrictPresidentUsers(); await new Promise(resolve => setTimeout(resolve, 1000)); } catch (error) { console.error('İlçe Başkanı kullanıcıları hatası:', error); results.districtPresidents.errors++; }

      setMessage('Belde Başkanı kullanıcıları oluşturuluyor...');
      try { await handleCreateTownPresidentUsers(); await new Promise(resolve => setTimeout(resolve, 1000)); } catch (error) { console.error('Belde Başkanı kullanıcıları hatası:', error); results.townPresidents.errors++; }

      setMessage('Müşahit kullanıcıları oluşturuluyor...');
      try { await handleCreateObserverUsers(); await new Promise(resolve => setTimeout(resolve, 1000)); } catch (error) { console.error('Müşahit kullanıcıları hatası:', error); results.observers.errors++; }

      setMessage('Sorumlu kullanıcıları oluşturuluyor...');
      try { await handleCreateCoordinatorUsers(); await new Promise(resolve => setTimeout(resolve, 1000)); } catch (error) { console.error('Sorumlu kullanıcıları hatası:', error); results.coordinators.errors++; }

      let finalMessage = 'Tüm kullanıcılar oluşturuldu!\n\n';
      finalMessage += `• Üye: ${results.members.created} oluşturuldu, ${results.members.updated} güncellendi${results.members.errors > 0 ? `, ${results.members.errors} hata` : ''}\n`;
      finalMessage += `• İlçe Başkanı: ${results.districtPresidents.created} oluşturuldu, ${results.districtPresidents.updated} güncellendi${results.districtPresidents.errors > 0 ? `, ${results.districtPresidents.errors} hata` : ''}\n`;
      finalMessage += `• Belde Başkanı: ${results.townPresidents.created} oluşturuldu, ${results.townPresidents.updated} güncellendi${results.townPresidents.errors > 0 ? `, ${results.townPresidents.errors} hata` : ''}\n`;
      finalMessage += `• Müşahit: ${results.observers.created} oluşturuldu, ${results.observers.updated} güncellendi${results.observers.errors > 0 ? `, ${results.observers.errors} hata` : ''}\n`;
      finalMessage += `• Sorumlu: ${results.coordinators.created} oluşturuldu, ${results.coordinators.updated} güncellendi${results.coordinators.errors > 0 ? `, ${results.coordinators.errors} hata` : ''}\n`;

      const totalErrors = results.members.errors + results.districtPresidents.errors + results.townPresidents.errors + results.observers.errors + results.coordinators.errors;
      setMessageType(totalErrors > 0 ? 'warning' : 'success');
      setMessage(finalMessage);
      await fetchMemberUsers();
    } catch (error) { console.error('Error processing all users:', error); setMessage('İşlemler sırasında hata oluştu: ' + error.message); setMessageType('error'); }
    finally { setIsProcessingAll(false); }
  };

  // Tek bir üye kullanıcısını sil
  const handleDeleteMemberUser = async (user) => {
    const displayName = user.name || user.username || 'Bu kullanıcı';
    const confirmed = await confirm({
      title: 'Kullanıcıyı Sil',
      message: `"${displayName}" kullanıcısını silmek istediğinize emin misiniz?\n\nBu işlem GERİ ALINAMAZ.`,
      confirmText: 'Sil',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      const response = await ApiService.deleteMemberUser(user.id);
      if (response.success) {
        toast.success(response.message || 'Kullanıcı silindi');
        await fetchMemberUsers();
      } else {
        toast.error(response.message || 'Silme başarısız');
      }
    } catch (error) {
      console.error('Error deleting member user:', error);
      toast.error('Silinirken hata: ' + (error.message || 'Bilinmeyen hata'));
    }
  };

  // Tüm üye kullanıcılarını sil
  const handleDeleteAllMemberUsers = async () => {
    const confirmed = await confirm({
      title: 'TÜM Kullanıcıları Sil',
      message: 'DİKKAT: Üye kullanıcıları sayfasındaki TÜM kullanıcıları silmek istediğinize emin misiniz?\n\nBu işlem GERİ ALINAMAZ!\n\nDevam etmek istiyor musunuz?\n\nBu işlem GERİ ALINAMAZ. Son onay olarak devam etmek istediğinize emin misiniz?',
      confirmText: 'Evet, tümünü sil',
      variant: 'danger'
    });
    if (!confirmed) return;
    try {
      setIsDeletingAll(true); setMessage(''); setMessageType('info');
      const allMemberUsers = await ApiService.getMemberUsers();
      const memberUsersList = allMemberUsers.users || allMemberUsers || [];
      if (memberUsersList.length === 0) { setMessage('Silinecek kullanıcı bulunamadı.'); setMessageType('info'); return; }
      setMessage(`${memberUsersList.length} kullanıcı siliniyor...`);
      let deletedCount = 0, errorCount = 0;
      const errors = [];
      for (const user of memberUsersList) {
        try {
          const response = await ApiService.deleteMemberUser(user.id);
          if (response.success) { deletedCount++; setMessage(`${deletedCount}/${memberUsersList.length} kullanıcı silindi...`); }
          else { errorCount++; errors.push(`${user.username || user.id}: ${response.message || 'Silme hatası'}`); }
        } catch (error) { errorCount++; errors.push(`${user.username || user.id}: ${error.message || 'Bilinmeyen hata'}`); }
      }
      let message = `Tüm kullanıcılar silindi!\n\n• Toplam: ${memberUsersList.length} kullanıcı\n• Silinen: ${deletedCount} kullanıcı\n`;
      if (errorCount > 0) { message += `• Hata: ${errorCount} kullanıcı\n\nHatalar:\n${errors.slice(0, 10).join('\n')}`; setMessageType('warning'); } else { setMessageType('success'); }
      setMessage(message); await fetchMemberUsers();
    } catch (error) { console.error('Error deleting all member users:', error); setMessage('Tüm kullanıcıları silme sırasında hata oluştu: ' + error.message); setMessageType('error'); }
    finally { setIsDeletingAll(false); }
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
      <MemberUserBulkActions
        showCreateForm={showCreateForm}
        setShowCreateForm={setShowCreateForm}
        handleProcessAllUsers={handleProcessAllUsers}
        handleDeleteAllMemberUsers={handleDeleteAllMemberUsers}
        isProcessingAll={isProcessingAll}
        isUpdating={isUpdating}
        isDeletingAll={isDeletingAll}
      />

      {showCreateForm && (
        <MemberUserForm
          createForm={createForm}
          setCreateForm={setCreateForm}
          handleCreateUser={handleCreateUser}
          handleMemberSelect={handleMemberSelect}
          members={members}
          memberUsers={memberUsers}
          setShowCreateForm={setShowCreateForm}
        />
      )}

      {message && (
        <div className={`p-3 rounded-lg shadow-sm ${
          messageType === 'success' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 border border-green-200 dark:border-green-700'
          : messageType === 'warning' ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-700'
          : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-700'
        }`}>
          {message}
        </div>
      )}

      {/* Search Box */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 border border-gray-200 dark:border-gray-700">
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

      <MemberUsersList
        memberUsers={memberUsers}
        members={members}
        towns={towns}
        districts={districts}
        searchTerm={searchTerm}
        setPasswordResetUser={setPasswordResetUser}
        setNewPassword={setNewPassword}
        setIsResettingPassword={setIsResettingPassword}
        onDeleteUser={handleDeleteMemberUser}
      />

      {isResettingPassword && passwordResetUser && (
        <MemberUserPasswordResetModal
          passwordResetUser={passwordResetUser}
          newPassword={newPassword}
          setNewPassword={setNewPassword}
          handlePasswordReset={handlePasswordReset}
          setIsResettingPassword={setIsResettingPassword}
          setPasswordResetUser={setPasswordResetUser}
        />
      )}

      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};

export default MemberUsersSettings;
