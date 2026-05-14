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
  const [isResettingAllAuth, setIsResettingAllAuth] = useState(false);
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

  // Başmüşahitler için kullanıcı oluştur (Capabilities Model).
  // Yeni mantık:
  //  - username = TC, password = telefon (telefon yoksa fallback: TC)
  //  - Aynı TC'li üye kullanıcısı varsa o kayda observerId eklenir
  //    (üye + müşahit hibrit kişi için tek kullanıcı)
  //  - Üye değilse TC ile yeni kullanıcı oluşturulur (userType='musahit')
  //  - Eski "İlçeKodu+SandıkNo" formatlı kayıtlar tespit edilip silinir
  const handleCreateObserverUsers = async () => {
    try {
      setIsUpdating(true); setMessage('');
      const observers = await ApiService.getBallotBoxObservers();
      const chiefObservers = observers.filter(obs => obs.is_chief_observer === true || obs.is_chief_observer === 1);
      const existingUsers = await ApiService.getMemberUsers();
      const allUsers = existingUsers.users || [];

      const decryptIfNeeded = (v) => {
        if (!v || typeof v !== 'string') return v || '';
        try { return v.startsWith('U2FsdGVkX1') ? decryptData(v) : v; } catch { return v; }
      };

      // TC'ye göre üye haritası (decrypt edilmiş)
      const memberByTc = new Map();
      for (const m of members) {
        const mTc = decryptIfNeeded(m.tc || '').toString().replace(/\D/g, '');
        if (mTc) memberByTc.set(mTc, m);
      }

      // Aktif başmüşahit observerId set'i (silinmiş başmüşahitlerin kullanıcılarını temizlemek için)
      const currentObserverIds = new Set(chiefObservers.map(obs => String(obs.id)));

      // 1) Temizlik: eski format ve artık başmüşahit olmayan kayıtları sil/sıfırla
      let cleanedCount = 0;
      const cleanErrors = [];
      for (const u of allUsers) {
        const isLegacyMusahitOnly = u.userType === 'musahit' && !u.member_id && !u.memberId;
        const isOrphanObserverId = u.observerId && !currentObserverIds.has(String(u.observerId));
        if (isLegacyMusahitOnly) {
          // Saf müşahit kayıt → tamamen sil (yeni döngüde TC ile yeniden açılacak)
          try { await ApiService.deleteMemberUser(u.id); cleanedCount++; }
          catch (e) { cleanErrors.push(`${u.username || u.id}: ${e.message || 'silinmedi'}`); }
        } else if (isOrphanObserverId) {
          // Üye+müşahit hibridde başmüşahit kaydı silinmiş → observerId'yi temizle
          try { await FirebaseService.update('member_users', u.id, { observerId: null }, false); }
          catch (e) { /* sessiz */ }
        }
      }

      if (chiefObservers.length === 0) {
        let msg = cleanedCount > 0 ? `Eski müşahit kayıtları temizlendi (${cleanedCount}).\n` : 'Başmüşahit bulunamadı.';
        if (cleanErrors.length > 0) { msg += `\nHatalar:\n${cleanErrors.slice(0,5).join('\n')}`; setMessageType('warning'); }
        else { setMessageType(cleanedCount > 0 ? 'success' : 'error'); }
        setMessage(msg); await fetchMemberUsers(); return;
      }

      // Temizlik sonrası kullanıcı listesini yenile
      const refreshed = await ApiService.getMemberUsers();
      const usersList = refreshed.users || [];

      // BallotBox haritası — sandık ID → ballot_number (login sırasında ek query yapmamak için
      // member_users kaydında doğrudan tutulur; Firestore izin sorunlarını da önler)
      const ballotBoxes = await ApiService.getBallotBoxes();
      const ballotBoxById = new Map();
      for (const bb of (ballotBoxes || [])) {
        ballotBoxById.set(String(bb.id), bb);
      }

      // 2) Her başmüşahit için kullanıcı oluştur veya mevcut üye kaydına observerId ekle
      let createdCount = 0, updatedCount = 0, errorCount = 0;
      const errors = [];
      for (const observer of chiefObservers) {
        try {
          const tc = decryptIfNeeded(observer.tc || '').toString().replace(/\D/g, '');
          if (!tc || tc.length < 11) {
            errors.push(`${observer.name || 'Bilinmeyen'}: Geçerli TC yok`);
            errorCount++;
            continue;
          }

          // Telefon: önce eşleşen üyeden, yoksa observer kaydından
          const matchingMember = memberByTc.get(tc) || null;
          let phoneRaw = '';
          if (matchingMember && matchingMember.phone) phoneRaw = matchingMember.phone;
          else if (observer.phone) phoneRaw = observer.phone;
          const phone = decryptIfNeeded(phoneRaw).toString().replace(/\D/g, '');

          // Şifre: telefon ≥6 hane ise telefon, yoksa fallback TC
          const username = tc;
          const password = (phone && phone.length >= 6) ? phone : tc;

          // Sandık metaverisi (login sırasında ek query yapılmasın diye doğrudan kayda yazılıyor)
          const ballotBoxId = observer.ballot_box_id || null;
          const ballotBox = ballotBoxId ? ballotBoxById.get(String(ballotBoxId)) : null;
          const ballotNumber = ballotBox?.ballot_number || null;

          // Mevcut kullanıcıyı bul (TC ile)
          const existing = usersList.find(u => u.username === username
            || (matchingMember && (u.member_id === matchingMember.id || u.memberId === matchingMember.id)));

          if (existing) {
            // Mevcut kayda observerId ekle, gerekirse member bağını ve şifreyi güncelle
            const updateData = {
              observerId: observer.id,
              name: existing.name || observer.name || matchingMember?.name,
              ballotBoxId: ballotBoxId,
              ballot_box_id: ballotBoxId,
              ballotNumber: ballotNumber,
              ballot_number: ballotNumber,
            };
            if (matchingMember) {
              updateData.member_id = matchingMember.id;
              updateData.memberId = matchingMember.id;
              if (existing.userType !== 'member') updateData.userType = 'member';
            } else if (!existing.userType || existing.userType === 'musahit') {
              updateData.userType = 'musahit';
            }
            // Şifre senkronu (decrypt edip karşılaştır)
            const decryptedExisting = decryptIfNeeded(existing.password || '');
            if (decryptedExisting !== password) {
              updateData.password = encryptData(password);
            }
            // Username TC olmalı (eski format kayıt güncellenirse)
            if (existing.username !== username) updateData.username = username;
            await FirebaseService.update('member_users', existing.id, updateData, false);
            updatedCount++;
          } else {
            // Yeni kullanıcı: TC + telefon
            const userData = {
              username,
              password: encryptData(password),
              userType: matchingMember ? 'member' : 'musahit',
              observerId: observer.id,
              ballotBoxId: ballotBoxId,
              ballot_box_id: ballotBoxId,
              ballotNumber: ballotNumber,
              ballot_number: ballotNumber,
              isActive: true,
              name: observer.name || matchingMember?.name || '',
              tc: observer.tc,
              authUid: null,
            };
            if (matchingMember) {
              userData.member_id = matchingMember.id;
              userData.memberId = matchingMember.id;
            }
            await FirebaseService.create('member_users', null, userData, false);
            createdCount++;
          }
        } catch (error) {
          errorCount++;
          errors.push(`${observer.name || 'Bilinmeyen'}: ${error.message || 'Bilinmeyen hata'}`);
          console.error('Başmüşahit kullanıcısı oluşturma hatası:', error);
        }
      }

      let msg = 'Müşahit kullanıcıları senkronize edildi!\n';
      if (cleanedCount > 0) msg += `• Eski format temizlendi: ${cleanedCount}\n`;
      msg += `• Yeni: ${createdCount}\n• Güncellenen: ${updatedCount}\n`;
      const allErrors = [...cleanErrors, ...errors];
      if (errorCount > 0 || cleanErrors.length > 0) {
        msg += `• Hata: ${errorCount + cleanErrors.length}\n`;
        if (allErrors.length > 0) msg += `\nHatalar:\n${allErrors.slice(0, 5).join('\n')}`;
        setMessageType('warning');
      } else {
        setMessageType('success');
      }
      setMessage(msg);
      await fetchMemberUsers();
    } catch (error) {
      console.error('Error creating observer users:', error);
      setMessage('Müşahit kullanıcıları senkronize edilirken hata oluştu: ' + error.message);
      setMessageType('error');
    } finally { setIsUpdating(false); }
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

  // Auth Sıfırla — Firebase Auth hesabını sil, authUid'yi null yap
  // Kullanıcı tekrar login olunca yeni Auth hesabı oluşur, Firestore şifreyle senkron olur
  const handleResetAuth = async (user) => {
    const name = user.name || user.username || user.id;
    const confirmed = await confirm({
      title: 'Firebase Auth Sıfırla',
      message: `"${name}" için Firebase Auth hesabı silinecek. Kullanıcı tekrar giriş yaptığında yeni bir Auth hesabı oluşturulacak (Firestore'daki şifre ile). Devam edilsin mi?`,
      confirmText: 'Evet, sıfırla',
      cancelText: 'Vazgeç',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');

      // 1) Firebase Auth hesabını sil (backend ile)
      if (user.authUid) {
        try {
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
          const response = await fetch(`${API_BASE_URL}/auth/firebase-auth-user/${user.authUid}`, {
            method: 'DELETE'
          });
          if (!response.ok && response.status !== 404) {
            console.warn('Auth delete response:', response.status);
          }
        } catch (e) {
          console.warn('Auth delete network error (devam ediliyor):', e.message);
        }
      }

      // 2) Firestore'da authUid = null + authResetRequested flag
      //    Cloud Function bu flag'i görünce Firestore şifresiyle yeni Auth oluşturur
      await updateDoc(doc(db, 'member_users', String(user.id)), {
        authUid: null,
        authResetRequested: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      toast.success(`${name} için Auth sıfırlandı. Kullanıcı tekrar giriş yapabilir.`);
      await fetchMemberUsers();
    } catch (e) {
      console.error('Auth reset error:', e);
      toast.error('Auth sıfırlama hatası: ' + (e.message || 'bilinmeyen'));
    }
  };

  // Tüm üye kullanıcıların Auth hesabını sıfırla (toplu)
  // Her kullanıcıya authUid=null + authResetRequested flag yaz → Cloud Function
  // her birine yeni Auth oluşturur (Firestore şifresiyle senkron).
  const handleResetAllAuth = async () => {
    const confirmed = await confirm({
      title: 'TÜM Üyelerin Auth Hesabını Sıfırla',
      message: 'Tüm üye kullanıcılarının Firebase Auth hesapları silinip Firestore\'daki şifreleriyle yeniden oluşturulacak. Bu işlem:\n\n• Giriş yapamayan tüm kullanıcıları düzeltir\n• Cloud Function ile arka planda yürütülür\n• Birkaç dakika sürebilir\n\nDevam edilsin mi?',
      confirmText: 'Evet, tümünü sıfırla',
      cancelText: 'Vazgeç',
      variant: 'danger'
    });
    if (!confirmed) return;

    try {
      setIsResettingAllAuth(true);
      setMessage(''); setMessageType('info');
      const { doc, updateDoc, writeBatch } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');

      const allMemberUsers = await ApiService.getMemberUsers();
      const memberUsersList = allMemberUsers.users || allMemberUsers || [];
      if (memberUsersList.length === 0) {
        setMessage('Sıfırlanacak kullanıcı bulunamadı.');
        setMessageType('info');
        return;
      }

      setMessage(`${memberUsersList.length} kullanıcı sıfırlanıyor...`);
      const nowIso = new Date().toISOString();
      let successCount = 0;
      let errorCount = 0;

      // Firestore writeBatch 500 doc limit — chunk'la
      const CHUNK = 400;
      for (let i = 0; i < memberUsersList.length; i += CHUNK) {
        const slice = memberUsersList.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        for (const u of slice) {
          const ref = doc(db, 'member_users', String(u.id));
          batch.update(ref, {
            authUid: null,
            authResetRequested: nowIso,
            updatedAt: nowIso
          });
        }
        try {
          await batch.commit();
          successCount += slice.length;
          setMessage(`${successCount}/${memberUsersList.length} kullanıcı sıfırlandı (Cloud Function arka planda Auth oluşturuyor)...`);
        } catch (err) {
          errorCount += slice.length;
          console.error('Batch reset error:', err);
        }
      }

      setMessage(
        `Toplu Auth sıfırlama tetiklendi!\n\n• Toplam: ${memberUsersList.length}\n• Başarılı: ${successCount}\n• Hata: ${errorCount}\n\nCloud Function her kullanıcı için yeni Auth hesabı oluşturuyor. Birkaç dakika içinde tüm kullanıcılar giriş yapabilecek.`
      );
      setMessageType(errorCount > 0 ? 'warning' : 'success');
      toast.success(`${successCount} kullanıcı için Auth sıfırlama başlatıldı`);
      await fetchMemberUsers();
    } catch (error) {
      console.error('Error resetting all auth:', error);
      setMessage('Toplu Auth sıfırlama hatası: ' + error.message);
      setMessageType('error');
      toast.error('Toplu sıfırlama hatası');
    } finally {
      setIsResettingAllAuth(false);
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
        handleResetAllAuth={handleResetAllAuth}
        isProcessingAll={isProcessingAll}
        isUpdating={isUpdating}
        isDeletingAll={isDeletingAll}
        isResettingAllAuth={isResettingAllAuth}
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
        onResetAuth={handleResetAuth}
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
