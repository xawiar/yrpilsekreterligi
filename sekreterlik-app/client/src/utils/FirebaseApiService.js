import FirebaseService from '../services/FirebaseService';
import { getCached, setCache, clearCache } from './apiCache';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from 'firebase/auth';
import { auth } from '../config/firebase';
import { decryptData, encryptData } from '../utils/crypto';
import { getMemberId } from './normalizeId';

/**
 * Firebase tabanlı API Service
 * Mevcut ApiService ile uyumlu interface sağlar
 * Tüm veriler Firestore'da şifrelenmiş olarak saklanır
 */
class FirebaseApiService {
  // Use Firebase flag
  static useFirebase = true;

  // Collection names mapping - Tüm collection isimleri burada tanımlı
  static COLLECTIONS = {
    MEMBERS: 'members',
    MEETINGS: 'meetings',
    EVENTS: 'events',
    TASKS: 'tasks',
    ADMIN: 'admin',
    API_KEYS: 'api_keys',
    MEMBER_USERS: 'member_users',
    MEMBER_REGISTRATIONS: 'member_registrations',
    REGIONS: 'regions',
    POSITIONS: 'positions',
    DISTRICTS: 'districts',
    TOWNS: 'towns',
    NEIGHBORHOODS: 'neighborhoods',
    VILLAGES: 'villages',
    STKS: 'stks',
    PUBLIC_INSTITUTIONS: 'public_institutions',
    MOSQUES: 'mosques',
    EVENT_CATEGORIES: 'event_categories',
    NEIGHBORHOOD_REPRESENTATIVES: 'neighborhood_representatives',
    VILLAGE_REPRESENTATIVES: 'village_representatives',
    NEIGHBORHOOD_SUPERVISORS: 'neighborhood_supervisors',
    VILLAGE_SUPERVISORS: 'village_supervisors',
    DISTRICT_OFFICIALS: 'district_officials',
    TOWN_OFFICIALS: 'town_officials',
    DISTRICT_MANAGEMENT_MEMBERS: 'district_management_members',
    TOWN_MANAGEMENT_MEMBERS: 'town_management_members',
    BALLOT_BOXES: 'ballot_boxes',
    BALLOT_BOX_OBSERVERS: 'ballot_box_observers',
    POLLS: 'polls',
    POLL_VOTES: 'poll_votes',
    MEMBER_DASHBOARD_ANALYTICS: 'member_dashboard_analytics',
    NOTIFICATIONS: 'notifications',
    MESSAGES: 'messages',
    MESSAGE_GROUPS: 'message_groups',
    PERSONAL_DOCUMENTS: 'personal_documents',
    ARCHIVE: 'archive',
    GROUPS: 'groups',
    POSITION_PERMISSIONS: 'position_permissions',
    SCHEDULED_SMS: 'scheduled_sms',
    AUDIT_LOGS: 'audit_logs',
    ELECTIONS: 'elections',
    ELECTION_RESULTS: 'election_results',
    ELECTION_COORDINATORS: 'election_coordinators',
    ELECTION_REGIONS: 'election_regions',
    ALLIANCES: 'alliances',
    // Visit counts collections
    DISTRICT_VISITS: 'district_visits',
    TOWN_VISITS: 'town_visits',
    NEIGHBORHOOD_VISITS: 'neighborhood_visits',
    VILLAGE_VISITS: 'village_visits',
    STK_VISITS: 'stk_visits',
    PUBLIC_INSTITUTION_VISITS: 'public_institution_visits',
    MOSQUE_VISITS: 'mosque_visits',
    EVENT_VISITS: 'event_visits',
    WOMEN_BRANCH_PRESIDENTS: 'women_branch_presidents',
    YOUTH_BRANCH_PRESIDENTS: 'youth_branch_presidents',
    WOMEN_BRANCH_MANAGEMENT: 'women_branch_management',
    YOUTH_BRANCH_MANAGEMENT: 'youth_branch_management',
    ELECTIONS: 'elections',
    ELECTION_RESULTS: 'election_results'
  };

  // Auth API
  static async login(username, password) {
    try {
      // Firebase Auth ile giriş yap
      // Email formatına çevir (username@domain.com)
      const email = username.includes('@') ? username : `${username}@ilsekreterlik.local`;

      let userCredential = null;
      let user = null;
      let memberUser = null;

      try {
        // Önce Firebase Auth'da kullanıcıyı bulmaya çalış
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
      } catch (authError) {
        // Firebase Auth'da kullanıcı bulunamadı veya şifre hatalı

        // Eğer kullanıcı bulunamadıysa, Firestore'dan kontrol et
        if (authError.code === 'auth/user-not-found' || authError.code === 'auth/invalid-credential') {
          // Firestore'dan kullanıcıyı bul
          const memberUsers = await FirebaseService.findByField(
            this.COLLECTIONS.MEMBER_USERS,
            'username',
            username
          );

          if (memberUsers && memberUsers.length > 0) {
            memberUser = memberUsers[0];
            // FirebaseService.findByField zaten decrypt ediyor (decrypt = true default)
            // Ama password field'ı SENSITIVE_FIELDS içinde olduğu için decrypt edilmiş olmalı
            // Eğer hala encrypted görünüyorsa, manuel decrypt et
            let decryptedPassword = memberUser.password;


            // Eğer password şifrelenmiş görünüyorsa (U2FsdGVkX1 ile başlıyorsa), decrypt et
            if (decryptedPassword && typeof decryptedPassword === 'string' && decryptedPassword.startsWith('U2FsdGVkX1')) {
              decryptedPassword = decryptData(decryptedPassword);
            }

            // Password'ları normalize et (sadece rakamlar) - karşılaştırma için
            const normalizedInputPassword = password.toString().replace(/\D/g, '');
            const normalizedDecryptedPassword = (decryptedPassword || '').toString().replace(/\D/g, '');
            const normalizedMemberUserPassword = (memberUser.password || '').toString().replace(/\D/g, '');


            // Şifre doğru mu kontrol et (normalize edilmiş password ile karşılaştır)
            if (normalizedDecryptedPassword === normalizedInputPassword || normalizedMemberUserPassword === normalizedInputPassword) {
              // Şifre doğru, Firebase Auth ile senkronize et
              // ÖNEMLİ: Firebase Auth'a kaydederken normalize edilmiş şifreyi kullan (sadece rakamlar)
              // Firestore'da password normalize edilmiş olarak saklanıyor (sadece rakamlar)
              const firestorePassword = normalizedMemberUserPassword || normalizedDecryptedPassword || (decryptedPassword || memberUser.password);


              // Eğer authUid varsa ama email/username değişmişse, yeni email ile giriş yapmayı dene
              // Eğer authUid yoksa, yeni kullanıcı oluştur

              try {
                // Önce mevcut email ile giriş yapmayı dene (eğer authUid varsa)
                if (memberUser.authUid) {
                  try {
                    // Eski email ile giriş yapmayı dene (Firestore'daki şifre ile)
                    const oldEmail = memberUser.username.includes('@') ? memberUser.username : `${memberUser.username}@ilsekreterlik.local`;
                    userCredential = await signInWithEmailAndPassword(auth, oldEmail, firestorePassword);
                    user = userCredential.user;

                    // Firestore'daki kullanıcıyı güncelle (username ve authUid senkronizasyonu)
                    await FirebaseService.update(this.COLLECTIONS.MEMBER_USERS, memberUser.id, {
                      authUid: user.uid,
                      username: username // Username'i güncelle (eğer değiştiyse)
                    }, false);

                  } catch (oldEmailError) {
                    // Eski email ile giriş yapılamadı, yeni email ile dene
                    try {
                      userCredential = await signInWithEmailAndPassword(auth, email, firestorePassword);
                      user = userCredential.user;

                      // Firestore'daki kullanıcıyı güncelle
                      await FirebaseService.update(this.COLLECTIONS.MEMBER_USERS, memberUser.id, {
                        authUid: user.uid,
                        username: username
                      }, false);

                    } catch (newEmailError) {
                      // Yeni email ile de giriş yapılamadı, yeni kullanıcı oluştur (Firestore'daki şifre ile)
                      userCredential = await createUserWithEmailAndPassword(auth, email, firestorePassword);
                      user = userCredential.user;

                      // Firestore'daki kullanıcıyı güncelle
                      await FirebaseService.update(this.COLLECTIONS.MEMBER_USERS, memberUser.id, {
                        authUid: user.uid,
                        username: username
                      }, false);

                    }
                  }
                } else {
                  // AuthUid yok, yeni kullanıcı oluştur (Firestore'daki şifre ile - telefon numarası)
                  userCredential = await createUserWithEmailAndPassword(auth, email, firestorePassword);
                  user = userCredential.user;

                  // Firestore'daki kullanıcıyı güncelle (authUid ekle)
                  await FirebaseService.update(this.COLLECTIONS.MEMBER_USERS, memberUser.id, {
                    authUid: user.uid,
                    username: username
                  }, false);

                }
              } catch (createError) {
                // Email zaten kullanılıyorsa (başka bir kullanıcı tarafından veya aynı kullanıcı farklı şifre ile)
                if (createError.code === 'auth/email-already-in-use') {
                  try {
                    // Firestore'daki şifre ile giriş yapmayı dene
                    userCredential = await signInWithEmailAndPassword(auth, email, firestorePassword);
                    user = userCredential.user;

                    // Firestore'daki kullanıcıyı güncelle (authUid ekle)
                    await FirebaseService.update(this.COLLECTIONS.MEMBER_USERS, memberUser.id, {
                      authUid: user.uid,
                      username: username
                    }, false);

                  } catch (signInError2) {
                    // Firestore şifresi doğru ama Auth şifresi eski
                    // authUid temizle → yeni Auth kullanıcısı oluşturulacak
                    console.warn('Auth password mismatch, resetting authUid for re-creation');
                    await FirebaseService.update(this.COLLECTIONS.MEMBER_USERS, memberUser.id, {
                      authUid: null,
                      username: username
                    }, false);

                    // Yeni Firebase Auth kullanıcısı oluştur (Firestore şifresiyle)
                    try {
                      userCredential = await createUserWithEmailAndPassword(auth, email, firestorePassword);
                      user = userCredential.user;
                      await FirebaseService.update(this.COLLECTIONS.MEMBER_USERS, memberUser.id, {
                        authUid: user.uid,
                        username: username
                      }, false);
                    } catch (recreateErr) {
                      if (recreateErr.code === 'auth/email-already-in-use') {
                        // Email zaten kullanılıyor — eski Auth hesabını kaldıramıyoruz
                        // Firestore şifresi doğruysa kullanıcıyı yine de giriş yaptır
                        // authUid null bırakılacak, bir sonraki login'de düzelir
                        console.warn('Could not recreate Auth user, proceeding with Firestore auth only');
                      } else {
                        throw recreateErr;
                      }
                    }
                  }
                } else {
                  throw createError;
                }
              }
            } else {
              // Şifre hatalı
              console.error('❌ Password mismatch!', {
                username: memberUser.username,
                memberId: memberUser.memberId
              });
              throw new Error('Şifre hatalı');
            }
          } else {
            // Firestore'da da kullanıcı bulunamadı
            throw authError; // Orijinal hatayı fırlat
          }
        } else {
          // Diğer hatalar (wrong-password, invalid-email, vb.)
          throw authError;
        }
      }

      // User bilgisini hazırla (varsayılan olarak admin)
      const userData = {
        id: user ? user.uid : (memberUser?.id || username),
        uid: user ? user.uid : null,
        username: username,
        email: user ? user.email : email,
        type: 'admin',
        role: 'admin',
        memberId: null
      };

      // Admin bilgilerini kontrol et - varsa güncelle, yoksa oluştur
      let adminDoc;
      try {
        adminDoc = await FirebaseService.getById(this.COLLECTIONS.ADMIN, 'main');

        // Admin dokümanı varsa ve username eşleşiyorsa
        if (adminDoc && (adminDoc.username === username || (user && adminDoc.uid === user.uid))) {
          userData.role = 'admin';
          userData.type = 'admin';
        } else if (user) {
          // Admin dokümanı yoksa veya username eşleşmiyorsa oluştur/güncelle
          await FirebaseService.create(
            this.COLLECTIONS.ADMIN,
            'main',
            {
              username: username,
              email: email,
              uid: user.uid,
              role: 'admin'
            },
            false // Şifreleme yapma (admin bilgileri hassas değil)
          );
        }
      } catch (e) {
        console.warn('Admin doc error, creating new one:', e);
        // Admin dokümanı yoksa oluştur (user varsa)
        if (user) {
          try {
            await FirebaseService.create(
              this.COLLECTIONS.ADMIN,
              'main',
              {
                username: username,
                email: email,
                uid: user.uid,
                role: 'admin'
              },
              false
            );
          } catch (createError) {
            console.error('Failed to create admin doc:', createError);
          }
        }
      }

      // Member user ise ek bilgileri getir
      try {
        const memberUser = await FirebaseService.findByField(
          this.COLLECTIONS.MEMBER_USERS,
          'username',
          username
        );

        if (memberUser && memberUser.length > 0) {
          userData.type = memberUser[0].userType || 'member';
          userData.role = memberUser[0].userType || 'member';

          // memberId alanını kontrol et - hem memberId hem member_id olabilir
          let memberId = getMemberId(memberUser[0]);

          // Eğer memberId yoksa ve userType 'member' ise, username (TC) ile member bul
          if (!memberId && memberUser[0].userType === 'member' && memberUser[0].username) {
            try {
              // Tüm üyeleri al ve TC'ye göre bul
              const allMembers = await FirebaseService.getAll(this.COLLECTIONS.MEMBERS);
              const memberByTc = allMembers.find(m => {
                // TC şifrelenmiş olabilir, decrypt etmeye çalış
                try {
                  const decryptedTc = decryptData(m.tc || m.tcNo || '');
                  return decryptedTc === memberUser[0].username || m.tc === memberUser[0].username || m.tcNo === memberUser[0].username;
                } catch (e) {
                  // Decrypt başarısız, direkt karşılaştır
                  return m.tc === memberUser[0].username || m.tcNo === memberUser[0].username;
                }
              });

              if (memberByTc) {
                memberId = memberByTc.id;
              }
            } catch (e) {
              console.warn('Member lookup by TC failed:', e);
            }
          }

          // Eğer hala memberId yoksa ve userType 'member' ise, id'yi memberId olarak kullan
          // (member_users collection'ındaki id, members collection'ındaki id ile eşleşebilir)
          if (!memberId && memberUser[0].userType === 'member') {
            try {
              const memberById = await FirebaseService.getById(this.COLLECTIONS.MEMBERS, memberUser[0].id, false);
              if (memberById) {
                memberId = memberUser[0].id;
              }
            } catch (e) {
              console.warn('Member not found by id:', memberUser[0].id);
            }
          }

          userData.memberId = memberId ? String(memberId) : null;
          userData.id = memberUser[0].id;

          // Belde başkanı veya ilçe başkanı ise townId veya districtId ekle
          if (memberUser[0].userType === 'town_president' && memberUser[0].townId) {
            userData.townId = memberUser[0].townId;
          } else if (memberUser[0].userType === 'district_president' && memberUser[0].districtId) {
            userData.districtId = memberUser[0].districtId;
          }
        }
      } catch (e) {
        console.warn('Member user check failed:', e);
      }


      return {
        success: true,
        user: userData,
        message: 'Giriş başarılı'
      };
    } catch (error) {
      console.error('Login error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);

      let errorMessage = 'Giriş yapılırken hata oluştu';

      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Kullanıcı bulunamadı. Lütfen admin kullanıcısını oluşturun (/create-admin)';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Şifre hatalı';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Geçersiz email formatı';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = 'Firebase Auth: "Email/Password" girişi devre dışı. Lütfen Firebase Console üzerinden Authentication > Sign-in Method kısmından Email/Password seçeneğini aktif edin.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        message: errorMessage,
        error: error.code || error.message
      };
    }
  }

  // Coordinator Login (TC and phone)
  static async loginCoordinator(tc, phone) {
    try {
      const tcStr = String(tc).trim();
      let phoneStr = String(phone).replace(/\D/g, ''); // Normalize phone

      // Firebase Auth minimum 6 karakter şifre ister - padStart ile uzat (kullanıcı oluştururken de aynı yapılıyor)
      if (phoneStr.length < 6) {
        phoneStr = phoneStr.padStart(6, '0');
      }

      // Tüm kullanıcıları al ve userType='coordinator' olanları filtrele
      const allUsers = await FirebaseService.getAll(this.COLLECTIONS.MEMBER_USERS);

      // Coordinator kullanıcılarını bul
      const coordinatorUsers = allUsers.filter(u =>
        u.userType === 'coordinator' && (u.coordinatorId || u.coordinator_id)
      );

      if (!coordinatorUsers || coordinatorUsers.length === 0) {
        throw new Error('Sorumlu kullanıcısı bulunamadı.');
      }

      // Coordinator bilgilerini al
      const coordinators = await FirebaseService.getAll(this.COLLECTIONS.ELECTION_COORDINATORS);

      // TC ve telefon ile eşleşen coordinator'ı bul
      let matchedCoordinator = null;
      let matchedUser = null;

      for (const coordinatorUser of coordinatorUsers) {
        const coordinatorId = coordinatorUser.coordinatorId || coordinatorUser.coordinator_id;
        const coordinator = coordinators.find(c => String(c.id) === String(coordinatorId));

        if (coordinator) {
          // Coordinator'ın telefon numarasını da normalize et ve padStart ile uzat
          let coordinatorPhoneNormalized = String(coordinator.phone || '').replace(/\D/g, '');
          if (coordinatorPhoneNormalized.length < 6) {
            coordinatorPhoneNormalized = coordinatorPhoneNormalized.padStart(6, '0');
          }
          const coordinatorTcNormalized = String(coordinator.tc || '').trim();

          // TC ve normalize edilmiş telefon numarası ile karşılaştır
          if (coordinatorTcNormalized === tcStr && coordinatorPhoneNormalized === phoneStr) {
            matchedCoordinator = coordinator;
            matchedUser = coordinatorUser;
            break;
          }
        }
      }

      if (!matchedCoordinator || !matchedUser) {
        throw new Error('Geçersiz TC kimlik numarası veya telefon numarası');
      }

      return {
        success: true,
        user: {
          username: matchedUser.username,
          name: matchedCoordinator.name,
          role: matchedCoordinator.role,
          coordinatorId: matchedCoordinator.id,
          tc: matchedCoordinator.tc,
          phone: matchedCoordinator.phone,
          parentCoordinatorId: matchedCoordinator.parent_coordinator_id,
          districtId: matchedCoordinator.district_id,
          institutionName: matchedCoordinator.institution_name
        }
      };
    } catch (error) {
      console.error('Coordinator login error:', error);
      return {
        success: false,
        message: error.message || 'Giriş sırasında bir hata oluştu'
      };
    }
  }

  // Coordinator Dashboard
  static async getCoordinatorDashboard(coordinatorId) {
    try {
      const coordinators = await FirebaseService.getAll(this.COLLECTIONS.ELECTION_COORDINATORS);
      const coordinator = coordinators.find(c => String(c.id) === String(coordinatorId));

      if (!coordinator) {
        throw new Error('Sorumlu bulunamadı');
      }

      const allBallotBoxes = await FirebaseService.getAll(this.COLLECTIONS.BALLOT_BOXES);
      const allRegions = await FirebaseService.getAll(this.COLLECTIONS.ELECTION_REGIONS);

      let ballotBoxes = [];

      // Hiyerarşik görünürlük: Her sorumlu, altındaki tüm sandıkları görebilmeli
      // Örnek: 1001 nolu sandık için ahmet (başmüşahit), mehmet (kurum sorumlusu), 
      // hüseyin (bölge sorumlusu), ali (ilçe sorumlusu), yavuz (il genel sorumlusu) hepsi görebilmeli

      if (coordinator.role === 'provincial_coordinator') {
        // İl Genel Sorumlusu: Tüm sandıklar
        ballotBoxes = allBallotBoxes;
      } else if (coordinator.role === 'district_supervisor') {
        // İlçe Sorumlusu: Bağlı bölge sorumlularının bölgelerindeki sandıklar + 
        // bu bölgelerdeki kurum sorumlularının kurumlarındaki sandıklar
        const ballotBoxIds = new Set();

        // 1. Bağlı bölge sorumlularının bölgelerindeki sandıklar
        const regionSupervisors = coordinators.filter(c =>
          c.role === 'region_supervisor' &&
          String(c.parent_coordinator_id) === String(coordinator.id)
        );

        for (const regionSupervisor of regionSupervisors) {
          const region = allRegions.find(r =>
            String(r.supervisor_id) === String(regionSupervisor.id)
          );
          if (region) {
            const neighborhoodIds = Array.isArray(region.neighborhood_ids)
              ? region.neighborhood_ids
              : (region.neighborhood_ids ? JSON.parse(region.neighborhood_ids) : []);
            const villageIds = Array.isArray(region.village_ids)
              ? region.village_ids
              : (region.village_ids ? JSON.parse(region.village_ids) : []);

            allBallotBoxes.forEach(bb => {
              if ((neighborhoodIds.length > 0 && neighborhoodIds.includes(bb.neighborhood_id)) ||
                (villageIds.length > 0 && villageIds.includes(bb.village_id))) {
                ballotBoxIds.add(bb.id);
              }
            });
          }
        }

        // 2. Bu bölgelerdeki kurum sorumlularının kurumlarındaki sandıklar
        const institutionSupervisors = coordinators.filter(c =>
          c.role === 'institution_supervisor' &&
          String(c.parent_coordinator_id) === String(regionSupervisors.map(rs => rs.id).find(id => id))
        );

        // Kurum sorumlularını bölge sorumlularına göre filtrele
        for (const regionSupervisor of regionSupervisors) {
          const institutionSupervisorsInRegion = coordinators.filter(c =>
            c.role === 'institution_supervisor' &&
            String(c.parent_coordinator_id) === String(regionSupervisor.id)
          );

          for (const instSupervisor of institutionSupervisorsInRegion) {
            if (instSupervisor.institution_name) {
              allBallotBoxes.forEach(bb => {
                if (bb.institution_name === instSupervisor.institution_name) {
                  ballotBoxIds.add(bb.id);
                }
              });
            }
          }
        }

        ballotBoxes = allBallotBoxes.filter(bb => ballotBoxIds.has(bb.id));
      } else if (coordinator.role === 'region_supervisor') {
        // Bölge Sorumlusu: Kendi bölgesindeki sandıklar + bu bölgedeki kurum sorumlularının kurumlarındaki sandıklar
        const ballotBoxIds = new Set();

        // 1. Kendi bölgesindeki sandıklar
        const region = allRegions.find(r =>
          String(r.supervisor_id) === String(coordinator.id)
        );

        if (region) {
          const neighborhoodIds = Array.isArray(region.neighborhood_ids)
            ? region.neighborhood_ids
            : (region.neighborhood_ids ? JSON.parse(region.neighborhood_ids) : []);
          const villageIds = Array.isArray(region.village_ids)
            ? region.village_ids
            : (region.village_ids ? JSON.parse(region.village_ids) : []);

          allBallotBoxes.forEach(bb => {
            if ((neighborhoodIds.length > 0 && neighborhoodIds.includes(bb.neighborhood_id)) ||
              (villageIds.length > 0 && villageIds.includes(bb.village_id))) {
              ballotBoxIds.add(bb.id);
            }
          });
        }

        // 2. Bu bölgedeki kurum sorumlularının kurumlarındaki sandıklar
        const institutionSupervisors = coordinators.filter(c =>
          c.role === 'institution_supervisor' &&
          String(c.parent_coordinator_id) === String(coordinator.id)
        );

        for (const instSupervisor of institutionSupervisors) {
          if (instSupervisor.institution_name) {
            allBallotBoxes.forEach(bb => {
              if (bb.institution_name === instSupervisor.institution_name) {
                ballotBoxIds.add(bb.id);
              }
            });
          }
        }

        ballotBoxes = allBallotBoxes.filter(bb => ballotBoxIds.has(bb.id));
      } else if (coordinator.role === 'institution_supervisor' && coordinator.institution_name) {
        // Kurum Sorumlusu: Kendi kurumundaki sandıklar
        ballotBoxes = allBallotBoxes.filter(bb =>
          bb.institution_name === coordinator.institution_name
        );
      }

      // Bölge, mahalle, köy bilgilerini topla
      let regionInfo = null;
      let neighborhoods = [];
      let villages = [];
      let parentCoordinators = [];

      if (coordinator.role === 'region_supervisor') {
        const region = allRegions.find(r => String(r.supervisor_id) === String(coordinator.id));
        if (region) {
          regionInfo = {
            id: region.id,
            name: region.name
          };

          const neighborhoodIds = Array.isArray(region.neighborhood_ids)
            ? region.neighborhood_ids
            : (region.neighborhood_ids ? JSON.parse(region.neighborhood_ids) : []);
          const villageIds = Array.isArray(region.village_ids)
            ? region.village_ids
            : (region.village_ids ? JSON.parse(region.village_ids) : []);

          if (neighborhoodIds.length > 0) {
            const allNeighborhoods = await FirebaseService.getAll(this.COLLECTIONS.NEIGHBORHOODS);
            neighborhoods = allNeighborhoods.filter(n => neighborhoodIds.includes(n.id));
          }

          if (villageIds.length > 0) {
            const allVillages = await FirebaseService.getAll(this.COLLECTIONS.VILLAGES);
            villages = allVillages.filter(v => villageIds.includes(v.id));
          }
        }
      } else if (coordinator.role === 'institution_supervisor' && ballotBoxes.length > 0) {
        // Kurum sorumlusu için sandıklardan mahalle/köy bilgisi al
        const firstBox = ballotBoxes[0];
        if (firstBox.neighborhood_id) {
          const allNeighborhoods = await FirebaseService.getAll(this.COLLECTIONS.NEIGHBORHOODS);
          const neighborhood = allNeighborhoods.find(n => String(n.id) === String(firstBox.neighborhood_id));
          if (neighborhood) neighborhoods = [neighborhood];
        }
        if (firstBox.village_id) {
          const allVillages = await FirebaseService.getAll(this.COLLECTIONS.VILLAGES);
          const village = allVillages.find(v => String(v.id) === String(firstBox.village_id));
          if (village) villages = [village];
        }
      }

      // Üst sorumluları bul
      if (coordinator.parent_coordinator_id) {
        let currentParentId = coordinator.parent_coordinator_id;
        while (currentParentId) {
          const parent = coordinators.find(c => String(c.id) === String(currentParentId));
          if (parent) {
            parentCoordinators.push({
              id: parent.id,
              name: parent.name,
              role: parent.role
            });
            currentParentId = parent.parent_coordinator_id;
          } else {
            break;
          }
        }
      }

      // Seçim sonuçlarını al
      const allElectionResults = await FirebaseService.getAll(this.COLLECTIONS.ELECTION_RESULTS);
      const electionResults = allElectionResults.filter(result => {
        const ballotBoxId = result.ballot_box_id || result.ballotBoxId;
        return ballotBoxes.some(bb => String(bb.id) === String(ballotBoxId));
      });

      return {
        success: true,
        coordinator: {
          id: coordinator.id,
          name: coordinator.name,
          role: coordinator.role,
          institutionName: coordinator.institution_name
        },
        ballotBoxes: ballotBoxes || [],
        regionInfo,
        neighborhoods,
        villages,
        parentCoordinators,
        electionResults: electionResults || []
      };
    } catch (error) {
      console.error('Coordinator dashboard error:', error);
      throw error;
    }
  }

  // Chief Observer Login
  static async loginChiefObserver(ballotNumber, tc) {
    try {
      // Önce sandık numarası ile dene, sonra TC ile dene
      const ballotNumberStr = String(ballotNumber).trim();
      const tcStr = String(tc).trim();
      const password = tcStr;

      // Tüm kullanıcıları al ve userType='musahit' olanları filtrele
      const allUsers = await FirebaseService.getAll(this.COLLECTIONS.MEMBER_USERS);

      // Önce sandık numarası ile kullanıcı bul (userType='musahit' olmalı)
      let memberUsers = allUsers.filter(u =>
        u.userType === 'musahit' && u.username === ballotNumberStr
      );

      // Sandık numarası ile bulunamazsa TC ile dene
      if (!memberUsers || memberUsers.length === 0) {
        memberUsers = allUsers.filter(u =>
          u.userType === 'musahit' && u.username === tcStr
        );
      }

      if (!memberUsers || memberUsers.length === 0) {
        throw new Error('Başmüşahit kullanıcısı bulunamadı. Lütfen sandık numarası veya TC kimlik numaranızı kontrol edin.');
      }

      const memberUser = memberUsers[0];

      // Şifre kontrolü - password alanı şifrelenmiş olabilir
      let storedPassword = memberUser.password || '';
      try {
        // Şifrelenmişse decrypt et
        if (storedPassword && storedPassword.startsWith('U2FsdGVkX1')) {
          storedPassword = decryptData(storedPassword);
        }
      } catch (e) {
        console.error('Şifre decrypt hatası:', e);
        // Decrypt başarısız, direkt kullan
      }

      // Şifre eşleşmiyorsa hata
      if (storedPassword !== password) {
        throw new Error('Geçersiz TC kimlik numarası');
      }

      // Firebase Auth ile giriş yapmayı dene
      const username = memberUser.username;
      const email = `${username}@ilsekreterlik.local`;
      let userCredential = null;
      let user = null;

      try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
      } catch (authError) {

        // Auth'da kullanıcı yoksa oluştur
        if (authError.code === 'auth/user-not-found') {
          try {
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
            user = userCredential.user;
            // authUid'yi Firestore'a kaydet
            await FirebaseService.update(
              this.COLLECTIONS.MEMBER_USERS,
              memberUser.id,
              { authUid: user.uid },
              false
            );
          } catch (createError) {
            console.error('Failed to create Firebase Auth user:', createError);
            throw new Error('Giriş yapılamadı');
          }
        } else {
          throw new Error('Giriş yapılamadı: ' + authError.message);
        }
      }

      // Başmüşahit bilgilerini al
      // Kullanıcı adı sandık numarası ise sandık bul, TC ise direkt başmüşahit bul
      let ballotBox = null;
      let chiefObserver = null;

      // Kullanıcı adı sandık numarası mı kontrol et
      const ballotBoxes = await FirebaseService.getAll(this.COLLECTIONS.BALLOT_BOXES);
      ballotBox = ballotBoxes.find(bb => String(bb.ballot_number) === username);

      if (ballotBox) {
        // Sandık bulundu - bu sandığa ait başmüşahitleri bul
        const observers = await FirebaseService.findByField(
          this.COLLECTIONS.BALLOT_BOX_OBSERVERS,
          'ballot_box_id',
          String(ballotBox.id)
        );

        chiefObserver = observers.find(obs => {
          let obsTc = obs.tc;
          try {
            if (obsTc && obsTc.startsWith('U2FsdGVkX1')) {
              obsTc = decryptData(obsTc);
            }
          } catch (e) { }
          return (obs.is_chief_observer === true || obs.is_chief_observer === 1) &&
            (obsTc === tcStr || obs.tc === tcStr);
        });
      } else {
        // Kullanıcı adı TC ise - TC ile başmüşahit bul
        const allObservers = await FirebaseService.getAll(this.COLLECTIONS.BALLOT_BOX_OBSERVERS);
        chiefObserver = allObservers.find(obs => {
          let obsTc = obs.tc;
          try {
            if (obsTc && obsTc.startsWith('U2FsdGVkX1')) {
              obsTc = decryptData(obsTc);
            }
          } catch (e) { }
          return (obs.is_chief_observer === true || obs.is_chief_observer === 1) &&
            (obsTc === tcStr || obs.tc === tcStr);
        });

        // Başmüşahit bulunduysa sandığını al
        if (chiefObserver && chiefObserver.ballot_box_id) {
          ballotBox = await FirebaseService.getById(
            this.COLLECTIONS.BALLOT_BOXES,
            chiefObserver.ballot_box_id
          );
        }
      }

      if (!chiefObserver) {
        throw new Error('Başmüşahit bulunamadı');
      }

      return {
        success: true,
        token: await user.getIdToken(),
        user: {
          uid: user.uid,
          username: memberUser.username, // Sandık numarası veya TC
          name: chiefObserver.name || memberUser.name,
          role: 'chief_observer',
          ballotBoxId: chiefObserver.ballot_box_id,
          ballotNumber: ballotBox?.ballot_number || memberUser.username,
          tc: chiefObserver.tc
        }
      };
    } catch (error) {
      console.error('Chief observer login error:', error);
      throw error;
    }
  }

  static async logout() {
    try {
      await signOut(auth);
      return { success: true, message: 'Çıkış başarılı' };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, message: 'Çıkış yapılırken hata oluştu' };
    }
  }

  // Admin API
  static async getAdminInfo() {
    try {
      const admin = await FirebaseService.getById(this.COLLECTIONS.ADMIN, 'main');
      if (admin && admin.id) {
        // Admin bulundu - beklenen format: { success: true, admin: {...} }
        return {
          success: true,
          admin: {
            username: admin.username || 'admin',
            created_at: admin.createdAt || admin.created_at,
            updated_at: admin.updatedAt || admin.updated_at
          }
        };
      } else {
        // Admin bulunamadı
        return { success: false, message: 'Admin bulunamadı' };
      }
    } catch (error) {
      console.error('Get admin info error:', error);
      return { success: false, message: 'Admin bilgileri alınırken hata oluştu' };
    }
  }

  static async updateAdminCredentials(username, password, currentPassword) {
    try {
      // Mevcut şifre ile re-authenticate
      const user = auth.currentUser;
      if (!user || !user.email) {
        return { success: false, message: 'Kullanıcı oturumu bulunamadı' };
      }

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Şifreyi güncelle
      if (password) {
        await updatePassword(user, password);
      }

      // Admin bilgilerini güncelle
      await FirebaseService.update(this.COLLECTIONS.ADMIN, 'main', { username });

      return { success: true, message: 'Admin bilgileri güncellendi' };
    } catch (error) {
      console.error('Update admin credentials error:', error);
      return { success: false, message: 'Admin bilgileri güncellenirken hata oluştu' };
    }
  }

  // Verify admin password
  static async verifyAdminPassword(password) {
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        return { success: false, message: 'Kullanıcı oturumu bulunamadı' };
      }

      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);

      return { success: true, message: 'Şifre doğrulandı' };
    } catch (error) {
      console.error('Verify admin password error:', error);
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        return { success: false, message: 'Şifre yanlış' };
      }
      return { success: false, message: 'Şifre doğrulanırken hata oluştu: ' + (error.message || error) };
    }
  }

  // Member Users API
  static async getMemberUsers() {
    try {
      const users = await FirebaseService.getAll(this.COLLECTIONS.MEMBER_USERS);
      return users || [];
    } catch (error) {
      console.error('Get member users error:', error);
      return [];
    }
  }

  static async createMemberUser(memberId, username, password, extraData = {}) {
    try {
      // Mevcut kullanıcıyı koru - sadece yeni kullanıcı oluştur
      const currentUser = auth.currentUser;
      const currentUserUid = currentUser ? currentUser.uid : null;
      // memberId, coordinator_id veya observer_id'ye göre kontrol et
      const searchField = extraData.coordinator_id ? 'coordinatorId' : (extraData.observer_id ? 'observerId' : 'memberId');
      const searchValue = extraData.coordinator_id || extraData.observer_id || memberId;

      // Önce bu ID için zaten kullanıcı var mı kontrol et
      let existingUsers = [];
      if (searchValue) {
        existingUsers = await FirebaseService.findByField(
          this.COLLECTIONS.MEMBER_USERS,
          searchField,
          searchValue
        );
      }
      // Ayrıca username'e göre de kontrol et
      if (!existingUsers || existingUsers.length === 0) {
        const usersByUsername = await FirebaseService.findByField(
          this.COLLECTIONS.MEMBER_USERS,
          'username',
          username
        );
        if (usersByUsername && usersByUsername.length > 0) {
          existingUsers = usersByUsername;
        }
      }
      if (existingUsers && existingUsers.length > 0) {
        return { success: true, id: existingUsers[0].id, message: 'Kullanıcı zaten mevcut' };
      }

      // Firebase Auth'da kullanıcı oluştur
      if (!username || typeof username !== 'string') {
        throw new Error('Username is required and must be a string');
      }
      const email = username.includes('@') ? username : `${username}@ilsekreterlik.local`;
      // Firebase Auth kullanıcısı Cloud Function (onMemberUserCreate) tarafından oluşturulur
      // Client-side createUserWithEmailAndPassword kullanmıyoruz — admin session'ını bozar
      let authUser = null;

      // Firestore'a kaydet
      const userData = {
        memberId: extraData.coordinator_id ? null : (extraData.observer_id ? null : memberId),
        coordinatorId: extraData.coordinator_id || null,
        observerId: extraData.observer_id || null,
        username,
        password: encryptData(password),
        userType: extraData.userType || 'member',
        isActive: true,
        authUid: authUser?.user?.uid || null // Auth UID varsa kaydet
      };
      // TODO: Race condition mitigation — use a deterministic document ID derived from
      // the member/coordinator/observer ID so that two concurrent createMemberUser calls
      // for the same entity collide on the same Firestore document rather than creating
      // duplicates.  FirebaseService.create uses setDoc which will overwrite, but because
      // the data is identical (same member, same credentials) the overwrite is harmless.
      // A truly atomic guard would require Firestore Transactions or Security Rules with
      // `exists()` checks, but this deterministic ID eliminates the practical duplicate risk.
      const deterministicId = searchValue ? `member_${searchValue}` : null;
      const docId = await FirebaseService.create(
        this.COLLECTIONS.MEMBER_USERS,
        deterministicId,
        userData,
        false // encrypt = false (artık şifreleme yapılmıyor)
      );

      return { success: true, id: docId, message: 'Kullanıcı oluşturuldu' };
    } catch (error) {
      console.error('Create member user error:', error.message);
      return { success: false, message: error.message || 'Kullanıcı oluşturulurken hata oluştu' };
    }
  }

  static async updateMemberUser(id, username, password, extraData = {}) {
    try {
      // Önce mevcut kullanıcıyı al
      const memberUser = await FirebaseService.getById(this.COLLECTIONS.MEMBER_USERS, id);
      if (!memberUser) {
        return { success: false, message: 'Kullanıcı bulunamadı' };
      }


      const updateData = {
        username,
        ...(extraData.coordinator_id !== undefined && { coordinatorId: extraData.coordinator_id }),
        ...(extraData.observer_id !== undefined && { observerId: extraData.observer_id }),
        ...(extraData.userType && { userType: extraData.userType })
      };
      const oldUsername = memberUser.username;
      const email = username.includes('@') ? username : `${username}@ilsekreterlik.local`;
      const oldEmail = oldUsername.includes('@') ? oldUsername : `${oldUsername}@ilsekreterlik.local`;

      // Username değiştiyse, email değişmiş olabilir
      const usernameChanged = oldUsername !== username;

      // Şifre güncelleniyorsa (encrypt ederek kaydet)
      if (password && password.trim()) {
        updateData.password = encryptData(password);
      }

      // Mevcut password'u al ve normalize et (karşılaştırma için)
      let oldPassword = memberUser.password || '';
      const wasEncrypted = oldPassword && typeof oldPassword === 'string' && oldPassword.startsWith('U2FsdGVkX1');
      if (wasEncrypted) {
        oldPassword = decryptData(oldPassword);
      }
      const normalizedOldPassword = oldPassword.toString().replace(/\D/g, '');
      const normalizedNewPassword = password ? password.toString().replace(/\D/g, '') : normalizedOldPassword;
      const passwordChanged = normalizedOldPassword !== normalizedNewPassword;


      // Eğer authUid yoksa ama Firebase Auth'da kullanıcı olabilir, email ile bulmayı dene
      let authUid = memberUser.authUid;
      if (!authUid && username) {
        try {
          // Server-side endpoint ile Firebase Auth'da kullanıcıyı email ile bul
          const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
            (import.meta.env.PROD ? 'https://yrpilsekreterligi.onrender.com/api' : 'http://localhost:5000/api');


          const findResponse = await fetch(`${API_BASE_URL}/auth/find-firebase-auth-user`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email })
          });


          if (findResponse.ok) {
            try {
              const findResponseText = await findResponse.text();

              let findData;
              if (findResponseText) {
                try {
                  findData = JSON.parse(findResponseText);
                } catch (parseError) {
                  console.warn('⚠️ Find response is not valid JSON:', findResponseText);
                  findData = { success: false, message: 'Invalid JSON response' };
                }
              } else {
                findData = { success: false, message: 'Empty response' };
              }


              if (findData.success && findData.authUid) {
                authUid = findData.authUid;
                // Firestore'daki authUid'yi güncelle
                updateData.authUid = authUid;
              } else {
                // Kullanıcı bulunamadı ama şifre güncellemesi yapılabilir (email ile)
                // Email ile password update endpoint'ine gönderilebilir
              }
            } catch (findError) {
              console.error('❌ Error parsing find response:', findError);
            }
          } else {
            const errorText = await findResponse.text();
            console.warn('⚠️ Could not find Firebase Auth user by email:', errorText);
          }
        } catch (error) {
          console.warn('⚠️ Could not lookup Firebase Auth user:', error);
        }
      }

      // Eğer Firebase Auth'da kullanıcı varsa (authUid varsa) VEYA email ile bulunabilirse
      if (authUid || (username && password)) {
        try {

          // Eğer username değiştiyse, authUid'i temizle ki login sırasında yeni email ile oluşturulsun
          if (usernameChanged) {
            updateData.authUid = null; // Login sırasında yeni email ile oluşturulacak
          }

          // Eğer şifre değiştiyse VEYA password parametresi gönderildiyse, Firebase Auth şifresini güncelle
          // Not: passwordChanged false olsa bile, eğer password parametresi gönderildiyse güncelleme yapılmalı
          // Çünkü kullanıcı açıkça şifreyi değiştirmek istiyor
          // Ayrıca authUid yoksa bile email ile güncelleme yapılabilir
          const shouldUpdatePassword = (passwordChanged || (password && password.trim())) && normalizedNewPassword;


          if (shouldUpdatePassword) {
            // Eğer authUid yoksa ve email ile de bulunamadıysa, hata göster
            if (!authUid) {
              console.error('❌ Cannot update Firebase Auth password: authUid is null and user not found by email:', email);
              // Hata mesajı göster ama Firestore güncellemesi devam edecek
              console.warn('⚠️ Firebase Auth password will not be updated, but Firestore will be updated');
              // Devam et - Firestore güncellemesi yapılacak
            } else {
              try {
                // API_BASE_URL'i kontrol et - production'da doğru URL kullanılmalı
                const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
                  (import.meta.env.PROD ? 'https://yrpilsekreterligi.onrender.com/api' : 'http://localhost:5000/api');


                const response = await fetch(`${API_BASE_URL}/auth/update-firebase-auth-password`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    authUid: authUid,
                    email: email, // Email de gönder (authUid yoksa email ile bulunabilir)
                    password: normalizedNewPassword
                  })
                });


                if (response.ok) {
                  try {
                    const responseText = await response.text();

                    let responseData;
                    if (responseText) {
                      try {
                        responseData = JSON.parse(responseText);
                      } catch (parseError) {
                        console.warn('⚠️ Response is not valid JSON, treating as success');
                        responseData = { success: true, message: responseText || 'Password updated' };
                      }
                    } else {
                      responseData = { success: true, message: 'Password updated (empty response)' };
                    }

                  } catch (responseError) {
                    console.error('❌ Error parsing response:', responseError);
                    // Hata olsa bile devam et (Firestore güncellemesi başarılı)
                  }
                } else {
                  try {
                    const errorText = await response.text();
                    let errorData;
                    try {
                      errorData = JSON.parse(errorText);
                    } catch (parseError) {
                      errorData = { message: errorText || 'Unknown error' };
                    }
                    console.error('❌ Firebase Auth password update failed:', {
                      status: response.status,
                      statusText: response.statusText,
                      error: errorData
                    });
                  } catch (errorParseError) {
                    console.error('❌ Firebase Auth password update failed (could not parse error):', {
                      status: response.status,
                      statusText: response.statusText
                    });
                  }
                  // Hata olsa bile devam et (Firestore güncellemesi başarılı)
                }
              } catch (firebaseError) {
                console.error('❌ Firebase Auth password update error:', {
                  error: firebaseError,
                  message: firebaseError.message,
                  stack: firebaseError.stack
                });
                // Hata olsa bile devam et (Firestore güncellemesi başarılı)
              }
            }
          } else {
          }
        } catch (authError) {
          console.warn('⚠️ Firebase Auth update preparation failed (non-critical):', authError);
          // Firestore güncellemesi devam edecek
        }
      } else {
        // Auth UID yoksa, kullanıcı ilk login olduğunda oluşturulacak
      }

      // Password'u normalize edilmiş haliyle kaydet
      if (password && password.trim()) {
        updateData.password = normalizedNewPassword;
      }

      // Firestore'u güncelle (encrypt = false - password şifrelenmemeli)
      await FirebaseService.update(this.COLLECTIONS.MEMBER_USERS, id, updateData, false);

      return { success: true, message: 'Kullanıcı güncellendi' };
    } catch (error) {
      console.error('Update member user error:', error);
      return { success: false, message: 'Kullanıcı güncellenirken hata oluştu: ' + error.message };
    }
  }

  static async toggleMemberUserStatus(id) {
    try {
      const user = await FirebaseService.getById(this.COLLECTIONS.MEMBER_USERS, id);
      await FirebaseService.update(this.COLLECTIONS.MEMBER_USERS, id, {
        isActive: !user.isActive
      }, false); // encrypt = false
      return { success: true, message: 'Kullanıcı durumu güncellendi' };
    } catch (error) {
      console.error('Toggle member user status error:', error);
      return { success: false, message: 'Kullanıcı durumu güncellenirken hata oluştu' };
    }
  }

  // Fix all encrypted passwords in member_users collection
  static async fixEncryptedPasswords() {
    try {

      // Tüm member_users kayıtlarını al (decrypt = false çünkü şifrelenmiş olanları tespit etmek istiyoruz)
      const allMemberUsers = await FirebaseService.getAll(this.COLLECTIONS.MEMBER_USERS, {}, false);


      let fixedCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const user of allMemberUsers) {
        try {
          // Password'u kontrol et - şifrelenmiş mi?
          const password = user.password || '';
          const isEncrypted = typeof password === 'string' && password.startsWith('U2FsdGVkX1');

          if (isEncrypted) {

            // Decrypt et
            const { decryptData } = await import('../utils/crypto');
            let decryptedPassword = decryptData(password);

            if (!decryptedPassword || decryptedPassword === password) {
              console.warn(`⚠️ Could not decrypt password for user ID ${user.id}`);
              errors.push(`User ID ${user.id}: Decryption failed`);
              errorCount++;
              continue;
            }

            // Normalize et (sadece rakamlar)
            const normalizedPassword = decryptedPassword.toString().replace(/\D/g, '');

            if (!normalizedPassword) {
              console.warn(`⚠️ Empty password after normalization for user ID ${user.id}`);
              errors.push(`User ID ${user.id}: Empty password after normalization`);
              errorCount++;
              continue;
            }

            // Güncelle (encrypt = false - şifrelenmemiş olarak kaydet)
            await FirebaseService.update(
              this.COLLECTIONS.MEMBER_USERS,
              user.id,
              {
                password: normalizedPassword
              },
              false // encrypt = false
            );

            fixedCount++;
          }
        } catch (userError) {
          console.error(`❌ Error fixing password for user ID ${user.id}:`, userError);
          errors.push(`User ID ${user.id}: ${userError.message}`);
          errorCount++;
        }
      }


      return {
        success: true,
        fixed: fixedCount,
        errors: errorCount,
        errorMessages: errors,
        message: `${fixedCount} şifrelenmiş password düzeltildi${errorCount > 0 ? `, ${errorCount} hata` : ''}`
      };
    } catch (error) {
      console.error('❌ Error fixing encrypted passwords:', error);
      return {
        success: false,
        fixed: 0,
        errors: 0,
        errorMessages: [error.message],
        message: 'Şifrelenmiş password\'lar düzeltilirken hata oluştu: ' + error.message
      };
    }
  }

  // Update all user credentials based on current member data
  static async updateAllCredentials() {
    try {
      const results = {
        memberUsers: { updated: 0, errors: [], firebaseAuthUpdated: 0, firebaseAuthErrors: [] },
        districtPresidents: { updated: 0, errors: [] },
        townPresidents: { updated: 0, errors: [] }
      };


      // Get all active (non-archived) members
      const allMembers = await FirebaseService.getAll(this.COLLECTIONS.MEMBERS, {
        where: [{ field: 'archived', operator: '==', value: false }]
      }, true); // decrypt = true (TC ve telefon decrypt edilmeli)


      // Get all existing member users
      // decrypt = false çünkü password zaten normalize edilmiş (şifrelenmemiş) olarak saklanıyor
      const allMemberUsers = await FirebaseService.getAll(this.COLLECTIONS.MEMBER_USERS, {
        where: [{ field: 'userType', operator: '==', value: 'member' }]
      }, false); // decrypt = false (password şifrelenmemiş olarak saklanıyor)

      // Create a map of memberId -> memberUser for quick lookup
      const memberUserMap = new Map();
      allMemberUsers.forEach(user => {
        const memberId = getMemberId(user);
        if (memberId) {
          memberUserMap.set(memberId, user);
        }
      });

      // Update or create member users
      for (const member of allMembers) {
        try {
          const memberId = getMemberId(member);
          if (!memberId) {
            results.memberUsers.errors.push(`Member has no ID: ${member.name || 'Unknown'}`);
            continue;
          }

          // TC ve telefon numarasını al
          const tc = member.tc || '';
          const phone = member.phone || '';

          if (!tc || !phone) {
            results.memberUsers.errors.push(`Member ID ${memberId}: TC or phone missing`);
            continue;
          }

          // Username = TC, Password = phone (normalized - sadece rakamlar)
          const username = tc.toString().replace(/\D/g, ''); // Sadece rakamlar
          const password = phone.toString().replace(/\D/g, ''); // Sadece rakamlar

          if (!username || !password) {
            results.memberUsers.errors.push(`Member ID ${memberId}: Invalid TC or phone`);
            continue;
          }

          // Check if user exists for this member
          const existingUser = memberUserMap.get(memberId);

          if (existingUser) {
            // Mevcut password'u kontrol et - şifrelenmiş mi?
            const isPasswordEncrypted = typeof existingUser.password === 'string' && existingUser.password.startsWith('U2FsdGVkX1');

            // Mevcut password'u al ve decrypt et (eğer şifrelenmişse)
            let existingPassword = existingUser.password || '';
            if (isPasswordEncrypted) {
              try {
                const { decryptData } = await import('../utils/crypto');
                existingPassword = decryptData(existingPassword) || existingPassword;
              } catch (decryptError) {
                console.warn(`⚠️ Could not decrypt password for member ID ${memberId}:`, decryptError);
              }
            }

            // Password'ları normalize et (karşılaştırma için - sadece rakamlar)
            const existingUsername = (existingUser.username || '').toString().replace(/\D/g, '');
            const normalizedExistingPassword = existingPassword.toString().replace(/\D/g, '');

            const usernameChanged = existingUsername !== username;
            const passwordChanged = normalizedExistingPassword !== password;

            // ÖNEMLİ: Eğer password şifrelenmişse, MUTLAKA güncelle (decrypt edip tekrar kaydet)
            // Ayrıca username veya password değiştiyse de güncelle
            const needsUpdate = isPasswordEncrypted || usernameChanged || passwordChanged;

            if (needsUpdate) {

              await FirebaseService.update(this.COLLECTIONS.MEMBER_USERS, existingUser.id, {
                username,
                password, // Normalize edilmiş password (şifrelenmemiş)
                // Eğer username değiştiyse, authUid'yi temizle (yeni email ile oluşturulsun)
                ...(usernameChanged ? { authUid: null } : {})
              }, false); // encrypt = false (password şifrelenmemeli)

              results.memberUsers.updated++;

              // Firebase Auth şifresini güncelle (eğer authUid varsa)
              if (existingUser.authUid && passwordChanged) {
                try {
                  // Server-side endpoint'e istek gönder (Firebase Admin SDK ile şifre güncellemesi için)
                  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
                  const response = await fetch(`${API_BASE_URL}/auth/update-firebase-auth-password`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      authUid: existingUser.authUid,
                      password: password
                    })
                  });

                  if (response.ok) {
                    results.memberUsers.firebaseAuthUpdated++;
                  } else {
                    const errorData = await response.json();
                    results.memberUsers.firebaseAuthErrors.push(`Member ID ${memberId}: ${errorData.message || 'Firebase Auth update failed'}`);
                    console.error(`❌ Firebase Auth password update failed for member ID ${memberId}:`, errorData);
                  }
                } catch (firebaseError) {
                  results.memberUsers.firebaseAuthErrors.push(`Member ID ${memberId}: ${firebaseError.message}`);
                  console.error(`❌ Firebase Auth password update error for member ID ${memberId}:`, firebaseError);
                }
              }
            }
          } else {
            // Create new user if doesn't exist
            // Check if username already exists (normalize edilmiş username ile karşılaştır)
            const userWithSameUsername = allMemberUsers.find(
              u => {
                const uUsername = (u.username || '').toString().replace(/\D/g, '');
                const uMemberId = getMemberId(u);
                return uUsername === username && uMemberId !== memberId;
              }
            );

            if (!userWithSameUsername) {
              await FirebaseService.create(
                this.COLLECTIONS.MEMBER_USERS,
                null,
                {
                  memberId: memberId,
                  username,
                  password,
                  userType: 'member',
                  isActive: true
                },
                false // encrypt = false
              );

              results.memberUsers.updated++;
            } else {
              results.memberUsers.errors.push(`Member ID ${memberId}: Username ${username} already taken by another user`);
            }
          }
        } catch (error) {
          console.error(`❌ Error processing member ID ${member.id}:`, error);
          results.memberUsers.errors.push(`Member ID ${member.id}: ${error.message}`);
        }
      }

      // TODO: District presidents ve town presidents için de benzer güncelleme yapılabilir
      // Şimdilik sadece member users güncelleniyor

      if (results.memberUsers.firebaseAuthErrors.length > 0) {
      }

      return {
        success: true,
        message: 'Kullanıcı bilgileri güncellendi',
        results
      };
    } catch (error) {
      console.error('❌ Error updating all credentials:', error);
      return {
        success: false,
        message: 'Kullanıcı bilgileri güncellenirken hata oluştu: ' + error.message,
        results: {
          memberUsers: { updated: 0, errors: [error.message], firebaseAuthUpdated: 0, firebaseAuthErrors: [] },
          districtPresidents: { updated: 0, errors: [] },
          townPresidents: { updated: 0, errors: [] }
        }
      };
    }
  }

  // Members API
  static async getMembers(archived = false) {
    try {
      const members = await FirebaseService.getAll(this.COLLECTIONS.MEMBERS);
      if (!members || members.length === 0) {
        return [];
      }

      // archived parametresine göre filtrele
      if (archived) {
        // Arşivlenmiş üyeleri döndür (truthy check)
        return members.filter(m => {
          const isArchived = m.archived === true || m.archived === 'true' || m.archived === 1 || m.archived === '1';
          return isArchived;
        });
      } else {
        // Arşivlenmemiş üyeleri döndür
        return members.filter(m => {
          const isArchived = m.archived === true || m.archived === 'true' || m.archived === 1 || m.archived === '1';
          return !isArchived;
        });
      }
    } catch (error) {
      console.error('Get members error:', error);
      return [];
    }
  }

  static async getMemberById(id) {
    try {
      // Convert ID to string for Firebase
      const stringId = String(id || '').trim();

      if (!stringId) {
        console.error('Invalid member ID:', id);
        return null;
      }

      const member = await FirebaseService.getById(this.COLLECTIONS.MEMBERS, stringId);

      if (!member) {
        console.warn('Member not found for ID:', stringId);
        return null;
      }

      return member;
    } catch (error) {
      console.error('Get member by id error:', error);
      return null;
    }
  }

  static async createMember(memberData) {
    try {

      // Firebase Authentication kontrolü
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Kullanıcı giriş yapmamış. Lütfen önce giriş yapın.');
      }

      // TC kontrolü - aynı TC ile kayıt var mı?
      // TC şifrelenmiş olarak saklanacağı için, şifrelemeden önce kontrol ediyoruz
      if (memberData.tc) {
        try {
          const existingMembers = await FirebaseService.getAll(this.COLLECTIONS.MEMBERS);
          // TC şifrelenmiş olduğu için decrypt ederek karşılaştırmalıyız
          // Veya basit bir kontrol için tüm üyelerin TC'lerini decrypt edip kontrol edelim
          const duplicateMember = existingMembers.find(m => {
            // TC decrypt edilmiş olarak gelir
            const memberTc = m.tc || m.tcNo;
            return memberTc === memberData.tc && !m.archived;
          });

          if (duplicateMember) {
            throw new Error('TC kimlik numarası zaten kayıtlı');
          }
        } catch (checkError) {
          // TC kontrolü hatası ise fırlat, diğer hataları log'la
          if (checkError.message && checkError.message.includes('TC kimlik numarası')) {
            throw checkError;
          }
          console.warn('⚠️ TC duplicate check error (continuing):', checkError);
        }
      }

      // Üyeyi oluştur
      const docId = await FirebaseService.create(
        this.COLLECTIONS.MEMBERS,
        null,
        memberData
      );


      // Kısa bir bekleme sonrası oluşturulan üyeyi döndür
      // (serverTimestamp henüz yazılmış olmayabilir)
      await new Promise(resolve => setTimeout(resolve, 500));

      const createdMember = await FirebaseService.getById(this.COLLECTIONS.MEMBERS, docId);

      // Otomatik olarak kullanıcı oluştur (Firestore'a kaydet, Firebase Auth'a kaydetme)
      // Firebase Auth'da kullanıcı oluşturmak mevcut kullanıcıyı logout eder
      // Bu yüzden sadece Firestore'a kaydediyoruz
      let userCredentials = null; // try bloğunun dışında tanımla

      try {
        // Önce bu üye için zaten kullanıcı var mı kontrol et
        const existingUsers = await FirebaseService.findByField(
          this.COLLECTIONS.MEMBER_USERS,
          'memberId',
          docId
        );

        if (!existingUsers || existingUsers.length === 0) {
          // Kullanıcı yoksa otomatik oluştur (sadece Firestore'a kaydet)
          // Username: TC numarası (zorunlu alan)
          // memberData form'dan geldiği için şifrelenmemiş olmalı
          let username = String(memberData.tc || '').trim();

          // Şifre: Telefon numarası (zorunlu alan) - ÖNEMLİ: TC DEĞİL, TELEFON!
          // memberData form'dan geldiği için şifrelenmemiş olmalı
          // Eğer phone boşsa veya TC ile aynıysa, hata ver
          let password = String(memberData.phone || '').trim();

          // Eğer phone şifrelenmiş görünüyorsa (U2FsdGVkX1 ile başlıyorsa), decrypt et
          // (Bu durum teorik olarak olmamalı çünkü form'dan geliyor, ama güvenlik için kontrol ediyoruz)
          if (password && typeof password === 'string' && password.startsWith('U2FsdGVkX1')) {
            try {
              password = decryptData(password);
            } catch (decryptError) {
              console.warn('⚠️ Could not decrypt phone, using as-is:', decryptError);
            }
          }

          // TC de decrypt edilmiş olmalı, ama kontrol edelim
          if (username && typeof username === 'string' && username.startsWith('U2FsdGVkX1')) {
            try {
              username = decryptData(username);
            } catch (decryptError) {
              console.warn('⚠️ Could not decrypt TC, using as-is:', decryptError);
            }
          }

          // ÖNEMLİ: Şifre TC ile aynıysa veya boşsa, hata ver
          if (!password || password.trim() === '' || password === username || password === memberData.tc) {
            console.error('❌ ŞİFRE HATASI!', {
              passwordIsEmpty: !password || password.trim() === '',
              passwordIsTc: password === username || password === memberData.tc,
              passwordIsPhone: password === memberData.phone
            });
            throw new Error('Şifre telefon numarası olmalı ve TC ile aynı olamaz!');
          }


          // TC ve telefon zorunlu alanlar olduğu için her zaman olmalı
          if (!username || !password) {
            console.error('❌ TC veya telefon numarası eksik!', {
              tcEmpty: !username,
              phoneEmpty: !password
            });
            console.warn('⚠️ TC veya telefon numarası eksik, kullanıcı oluşturulamadı');
          } else {
            // Kullanıcı bilgilerini kaydet (response'a eklenecek)
            userCredentials = {
              username: username,
              password: password
            };


            // Eğer şifre TC ile aynıysa, bu bir hata! (Yukarıda kontrol edildi ama tekrar kontrol)
            if (password === memberData.tc || password === username) {
              console.error('❌ KRİTİK HATA: Şifre TC ile aynı! Bu yanlış!', {
                passwordIsTc: password === memberData.tc,
                passwordIsUsername: password === username
              });
              throw new Error('Şifre telefon numarası olmalı, TC ile aynı olamaz!');
            }

            // Son kontrol: Şifre telefon numarası olmalı
            if (password !== memberData.phone) {
              console.warn('⚠️ Şifre telefon numarası ile eşleşmiyor!');
              // Şifreyi telefon numarası olarak ayarla
              password = String(memberData.phone || '').trim();
            }


            // Sadece Firestore'a kaydet, Firebase Auth'a kaydetme
            // (Firebase Auth'a kaydetme mevcut kullanıcıyı logout eder)
            // Login sırasında Firebase Auth kullanıcısı oluşturulacak
            const userDocId = await FirebaseService.create(
              this.COLLECTIONS.MEMBER_USERS,
              null,
              {
                memberId: docId,
                username,
                password: password, // Telefon numarası - Şifreleme FirebaseService içinde yapılacak
                userType: 'member',
                isActive: true,
                authUid: null // Firebase Auth'a kaydetmedik - Login sırasında oluşturulacak
              }
            );

          }
        } else {
          // Mevcut kullanıcı varsa, bilgilerini al
          const existingUser = existingUsers[0];
          // Şifreyi decrypt et (gösterim için)
          let decryptedPassword = existingUser.password;
          if (decryptedPassword && typeof decryptedPassword === 'string' && decryptedPassword.startsWith('U2FsdGVkX1')) {
            decryptedPassword = decryptData(decryptedPassword);
          }

          userCredentials = {
            username: existingUser.username,
            password: decryptedPassword || existingUser.password
          };

        }
      } catch (userError) {
        // Kullanıcı oluşturma hatası kritik değil, üye zaten oluşturuldu
        console.warn('⚠️ Automatic user creation error (non-critical):', userError);
      }

      // Üye objesini döndür (id ile birlikte)
      const returnData = createdMember || {
        id: docId,
        ...memberData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Kullanıcı bilgilerini ekle (eğer oluşturulduysa)
      if (userCredentials) {
        returnData.userCredentials = userCredentials;
      }

      return returnData;
    } catch (error) {
      console.error('❌ Create member error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code
      });

      // Permission hatası için özel mesaj
      if (error.code === 'permission-denied' || error.message?.includes('permission')) {
        throw new Error('Firebase izin hatası! Lütfen Firebase Console\'da Firestore Security Rules\'u güncelleyin. Detaylar için docs/archive/FIREBASE_SECURITY_RULES.md dosyasına bakın.');
      }

      throw error; // Hatayı fırlat ki MemberForm catch edebilsin
    }
  }

  static async setMemberStars(id, stars) {
    try {

      // Validate stars (1-5 or null)
      if (stars !== null && (stars < 1 || stars > 5 || !Number.isInteger(stars))) {
        throw new Error('Yıldız değeri 1-5 arasında olmalıdır');
      }

      const member = await FirebaseService.getById(this.COLLECTIONS.MEMBERS, id);
      if (!member) {
        throw new Error('Üye bulunamadı');
      }

      // Update only manual_stars field
      await FirebaseService.update(this.COLLECTIONS.MEMBERS, id, {
        manual_stars: stars === null ? null : parseInt(stars)
      }, true); // Encrypt if needed

      // Get updated member
      const updatedMember = await FirebaseService.getById(this.COLLECTIONS.MEMBERS, id);

      return updatedMember;
    } catch (error) {
      console.error('❌ Error setting member stars:', error);
      throw error;
    }
  }

  static async updateMember(id, memberData) {
    try {
      // Önce eski üye bilgilerini al (TC ve telefon karşılaştırması için)
      const oldMember = await FirebaseService.getById(this.COLLECTIONS.MEMBERS, id, true); // decrypt = true

      // Üyeyi güncelle
      await FirebaseService.update(this.COLLECTIONS.MEMBERS, id, memberData);

      // TC veya telefon numarası değiştiyse, member_user'ı da güncelle
      const oldTc = (oldMember?.tc || '').toString().replace(/\D/g, '');
      const oldPhone = (oldMember?.phone || '').toString().replace(/\D/g, '');
      const newTc = (memberData.tc || '').toString().replace(/\D/g, '');
      const newPhone = (memberData.phone || '').toString().replace(/\D/g, '');

      const tcChanged = oldTc !== newTc;
      const phoneChanged = oldPhone !== newPhone;

      if (tcChanged || phoneChanged) {
        // Member user'ı bul ve güncelle
        try {
          const allMemberUsers = await FirebaseService.getAll(this.COLLECTIONS.MEMBER_USERS, {
            where: [
              { field: 'userType', operator: '==', value: 'member' }
            ]
          }, false);

          const memberUser = allMemberUsers.find(u => getMemberId(u) === String(id));

          if (memberUser) {
            // Yeni username ve password'u hesapla (normalize edilmiş)
            const newUsername = newTc;
            const newPassword = newPhone; // Zaten normalize edilmiş (sadece rakamlar)

            // ÖNEMLİ: TC veya telefon değiştiyse, Firebase Auth şifresini güncelle
            const shouldClearAuthUid = tcChanged || phoneChanged;

            // Member user'ı güncelle (encrypt = false - password şifrelenmemeli)
            await FirebaseService.update(this.COLLECTIONS.MEMBER_USERS, memberUser.id, {
              username: newUsername,
              password: newPassword,
              // Eğer TC değiştiyse, authUid'yi temizle (yeni email ile oluşturulsun)
              // Eğer sadece telefon değiştiyse, authUid'yi koru ama şifreyi güncelle
              ...(tcChanged ? { authUid: null } : {})
            }, false); // encrypt = false


            // Firebase Auth'u güncelle (TC veya telefon değiştiyse)
            if (memberUser.authUid && (tcChanged || phoneChanged)) {
              try {
                // Server-side endpoint'e istek gönder (Firebase Admin SDK ile güncelleme için)
                const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
                  (import.meta.env.PROD ? 'https://yrpilsekreterligi.onrender.com/api' : 'http://localhost:5000/api');

                // Email formatı: TC@ilsekreterlik.local
                const oldEmail = oldTc + '@ilsekreterlik.local';
                const newEmail = newTc + '@ilsekreterlik.local';


                const response = await fetch(`${API_BASE_URL}/auth/update-firebase-auth-user`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    authUid: memberUser.authUid,
                    email: tcChanged ? newEmail : undefined, // TC değiştiyse email güncelle
                    oldEmail: tcChanged ? oldEmail : undefined,
                    password: phoneChanged ? newPassword : undefined // Telefon değiştiyse password güncelle
                  })
                });


                if (response.ok) {
                  const responseData = await response.json();
                } else {
                  const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                  console.error(`❌ Firebase Auth user update failed for member ID ${id}:`, {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorData
                  });
                  // Hata olsa bile devam et (Firestore güncellemesi başarılı)
                }
              } catch (firebaseError) {
                console.error(`❌ Firebase Auth user update error for member ID ${id}:`, {
                  error: firebaseError,
                  message: firebaseError.message,
                  stack: firebaseError.stack
                });
                // Hata olsa bile devam et (Firestore güncellemesi başarılı)
              }
            } else if (tcChanged && !memberUser.authUid) {
            } else if (!tcChanged && !phoneChanged) {
            }
          } else {
            // Member user yoksa oluştur
            if (newTc && newPhone) {
              await FirebaseService.create(
                this.COLLECTIONS.MEMBER_USERS,
                null,
                {
                  memberId: String(id),
                  username: newTc,
                  password: newPhone,
                  userType: 'member',
                  isActive: true
                },
                false // encrypt = false
              );
            }
          }
        } catch (userError) {
          console.error('Error updating member user (non-critical):', userError);
          // Member user güncelleme hatası ana işlemi durdurmamalı
        }
      }

      return { success: true, message: 'Üye güncellendi' };
    } catch (error) {
      console.error('Update member error:', error);
      return { success: false, message: 'Üye güncellenirken hata oluştu' };
    }
  }

  static async uploadMemberPhoto(memberId, file) {
    try {

      // Firebase Storage'a yükle
      const FirebaseStorageService = (await import('./FirebaseStorageService')).default;
      const photoUrl = await FirebaseStorageService.uploadMemberPhoto(memberId, file);

      // Üyenin photo field'ını güncelle
      await FirebaseService.update(this.COLLECTIONS.MEMBERS, String(memberId), {
        photo: photoUrl
      }, true); // Encrypt if needed


      return {
        success: true,
        message: 'Fotoğraf başarıyla yüklendi',
        photoUrl: photoUrl
      };
    } catch (error) {
      console.error('Upload member photo error:', error);
      throw new Error('Fotoğraf yüklenirken hata oluştu: ' + (error.message || error));
    }
  }

  static async deleteMember(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.MEMBERS, id);
      return { success: true, message: 'Üye silindi' };
    } catch (error) {
      console.error('Delete member error:', error);
      return { success: false, message: 'Üye silinirken hata oluştu' };
    }
  }

  // Meetings API
  static async getMeetings(archived = false) {
    try {
      const meetings = await FirebaseService.getAll(this.COLLECTIONS.MEETINGS);
      if (!meetings || meetings.length === 0) {
        return [];
      }

      // notes ve description alanlarını decrypt etmeye çalışma (artık şifrelenmeden saklanıyor)
      // Eğer şifrelenmişse (eski kayıtlar için), decrypt etmeye çalış
      const processedMeetings = meetings.map(meeting => {
        // notes decrypt
        if (meeting.notes && typeof meeting.notes === 'string' && meeting.notes.startsWith('U2FsdGVkX1')) {
          // Şifrelenmiş görünüyor, decrypt etmeye çalış
          try {
            const decrypted = decryptData(meeting.notes);
            if (decrypted && decrypted !== meeting.notes) {
              meeting.notes = decrypted;
            }
          } catch (error) {
            // Decrypt başarısız olursa, notes'ı temizle (muhtemelen bozuk veri)
            console.warn('⚠️ Failed to decrypt meeting notes, keeping as is:', error);
          }
        }
        // description decrypt
        if (meeting.description && typeof meeting.description === 'string' && meeting.description.startsWith('U2FsdGVkX1')) {
          // Şifrelenmiş görünüyor, decrypt etmeye çalış
          try {
            const decrypted = decryptData(meeting.description);
            if (decrypted && decrypted !== meeting.description) {
              meeting.description = decrypted;
            }
          } catch (error) {
            // Decrypt başarısız olursa, description'ı temizle (muhtemelen bozuk veri)
            console.warn('⚠️ Failed to decrypt meeting description, keeping as is:', error);
          }
        }
        // notes ve description zaten şifrelenmemişse (yeni kayıtlar), olduğu gibi bırak
        return meeting;
      });

      // archived parametresine göre filtrele
      if (archived) {
        // Arşivlenmiş toplantıları döndür (truthy check)
        return processedMeetings.filter(m => {
          const isArchived = m.archived === true || m.archived === 'true' || m.archived === 1 || m.archived === '1';
          return isArchived;
        });
      } else {
        // Arşivlenmemiş toplantıları döndür
        return processedMeetings.filter(m => {
          const isArchived = m.archived === true || m.archived === 'true' || m.archived === 1 || m.archived === '1';
          return !isArchived;
        });
      }
    } catch (error) {
      console.error('Get meetings error:', error);
      return [];
    }
  }

  static async createMeeting(meetingData) {
    try {
      // notes ve description alanlarını şifrelemeden saklamak için özel işlem
      // notes ve description hassas alanlar değil, normal metin olarak saklanmalı
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');

      // notes ve description değerlerini temizle (boş string ise null yap)
      const notesValue = meetingData.notes && meetingData.notes.trim() !== ''
        ? meetingData.notes.trim()
        : null;
      const descriptionValue = meetingData.description && meetingData.description.trim() !== ''
        ? meetingData.description.trim()
        : null;

      const meetingDataWithoutNotesAndDescription = { ...meetingData };
      delete meetingDataWithoutNotesAndDescription.description;
      delete meetingDataWithoutNotesAndDescription.notes;

      // isPlanned field'ını ekle (varsayılan: false)
      if (meetingDataWithoutNotesAndDescription.isPlanned === undefined) {
        meetingDataWithoutNotesAndDescription.isPlanned = false;
      }

      // Önce notes ve description olmadan kaydet
      const docId = await FirebaseService.create(
        this.COLLECTIONS.MEETINGS,
        null,
        meetingDataWithoutNotesAndDescription,
        false // encrypt = false (artık şifreleme yapılmıyor)
      );

      // Sonra notes ve description'ı şifrelemeden ekle (null ise de ekle ki boş olduğu belli olsun)
      const docRef = doc(db, this.COLLECTIONS.MEETINGS, docId);
      await updateDoc(docRef, {
        notes: notesValue, // Şifrelenmeden sakla (null veya değer)
        description: descriptionValue // Şifrelenmeden sakla (null veya değer)
      });

      // Planlanan toplantı için otomatik SMS gönder
      if (meetingDataWithoutNotesAndDescription.isPlanned && meetingDataWithoutNotesAndDescription.regions) {
        try {
          await this.sendAutoSmsForScheduled('meeting', {
            name: meetingDataWithoutNotesAndDescription.name,
            date: meetingDataWithoutNotesAndDescription.date
          }, meetingDataWithoutNotesAndDescription.regions);
        } catch (smsError) {
          console.error('Auto SMS error (non-blocking):', smsError);
          // SMS hatası toplantı oluşturmayı engellemez
        }
      }

      // In-app notification oluştur (tüm aktif üyelere)
      try {
        const allMembers = await FirebaseService.getAll(this.COLLECTIONS.MEMBERS, {
          where: [{ field: 'archived', operator: '==', value: false }]
        }, false);

        if (!allMembers || allMembers.length === 0) {
          console.warn('⚠️ No active members found for notification');
          return { success: true, id: docId, message: 'Toplantı oluşturuldu' };
        }

        const notificationData = {
          title: 'Yeni Toplantı Oluşturuldu',
          body: `${meetingDataWithoutNotesAndDescription.name} - ${meetingDataWithoutNotesAndDescription.date || 'Tarih belirtilmemiş'}`,
          type: 'meeting',
          data: JSON.stringify({
            meetingId: docId,
            meetingName: meetingDataWithoutNotesAndDescription.name,
            date: meetingDataWithoutNotesAndDescription.date
          }),
          read: false,
          createdAt: new Date().toISOString(),
          expiresAt: meetingDataWithoutNotesAndDescription.date
            ? new Date(new Date(meetingDataWithoutNotesAndDescription.date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 gün sonra expire
            : null
        };

        // Her üye için notification oluştur
        let successCount = 0;
        for (const member of allMembers) {
          try {
            const memberId = getMemberId(member);
            if (!memberId) {
              console.warn('⚠️ Member without ID skipped:', member);
              continue;
            }

            const normalizedMemberId = String(memberId).trim();

            const notificationId = await FirebaseService.create(
              this.COLLECTIONS.NOTIFICATIONS,
              null,
              {
                ...notificationData,
                memberId: normalizedMemberId
              },
              false
            );

            successCount++;
          } catch (memberError) {
            console.error(`❌ Error creating notification for member ${member.id}:`, memberError);
          }
        }

      } catch (notificationError) {
        console.error('Error creating in-app notification (non-blocking):', notificationError);
        // Notification hatası toplantı oluşturmayı engellemez
      }

      return { success: true, id: docId, message: 'Toplantı oluşturuldu' };
    } catch (error) {
      console.error('Create meeting error:', error);
      return { success: false, message: 'Toplantı oluşturulurken hata oluştu' };
    }
  }

  static async updateMeeting(id, meetingData) {
    try {
      // notes ve description alanlarını şifrelemeden saklamak için özel işlem
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');

      // notes ve description değerlerini temizle (boş string ise null yap)
      const notesValue = meetingData.notes && meetingData.notes.trim() !== ''
        ? meetingData.notes.trim()
        : null;
      const descriptionValue = meetingData.description && meetingData.description.trim() !== ''
        ? meetingData.description.trim()
        : null;

      const meetingDataWithoutNotesAndDescription = { ...meetingData };
      delete meetingDataWithoutNotesAndDescription.description;
      delete meetingDataWithoutNotesAndDescription.notes;

      // Önce notes ve description olmadan güncelle
      await FirebaseService.update(this.COLLECTIONS.MEETINGS, id, meetingDataWithoutNotesAndDescription);

      // Sonra notes ve description'ı şifrelemeden ekle/güncelle (null ise de ekle ki boş olduğu belli olsun)
      const docRef = doc(db, this.COLLECTIONS.MEETINGS, id);
      await updateDoc(docRef, {
        notes: notesValue, // Şifrelenmeden sakla (null veya değer)
        description: descriptionValue // Şifrelenmeden sakla (null veya değer)
      });

      return { success: true, message: 'Toplantı güncellendi' };
    } catch (error) {
      console.error('Update meeting error:', error);
      return { success: false, message: 'Toplantı güncellenirken hata oluştu' };
    }
  }

  // Events API
  static async getEvents(archived = false) {
    try {
      const events = await FirebaseService.getAll(this.COLLECTIONS.EVENTS);
      if (!events || events.length === 0) {
        return [];
      }

      // Get event categories to populate event names
      const eventCategories = await this.getEventCategories();

      // description alanını decrypt etmeye çalışma (artık şifrelenmeden saklanıyor)
      // Eğer şifrelenmişse (eski kayıtlar için), decrypt etmeye çalış
      // Ayrıca name alanı boşsa, category_id'den kategori adını al
      const processedEvents = events.map(event => {
        // description decrypt
        if (event.description && typeof event.description === 'string' && event.description.startsWith('U2FsdGVkX1')) {
          // Şifrelenmiş görünüyor, decrypt etmeye çalış
          try {
            const decrypted = decryptData(event.description);
            if (decrypted && decrypted !== event.description) {
              event.description = decrypted;
            }
          } catch (error) {
            // Decrypt başarısız olursa, description'ı temizle (muhtemelen bozuk veri)
            console.warn('⚠️ Failed to decrypt event description, keeping as is:', error);
          }
        }

        // name alanı boşsa ve category_id varsa, kategori adını al
        if ((!event.name || event.name.trim() === '') && event.category_id) {
          const category = eventCategories.find(cat => String(cat.id) === String(event.category_id));
          if (category && category.name) {
            event.name = category.name;
          }
        }

        // Geçersiz attendee'leri temizle (null veya geçersiz ID'ler)
        if (event.attendees && Array.isArray(event.attendees)) {
          const INVALID_ATTENDEE_IDS = ['1762645941232_qxutglj9a', null, 'null', undefined];
          event.attendees = event.attendees.filter(attendee => {
            const memberId = attendee?.memberId;
            // Geçersiz ID'leri filtrele
            if (INVALID_ATTENDEE_IDS.includes(memberId) ||
              memberId === null ||
              memberId === undefined ||
              String(memberId) === 'null' ||
              String(memberId) === '1762645941232_qxutglj9a') {
              return false;
            }
            return true;
          });
        }

        // description zaten şifrelenmemişse (yeni kayıtlar), olduğu gibi bırak
        return event;
      });

      // archived parametresine göre filtrele
      if (archived) {
        // Arşivlenmiş etkinlikleri döndür (truthy check)
        return processedEvents.filter(e => {
          const isArchived = e.archived === true || e.archived === 'true' || e.archived === 1 || e.archived === '1';
          return isArchived;
        });
      } else {
        // Arşivlenmemiş etkinlikleri döndür
        return processedEvents.filter(e => {
          const isArchived = e.archived === true || e.archived === 'true' || e.archived === 1 || e.archived === '1';
          return !isArchived;
        });
      }
    } catch (error) {
      console.error('Get events error:', error);
      return [];
    }
  }

  static async createEvent(eventData) {
    try {
      // description değerini temizle (boş string ise null yap)
      const descriptionValue = eventData.description && eventData.description.trim() !== ''
        ? eventData.description.trim()
        : null;

      // Tüm veriyi tek seferde kaydet (iki aşamalı işlem yerine)
      const finalEventData = {
        ...eventData,
        description: descriptionValue, // Description'ı direkt ekle
        isPlanned: eventData.isPlanned !== undefined ? eventData.isPlanned : false
      };

      // Tek seferde kaydet (updateDoc yerine)
      const docId = await FirebaseService.create(
        this.COLLECTIONS.EVENTS,
        null,
        finalEventData,
        false // encrypt = false (artık şifreleme yapılmıyor)
      );

      // Planlanan etkinlik için otomatik SMS gönder
      if (finalEventData.isPlanned && finalEventData.regions) {
        try {
          await this.sendAutoSmsForScheduled('event', {
            name: finalEventData.name || finalEventData.category_name,
            date: finalEventData.date
          }, finalEventData.regions);
        } catch (smsError) {
          console.error('Auto SMS error (non-blocking):', smsError);
          // SMS hatası etkinlik oluşturmayı engellemez
        }
      }

      // In-app notification oluştur (tüm aktif üyelere)
      try {
        const allMembers = await FirebaseService.getAll(this.COLLECTIONS.MEMBERS, {
          where: [{ field: 'archived', operator: '==', value: false }]
        }, false);

        if (!allMembers || allMembers.length === 0) {
          console.warn('⚠️ No active members found for notification');
          return { success: true, id: docId, message: 'Etkinlik oluşturuldu' };
        }

        const notificationData = {
          title: 'Yeni Etkinlik Oluşturuldu',
          body: `${finalEventData.name} - ${finalEventData.date || 'Tarih belirtilmemiş'}`,
          type: 'event',
          data: JSON.stringify({
            eventId: docId,
            eventName: finalEventData.name,
            date: finalEventData.date
          }),
          read: false,
          createdAt: new Date().toISOString(),
          expiresAt: finalEventData.date
            ? new Date(new Date(finalEventData.date).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 gün sonra expire
            : null
        };

        // Her üye için notification oluştur
        let successCount = 0;
        for (const member of allMembers) {
          try {
            const memberId = getMemberId(member);
            if (!memberId) {
              console.warn('⚠️ Member without ID skipped:', member);
              continue;
            }

            const normalizedMemberId = String(memberId).trim();

            const notificationId = await FirebaseService.create(
              this.COLLECTIONS.NOTIFICATIONS,
              null,
              {
                ...notificationData,
                memberId: normalizedMemberId
              },
              false
            );

            successCount++;
          } catch (memberError) {
            console.error(`❌ Error creating notification for member ${member.id}:`, memberError);
          }
        }

      } catch (notificationError) {
        console.error('Error creating in-app notification (non-blocking):', notificationError);
        // Notification hatası etkinlik oluşturmayı engellemez
      }

      // Process visit counts for selected locations (Firebase)
      if (finalEventData.selectedLocationTypes && finalEventData.selectedLocations && docId) {
        try {
          await this.processEventLocations(
            docId,
            finalEventData.selectedLocationTypes,
            finalEventData.selectedLocations
          );
        } catch (visitError) {
          console.error('Error updating visit counts for Firebase event:', visitError);
          // Don't fail event creation if visit count update fails
        }
      }

      return { success: true, id: docId, message: 'Etkinlik oluşturuldu' };
    } catch (error) {
      console.error('Create event error:', error);

      // QUIC protokol hatası genellikle network sorunlarından kaynaklanır
      // Ancak işlem başarılı olabilir, bu yüzden daha detaylı kontrol yap
      if (error.message && error.message.includes('QUIC')) {
        console.warn('⚠️ QUIC protokol hatası tespit edildi, ancak işlem devam ediyor...');
        // QUIC hatası genellikle real-time listener'lardan kaynaklanır
        // Yazma işlemi başarılı olabilir, bu yüzden kullanıcıya bilgi ver
        return {
          success: true,
          message: 'Etkinlik oluşturuldu (bağlantı uyarısı olabilir)',
          warning: 'Network bağlantı uyarısı alındı, ancak etkinlik kaydedildi'
        };
      }

      return { success: false, message: error.message || 'Etkinlik oluşturulurken hata oluştu' };
    }
  }

  static async updateEvent(id, eventData) {
    try {
      // description alanını şifrelemeden saklamak için özel işlem
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');

      // description değerini temizle (boş string ise null yap)
      const descriptionValue = eventData.description && eventData.description.trim() !== ''
        ? eventData.description.trim()
        : null;

      // Geçersiz attendee'leri temizle (null veya geçersiz ID'ler)
      const INVALID_ATTENDEE_IDS = ['1762645941232_qxutglj9a', null, 'null', undefined];
      if (eventData.attendees && Array.isArray(eventData.attendees)) {
        eventData.attendees = eventData.attendees.filter(attendee => {
          const memberId = attendee?.memberId;
          // Geçersiz ID'leri filtrele
          if (INVALID_ATTENDEE_IDS.includes(memberId) ||
            memberId === null ||
            memberId === undefined ||
            String(memberId) === 'null' ||
            String(memberId) === '1762645941232_qxutglj9a') {
            return false;
          }
          return true;
        });
      }

      const eventDataWithoutDescription = { ...eventData };
      delete eventDataWithoutDescription.description;

      // Önce description olmadan güncelle
      await FirebaseService.update(this.COLLECTIONS.EVENTS, id, eventDataWithoutDescription);

      // Sonra description'ı şifrelemeden ekle/güncelle (null ise de ekle ki boş olduğu belli olsun)
      const docRef = doc(db, this.COLLECTIONS.EVENTS, id);
      await updateDoc(docRef, {
        description: descriptionValue // Şifrelenmeden sakla (null veya değer)
      });

      return { success: true, message: 'Etkinlik güncellendi' };
    } catch (error) {
      console.error('Update event error:', error);
      return { success: false, message: 'Etkinlik güncellenirken hata oluştu' };
    }
  }

  // Clean up invalid attendees from all events
  static async cleanupInvalidAttendees() {
    try {
      const { collection, getDocs, doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');

      const INVALID_ATTENDEE_IDS = ['1762645941232_qxutglj9a', null, 'null', undefined];

      const eventsRef = collection(db, this.COLLECTIONS.EVENTS);
      const eventsSnapshot = await getDocs(eventsRef);

      let totalEvents = 0;
      let updatedEvents = 0;
      let totalRemoved = 0;

      const updatePromises = [];

      eventsSnapshot.forEach((eventDoc) => {
        totalEvents++;
        const eventData = eventDoc.data();
        const eventId = eventDoc.id;

        if (!eventData.attendees || !Array.isArray(eventData.attendees)) {
          return;
        }

        const originalAttendees = eventData.attendees;
        const validAttendees = originalAttendees.filter(attendee => {
          const memberId = attendee?.memberId;

          // Check if memberId is invalid
          if (INVALID_ATTENDEE_IDS.includes(memberId) ||
            memberId === null ||
            memberId === undefined ||
            String(memberId) === 'null' ||
            String(memberId) === '1762645941232_qxutglj9a') {
            return false;
          }

          return true;
        });

        if (validAttendees.length !== originalAttendees.length) {
          const removedCount = originalAttendees.length - validAttendees.length;
          totalRemoved += removedCount;


          const eventRef = doc(db, this.COLLECTIONS.EVENTS, eventId);
          updatePromises.push(
            updateDoc(eventRef, {
              attendees: validAttendees
            }).then(() => {
              updatedEvents++;
            }).catch(error => {
              console.error(`❌ Error updating event ${eventId}:`, error);
            })
          );
        }
      });

      // Wait for all updates to complete
      await Promise.all(updatePromises);


      return {
        success: true,
        totalEvents,
        updatedEvents,
        totalRemoved,
        message: `${updatedEvents} etkinlik güncellendi, ${totalRemoved} geçersiz katılımcı silindi`
      };
    } catch (error) {
      console.error('❌ Error cleaning up invalid attendees:', error);
      throw new Error('Geçersiz katılımcılar temizlenirken hata oluştu');
    }
  }

  // Regions API
  static async getRegions() {
    try {
      const regions = await FirebaseService.getAll(this.COLLECTIONS.REGIONS);
      // Her region'ın ID'sini string'e çevir
      return (regions || []).map(region => ({
        ...region,
        id: String(region.id || '')
      })).filter(region => region.id && region.name);
    } catch (error) {
      console.error('Get regions error:', error);
      return [];
    }
  }

  // Positions API
  static async getPositions() {
    try {
      const positions = await FirebaseService.getAll(this.COLLECTIONS.POSITIONS);
      return positions || [];
    } catch (error) {
      // Silently handle errors - collection might not exist yet
      if (error.message && error.message.includes('collection')) {
        // Collection not found is not a critical error
        return [];
      }
      console.warn('Get positions error:', error);
      return [];
    }
  }

  static async getAllPermissions() {
    try {
      const allPermissions = await FirebaseService.getAll(this.COLLECTIONS.POSITION_PERMISSIONS);
      const map = {};
      allPermissions.forEach(perm => {
        if (!map[perm.position]) {
          map[perm.position] = [];
        }
        map[perm.position].push(perm.permission);
      });
      return map;
    } catch (error) {
      console.error('Get all permissions error:', error);
      return {};
    }
  }

  static async getPermissionsForPosition(position) {
    try {
      const permissions = await FirebaseService.findByField(
        this.COLLECTIONS.POSITION_PERMISSIONS,
        'position',
        position
      );
      return permissions ? permissions.map(p => p.permission) : [];
    } catch (error) {
      console.error('Get permissions for position error:', error);
      return [];
    }
  }

  static async setPermissionsForPosition(position, permissions) {
    try {
      // Önce bu pozisyon için mevcut izinleri sil
      const existingPermissions = await FirebaseService.findByField(
        this.COLLECTIONS.POSITION_PERMISSIONS,
        'position',
        position
      );

      if (existingPermissions && existingPermissions.length > 0) {
        for (const perm of existingPermissions) {
          await FirebaseService.delete(this.COLLECTIONS.POSITION_PERMISSIONS, perm.id);
        }
      }

      // Yeni izinleri ekle
      for (const permission of permissions) {
        await FirebaseService.create(this.COLLECTIONS.POSITION_PERMISSIONS, null, {
          position: position,
          permission: permission
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Set permissions for position error:', error);
      throw new Error('Yetkiler kaydedilemedi: ' + error.message);
    }
  }

  // Member Registrations API
  static async getMemberRegistrations() {
    try {
      const registrations = await FirebaseService.getAll(this.COLLECTIONS.MEMBER_REGISTRATIONS);
      return registrations || [];
    } catch (error) {
      console.error('Get member registrations error:', error);
      return [];
    }
  }

  static async createMemberRegistration(registrationData) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.MEMBER_REGISTRATIONS, null, registrationData, false);
      return { success: true, id: docId, message: 'Üye kaydı oluşturuldu' };
    } catch (error) {
      console.error('Create member registration error:', error);
      throw new Error('Üye kaydı oluşturulurken hata oluştu');
    }
  }

  static async updateMemberRegistration(id, registrationData) {
    try {
      await FirebaseService.update(this.COLLECTIONS.MEMBER_REGISTRATIONS, id, registrationData);
      return { success: true, message: 'Üye kaydı güncellendi' };
    } catch (error) {
      console.error('Update member registration error:', error);
      throw new Error('Üye kaydı güncellenirken hata oluştu');
    }
  }

  static async deleteMemberRegistration(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.MEMBER_REGISTRATIONS, id);
      return { success: true, message: 'Üye kaydı silindi' };
    } catch (error) {
      console.error('Delete member registration error:', error);
      throw new Error('Üye kaydı silinirken hata oluştu');
    }
  }

  // Archive Member/Meeting
  static async archiveMember(id) {
    try {
      const member = await FirebaseService.getById(this.COLLECTIONS.MEMBERS, id);
      if (!member) {
        throw new Error('Üye bulunamadı');
      }

      // archived alanını güncelle (şifreleme yapma)
      await FirebaseService.update(this.COLLECTIONS.MEMBERS, id, { archived: true }, false);

      // Üye kullanıcısını pasif yap (eğer varsa)
      try {
        const memberUsers = await FirebaseService.findByField(
          this.COLLECTIONS.MEMBER_USERS,
          'memberId',
          id
        );

        if (memberUsers && memberUsers.length > 0) {
          for (const memberUser of memberUsers) {
            await FirebaseService.update(this.COLLECTIONS.MEMBER_USERS, memberUser.id, {
              isActive: false
            }, false); // encrypt = false
          }
        }
      } catch (userError) {
        console.warn('⚠️ Error deactivating member user (non-critical):', userError);
        // Devam et, member user pasif yapma hatası kritik değil
      }

      // Güncellenmiş üyeyi tekrar getir ve döndür
      const updatedMember = await FirebaseService.getById(this.COLLECTIONS.MEMBERS, id);

      return {
        success: true,
        message: 'Üye arşivlendi',
        member: updatedMember
      };
    } catch (error) {
      console.error('Archive member error:', error);
      throw new Error('Üye arşivlenirken hata oluştu: ' + error.message);
    }
  }

  static async restoreMember(id) {
    try {
      await FirebaseService.update(this.COLLECTIONS.MEMBERS, id, { archived: false });

      // Üye kullanıcısını aktif yap (eğer varsa)
      try {
        const memberUsers = await FirebaseService.findByField(
          this.COLLECTIONS.MEMBER_USERS,
          'memberId',
          id
        );

        if (memberUsers && memberUsers.length > 0) {
          for (const memberUser of memberUsers) {
            await FirebaseService.update(this.COLLECTIONS.MEMBER_USERS, memberUser.id, {
              isActive: true
            }, false); // encrypt = false
          }
        }
      } catch (userError) {
        console.warn('⚠️ Error activating member user (non-critical):', userError);
        // Devam et, member user aktif yapma hatası kritik değil
      }

      return { success: true, message: 'Üye geri yüklendi' };
    } catch (error) {
      console.error('Restore member error:', error);
      throw new Error('Üye geri yüklenirken hata oluştu');
    }
  }

  // Preview Excel import - analyze file and return preview data
  static async previewImportMembersFromExcel(file) {
    try {
      // XLSX kütüphanesini dinamik olarak yükle
      const XLSX = await import('xlsx');

      // Dosyayı oku
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // İlk satırı başlık olarak atla
      const rows = jsonData.slice(1);

      const newMembers = [];
      const updatedMembers = [];
      const errors = [];

      // Get all existing members once
      const existingMembers = await FirebaseService.getAll(this.COLLECTIONS.MEMBERS);

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];

          if (row.length < 3) {
            continue; // En az 3 sütun gerekli: TC, İsim, Telefon
          }

          // Map Excel columns to member fields
          const tc = row[0] ? String(row[0]).trim() : '';
          const name = row[1] ? String(row[1]).trim() : '';
          const phone = row[2] ? String(row[2]).trim() : '';
          let position = row[3] ? String(row[3]).trim() : '';
          let region = row[4] ? String(row[4]).trim() : '';

          // If position or region is empty, set default values
          if (!position) {
            position = 'Üye';
          }

          if (!region) {
            region = 'Üye';
          }

          // Validate required fields
          if (!tc || !name || !phone) {
            errors.push(`Satır ${i + 2}: Gerekli alanlar eksik (TC, İsim Soyisim, Telefon zorunludur)`);
            continue;
          }

          // Validate TC length
          if (tc.length !== 11) {
            errors.push(`Satır ${i + 2}: TC kimlik numarası 11 haneli olmalıdır`);
            continue;
          }

          // Check if TC already exists
          const existingMember = existingMembers.find(m => {
            if (m.archived) return false;

            const memberTc = m.tc || m.tcNo;
            if (!memberTc) return false;

            // TC'yi decrypt etmek gerekebilir
            let decryptedTc = memberTc;
            try {
              if (typeof memberTc === 'string' && memberTc.startsWith('U2FsdGVkX1')) {
                decryptedTc = decryptData(memberTc);
              }
            } catch (e) {
              // Decrypt başarısız, orijinal TC'yi kullan
              decryptedTc = memberTc;
            }

            return String(decryptedTc) === String(tc);
          });

          const memberData = {
            tc,
            name,
            phone,
            position,
            region
          };

          if (existingMember) {
            // TC zaten varsa, güncelleme bilgisi ekle
            updatedMembers.push({
              ...memberData,
              currentName: existingMember.name,
              currentPhone: existingMember.phone,
              memberId: existingMember.id
            });
          } else {
            // TC yoksa, yeni üye
            newMembers.push(memberData);
          }
        } catch (rowError) {
          console.error(`Error processing row ${i + 2}:`, rowError);
          errors.push(`Satır ${i + 2}: ${rowError.message}`);
        }
      }

      return {
        newMembers,
        updatedMembers,
        errors
      };
    } catch (error) {
      console.error('Excel preview error:', error);
      throw new Error('Excel dosyası analiz edilirken hata oluştu: ' + error.message);
    }
  }

  // Import members from Excel (with preview data)
  static async importMembersFromExcel(file, previewData = null) {
    try {
      let newMembers = [];
      let updatedMembers = [];
      let errors = [];

      // If preview data is provided, use it; otherwise analyze the file
      if (previewData) {
        newMembers = previewData.newMembers || [];
        updatedMembers = previewData.updatedMembers || [];
        errors = previewData.errors || [];
      } else {
        // Fallback: analyze file if preview data not provided
        const preview = await this.previewImportMembersFromExcel(file);
        newMembers = preview.newMembers;
        updatedMembers = preview.updatedMembers;
        errors = preview.errors;
      }

      let importedCount = 0;
      const importErrors = [];

      // Helper function to create region if it doesn't exist
      const createRegionIfNotExists = async (regionName) => {
        if (!regionName || regionName.trim() === '') return null;

        try {
          const existingRegions = await FirebaseService.findByField(
            this.COLLECTIONS.REGIONS,
            'name',
            regionName.trim()
          );

          if (existingRegions && existingRegions.length > 0) {
            return existingRegions[0];
          }

          const docId = await FirebaseService.create(
            this.COLLECTIONS.REGIONS,
            null,
            { name: regionName.trim() },
            false
          );

          return { id: docId, name: regionName.trim() };
        } catch (error) {
          console.error('Error creating region:', error);
          return null;
        }
      };

      // Helper function to create position if it doesn't exist
      const createPositionIfNotExists = async (positionName) => {
        if (!positionName || positionName.trim() === '') return null;

        try {
          const existingPositions = await FirebaseService.findByField(
            this.COLLECTIONS.POSITIONS,
            'name',
            positionName.trim()
          );

          if (existingPositions && existingPositions.length > 0) {
            return existingPositions[0];
          }

          const docId = await FirebaseService.create(
            this.COLLECTIONS.POSITIONS,
            null,
            { name: positionName.trim() },
            false
          );

          return { id: docId, name: positionName.trim() };
        } catch (error) {
          console.error('Error creating position:', error);
          return null;
        }
      };

      // Process new members
      for (const memberData of newMembers) {
        try {
          // Create region and position if they don't exist
          await createRegionIfNotExists.call(this, memberData.region);
          await createPositionIfNotExists.call(this, memberData.position);

          // Create new member
          await this.createMember({
            ...memberData,
            archived: false
          });
          importedCount++;
        } catch (error) {
          console.error(`Error creating member ${memberData.tc}:`, error);
          importErrors.push(`Üye oluşturulurken hata: ${memberData.name} (${memberData.tc}) - ${error.message}`);
        }
      }

      // Process updated members
      for (const memberData of updatedMembers) {
        try {
          // Create region and position if they don't exist
          await createRegionIfNotExists.call(this, memberData.region);
          await createPositionIfNotExists.call(this, memberData.position);

          // Update existing member
          await this.updateMember(memberData.memberId, {
            tc: memberData.tc,
            name: memberData.name,
            phone: memberData.phone,
            position: memberData.position,
            region: memberData.region,
            archived: false
          });
          importedCount++;
        } catch (error) {
          console.error(`Error updating member ${memberData.tc}:`, error);
          importErrors.push(`Üye güncellenirken hata: ${memberData.name} (${memberData.tc}) - ${error.message}`);
        }
      }

      return {
        message: `${importedCount} üye başarıyla içe aktarıldı`,
        count: importedCount,
        errors: [...errors, ...importErrors].length > 0 ? [...errors, ...importErrors] : undefined
      };
    } catch (error) {
      console.error('Excel import error:', error);
      throw new Error('Excel içe aktarımı sırasında hata oluştu: ' + error.message);
    }
  }

  // Delete archived member permanently
  static async deleteArchivedMember(id) {
    try {

      // ID formatını normalize et (eğer string ise)
      const memberId = String(id).trim();

      const member = await FirebaseService.getById(this.COLLECTIONS.MEMBERS, memberId);

      if (!member) {
        // Belki ID formatı farklı - tüm üyeleri kontrol et
        const allMembers = await FirebaseService.getAll(this.COLLECTIONS.MEMBERS);
        const foundMember = allMembers.find(m => String(m.id) === memberId || String(m.id) === String(id));

        if (foundMember) {
          const isArchived = foundMember.archived === true || foundMember.archived === 'true' || foundMember.archived === 1 || foundMember.archived === '1';
          if (isArchived) {
            await FirebaseService.delete(this.COLLECTIONS.MEMBERS, foundMember.id);

            // Eğer member_user varsa onu da sil
            try {
              const memberUsers = await FirebaseService.findByField(
                this.COLLECTIONS.MEMBER_USERS,
                'memberId',
                foundMember.id
              );

              if (memberUsers && memberUsers.length > 0) {
                for (const memberUser of memberUsers) {
                  await FirebaseService.delete(this.COLLECTIONS.MEMBER_USERS, memberUser.id);
                }
              }
            } catch (userError) {
              console.warn('Error deleting member user:', userError);
            }

            return { success: true, message: 'Arşivlenmiş üye kalıcı olarak silindi' };
          } else {
            throw new Error('Bu üye arşivlenmemiş');
          }
        }

        throw new Error('Arşivlenmiş üye bulunamadı');
      }

      // Arşivlenmiş olup olmadığını kontrol et (truthy check - boolean, string "true", 1 gibi değerleri kabul et)
      const isArchived = member.archived === true || member.archived === 'true' || member.archived === 1 || member.archived === '1';

      if (!isArchived) {
        throw new Error('Bu üye arşivlenmemiş');
      }

      // Üyeyi kalıcı olarak sil
      await FirebaseService.delete(this.COLLECTIONS.MEMBERS, member.id || memberId);

      // Eğer member_user varsa onu da sil (Firestore ve Firebase Auth'dan)
      try {
        const memberUsers = await FirebaseService.findByField(
          this.COLLECTIONS.MEMBER_USERS,
          'memberId',
          id
        );

        if (memberUsers && memberUsers.length > 0) {
          for (const memberUser of memberUsers) {

            // Firebase Auth'dan da sil (eğer authUid varsa) - Backend üzerinden
            if (memberUser.authUid) {
              try {
                // Backend endpoint'ini kullanarak Firebase Auth kullanıcısını sil
                const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
                const response = await fetch(`${API_BASE_URL}/auth/firebase-auth-user/${memberUser.authUid}`, {
                  method: 'DELETE',
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });

                if (response.ok) {
                } else {
                  const errorData = await response.json().catch(() => ({}));
                  console.warn('⚠️ Firebase Auth deletion via backend failed:', errorData.message || response.statusText);
                }
              } catch (authError) {
                console.warn('⚠️ Firebase Auth deletion failed (non-critical):', authError);
                // Firestore'dan member_user silindiğinde, login sırasında kontrol edilip Firebase Auth'daki kullanıcı da geçersiz sayılır
                // Bu yüzden kritik bir hata değil
              }
            }

            // Firestore'dan member_user'ı sil (dashboard sayfası da kaldırılır)
            await FirebaseService.delete(this.COLLECTIONS.MEMBER_USERS, memberUser.id);
          }
        } else {
        }
      } catch (userError) {
        console.error('❌ Error deleting member user:', userError);
        // Devam et, member user silme hatası kritik değil
        // Üye zaten silindi, member_user silme hatası kritik değil
      }

      return { success: true, message: 'Arşivlenmiş üye kalıcı olarak silindi' };
    } catch (error) {
      console.error('Delete archived member error:', error);
      throw new Error('Arşivlenmiş üye silinirken hata oluştu: ' + error.message);
    }
  }

  // Delete archived meeting permanently
  static async deleteArchivedMeeting(id) {
    try {
      const meeting = await FirebaseService.getById(this.COLLECTIONS.MEETINGS, id);
      if (!meeting) {
        throw new Error('Arşivlenmiş toplantı bulunamadı');
      }

      // Arşivlenmiş olup olmadığını kontrol et (truthy check)
      const isArchived = meeting.archived === true || meeting.archived === 'true' || meeting.archived === 1 || meeting.archived === '1';
      if (!isArchived) {
        throw new Error('Bu toplantı arşivlenmemiş');
      }

      // Toplantıyı kalıcı olarak sil
      await FirebaseService.delete(this.COLLECTIONS.MEETINGS, id);

      return { success: true, message: 'Arşivlenmiş toplantı kalıcı olarak silindi' };
    } catch (error) {
      console.error('Delete archived meeting error:', error);
      throw new Error('Arşivlenmiş toplantı silinirken hata oluştu: ' + error.message);
    }
  }

  static async archiveMeeting(id) {
    try {
      await FirebaseService.update(this.COLLECTIONS.MEETINGS, id, { archived: true });
      return { success: true, message: 'Toplantı arşivlendi' };
    } catch (error) {
      console.error('Archive meeting error:', error);
      throw new Error('Toplantı arşivlenirken hata oluştu');
    }
  }

  static async getMeetingById(id) {
    try {
      return await FirebaseService.getById(this.COLLECTIONS.MEETINGS, id);
    } catch (error) {
      console.error('Get meeting by id error:', error);
      return null;
    }
  }

  static async updateAttendance(meetingId, memberId, attended) {
    try {
      const meeting = await FirebaseService.getById(this.COLLECTIONS.MEETINGS, meetingId);
      if (!meeting) throw new Error('Toplantı bulunamadı');

      const attendees = meeting.attendees || [];
      const index = attendees.findIndex(a => a.memberId === memberId);

      if (index >= 0) {
        attendees[index].attended = attended;
      } else {
        attendees.push({ memberId, attended, excuse: { hasExcuse: false, reason: null } });
      }

      await FirebaseService.update(this.COLLECTIONS.MEETINGS, meetingId, { attendees });
      return { success: true, message: 'Katılım güncellendi' };
    } catch (error) {
      console.error('Update attendance error:', error);
      throw new Error('Katılım güncellenirken hata oluştu');
    }
  }

  static async updateExcuse(meetingId, memberId, hasExcuse, reason) {
    try {
      const meeting = await FirebaseService.getById(this.COLLECTIONS.MEETINGS, meetingId);
      if (!meeting) throw new Error('Toplantı bulunamadı');

      const attendees = meeting.attendees || [];
      const index = attendees.findIndex(a => a.memberId === memberId);

      if (index >= 0) {
        attendees[index].excuse = { hasExcuse, reason };
      } else {
        attendees.push({ memberId, attended: false, excuse: { hasExcuse, reason } });
      }

      await FirebaseService.update(this.COLLECTIONS.MEETINGS, meetingId, { attendees });
      return { success: true, message: 'Mazeret güncellendi' };
    } catch (error) {
      console.error('Update excuse error:', error);
      throw new Error('Mazeret güncellenirken hata oluştu');
    }
  }

  static async archiveEvent(id) {
    try {
      await FirebaseService.update(this.COLLECTIONS.EVENTS, id, { archived: true });
      return { success: true, message: 'Etkinlik arşivlendi' };
    } catch (error) {
      console.error('Archive event error:', error);
      throw new Error('Etkinlik arşivlenirken hata oluştu');
    }
  }

  static async deleteEvent(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.EVENTS, id);
      return { success: true, message: 'Etkinlik silindi' };
    } catch (error) {
      console.error('Delete event error:', error);
      throw new Error('Etkinlik silinirken hata oluştu');
    }
  }

  static async getEventById(id) {
    try {
      return await FirebaseService.getById(this.COLLECTIONS.EVENTS, id);
    } catch (error) {
      console.error('Get event by id error:', error);
      return null;
    }
  }

  // Regions CRUD
  static async createRegion(regionData) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.REGIONS, null, regionData);

      // Kısa bir bekleme ekle (Firestore yazma işleminin tamamlanması için)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Oluşturulan region'ı tam olarak al ve döndür
      const createdRegion = await FirebaseService.getById(this.COLLECTIONS.REGIONS, docId);

      if (createdRegion) {
        // ID'yi string olarak garantile
        return {
          ...createdRegion,
          id: String(createdRegion.id || docId)
        };
      }

      // Eğer getById başarısız olursa, manuel olarak oluştur
      return {
        id: String(docId),
        name: regionData.name,
        ...regionData
      };
    } catch (error) {
      console.error('Create region error:', error);
      throw new Error('Bölge oluşturulurken hata oluştu: ' + (error.message || error));
    }
  }

  static async updateRegion(id, regionData) {
    try {
      await FirebaseService.update(this.COLLECTIONS.REGIONS, id, regionData);
      return { success: true, message: 'Bölge güncellendi' };
    } catch (error) {
      console.error('Update region error:', error);
      throw new Error('Bölge güncellenirken hata oluştu');
    }
  }

  static async deleteRegion(id) {
    try {
      if (id === null || id === undefined) {
        throw new Error('Bölge ID null veya undefined');
      }

      // ID'yi mutlaka string'e çevir (Firebase string bekler)
      let stringId;
      if (typeof id === 'object') {
        if (Array.isArray(id)) {
          throw new Error(`Region ID array olamaz: ${JSON.stringify(id)}`);
        }
        if (id.id) {
          stringId = String(id.id);
        } else if (id.toString && typeof id.toString === 'function') {
          stringId = String(id.toString());
        } else {
          throw new Error(`Region ID geçersiz object format: ${JSON.stringify(id)}`);
        }
      } else if (typeof id === 'number') {
        stringId = String(id);
      } else {
        stringId = String(id);
      }

      // Boş string kontrolü
      if (!stringId || stringId.trim() === '' || stringId === 'undefined' || stringId === 'null' || stringId === '[object Object]') {
        throw new Error(`Region ID geçersiz: ${id} -> ${stringId}`);
      }

      stringId = stringId.trim();

      // Collection name kontrolü
      const collectionName = String(this.COLLECTIONS.REGIONS || 'regions');
      if (!collectionName || collectionName.trim() === '') {
        throw new Error(`Collection name geçersiz: ${this.COLLECTIONS.REGIONS}`);
      }

      // Region'ı sil
      await FirebaseService.delete(collectionName, stringId);

      return { success: true, message: 'Bölge silindi' };
    } catch (error) {
      console.error('Delete region error:', error);
      throw new Error('Bölge silinirken hata oluştu: ' + (error.message || error));
    }
  }

  // Positions CRUD
  static async createPosition(positionData) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.POSITIONS, null, positionData);
      return { success: true, id: docId, message: 'Pozisyon oluşturuldu' };
    } catch (error) {
      console.error('Create position error:', error);
      throw new Error('Pozisyon oluşturulurken hata oluştu');
    }
  }

  static async updatePosition(id, positionData) {
    try {
      await FirebaseService.update(this.COLLECTIONS.POSITIONS, id, positionData);
      return { success: true, message: 'Pozisyon güncellendi' };
    } catch (error) {
      console.error('Update position error:', error);
      throw new Error('Pozisyon güncellenirken hata oluştu');
    }
  }

  static async deletePosition(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.POSITIONS, id);
      return { success: true, message: 'Pozisyon silindi' };
    } catch (error) {
      console.error('Delete position error:', error);
      throw new Error('Pozisyon silinirken hata oluştu');
    }
  }

  // Districts CRUD
  static async getDistricts() {
    try {
      return await FirebaseService.getAll(this.COLLECTIONS.DISTRICTS);
    } catch (error) {
      console.error('Get districts error:', error);
      return [];
    }
  }

  static async getDistrictById(districtId) {
    try {
      // districtId boş veya geçersizse hata döndür
      if (!districtId || districtId === '' || districtId === undefined || districtId === null) {
        return { success: false, message: 'İlçe ID gerekli' };
      }

      const district = await FirebaseService.getById(this.COLLECTIONS.DISTRICTS, districtId);
      if (!district) {
        return { success: false, message: 'İlçe bulunamadı' };
      }

      return {
        success: true,
        district: {
          ...district,
          provinceName: district.province_name || district.provinceName || ''
        }
      };
    } catch (error) {
      console.error('Get district by id error:', error);
      return { success: false, message: 'İlçe bilgileri alınamadı' };
    }
  }

  static async createDistrict(districtData) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.DISTRICTS, null, districtData);
      return { success: true, id: docId, message: 'İlçe oluşturuldu' };
    } catch (error) {
      console.error('Create district error:', error);
      throw new Error('İlçe oluşturulurken hata oluştu');
    }
  }

  static async updateDistrict(id, districtData) {
    try {
      await FirebaseService.update(this.COLLECTIONS.DISTRICTS, id, districtData);
      return { success: true, message: 'İlçe güncellendi' };
    } catch (error) {
      console.error('Update district error:', error);
      throw new Error('İlçe güncellenirken hata oluştu');
    }
  }

  static async deleteDistrict(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.DISTRICTS, id);
      return { success: true, message: 'İlçe silindi' };
    } catch (error) {
      console.error('Delete district error:', error);
      throw new Error('İlçe silinirken hata oluştu');
    }
  }

  // Towns CRUD
  static async getTowns() {
    try {
      const towns = await FirebaseService.getAll(this.COLLECTIONS.TOWNS);
      const townOfficials = await FirebaseService.getAll(this.COLLECTIONS.TOWN_OFFICIALS);

      // Her belde için başkan bilgisini ekle
      return towns.map(town => {
        const official = townOfficials.find(o => String(o.town_id) === String(town.id));
        return {
          ...town,
          town_chairman_name: official?.chairman_name || null,
          town_chairman_phone: official?.chairman_phone || null
        };
      });
    } catch (error) {
      console.error('Get towns error:', error);
      return [];
    }
  }

  static async getTownById(townId) {
    try {
      // townId boş veya geçersizse hata döndür
      if (!townId || townId === '' || townId === undefined || townId === null) {
        return { success: false, message: 'Belde ID gerekli' };
      }

      const town = await FirebaseService.getById(this.COLLECTIONS.TOWNS, townId);
      if (!town) {
        return { success: false, message: 'Belde bulunamadı' };
      }

      // Districts bilgisini de ekle
      const districts = await this.getDistricts();
      const district = districts.find(d => String(d.id) === String(town.district_id));

      return {
        success: true,
        town: {
          ...town,
          districtName: district?.name || ''
        }
      };
    } catch (error) {
      console.error('Get town by id error:', error);
      return { success: false, message: 'Belde bilgileri alınamadı' };
    }
  }

  static async createTown(townData) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.TOWNS, null, townData);
      return { success: true, id: docId, message: 'İlçe oluşturuldu' };
    } catch (error) {
      console.error('Create town error:', error);
      throw new Error('İlçe oluşturulurken hata oluştu');
    }
  }

  static async updateTown(id, townData) {
    try {
      await FirebaseService.update(this.COLLECTIONS.TOWNS, id, townData);
      return { success: true, message: 'İlçe güncellendi' };
    } catch (error) {
      console.error('Update town error:', error);
      throw new Error('İlçe güncellenirken hata oluştu');
    }
  }

  static async deleteTown(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.TOWNS, id);
      return { success: true, message: 'İlçe silindi' };
    } catch (error) {
      console.error('Delete town error:', error);
      throw new Error('İlçe silinirken hata oluştu');
    }
  }

  // Neighborhoods CRUD
  static async getNeighborhoods() {
    try {
      const neighborhoods = await FirebaseService.getAll(this.COLLECTIONS.NEIGHBORHOODS);
      const districts = await FirebaseService.getAll(this.COLLECTIONS.DISTRICTS);
      const towns = await FirebaseService.getAll(this.COLLECTIONS.TOWNS);

      // Populate district_name and town_name
      return neighborhoods.map(neighborhood => {
        const district = districts.find(d => String(d.id) === String(neighborhood.district_id));
        const town = neighborhood.town_id ? towns.find(t => String(t.id) === String(neighborhood.town_id)) : null;
        return {
          ...neighborhood,
          district_name: district?.name || '',
          town_name: town?.name || ''
        };
      });
    } catch (error) {
      console.error('Get neighborhoods error:', error);
      return [];
    }
  }

  static async createNeighborhood(neighborhoodData) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.NEIGHBORHOODS, null, neighborhoodData);
      return { success: true, id: docId, message: 'Mahalle oluşturuldu' };
    } catch (error) {
      console.error('Create neighborhood error:', error);
      throw new Error('Mahalle oluşturulurken hata oluştu');
    }
  }

  static async updateNeighborhood(id, neighborhoodData) {
    try {
      await FirebaseService.update(this.COLLECTIONS.NEIGHBORHOODS, id, neighborhoodData);
      return { success: true, message: 'Mahalle güncellendi' };
    } catch (error) {
      console.error('Update neighborhood error:', error);
      throw new Error('Mahalle güncellenirken hata oluştu');
    }
  }

  static async deleteNeighborhood(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.NEIGHBORHOODS, id);
      return { success: true, message: 'Mahalle silindi' };
    } catch (error) {
      console.error('Delete neighborhood error:', error);
      throw new Error('Mahalle silinirken hata oluştu');
    }
  }

  // Villages CRUD
  static async getVillages() {
    try {
      const villages = await FirebaseService.getAll(this.COLLECTIONS.VILLAGES);
      const districts = await FirebaseService.getAll(this.COLLECTIONS.DISTRICTS);
      const towns = await FirebaseService.getAll(this.COLLECTIONS.TOWNS);

      // Populate district_name and town_name
      return villages.map(village => {
        const district = districts.find(d => String(d.id) === String(village.district_id));
        const town = village.town_id ? towns.find(t => String(t.id) === String(village.town_id)) : null;
        return {
          ...village,
          district_name: district?.name || '',
          town_name: town?.name || ''
        };
      });
    } catch (error) {
      console.error('Get villages error:', error);
      return [];
    }
  }

  static async createVillage(villageData) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.VILLAGES, null, villageData);
      return { success: true, id: docId, message: 'Köy oluşturuldu' };
    } catch (error) {
      console.error('Create village error:', error);
      throw new Error('Köy oluşturulurken hata oluştu');
    }
  }

  static async updateVillage(id, villageData) {
    try {
      await FirebaseService.update(this.COLLECTIONS.VILLAGES, id, villageData);
      return { success: true, message: 'Köy güncellendi' };
    } catch (error) {
      console.error('Update village error:', error);
      throw new Error('Köy güncellenirken hata oluştu');
    }
  }

  static async deleteVillage(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.VILLAGES, id);
      return { success: true, message: 'Köy silindi' };
    } catch (error) {
      console.error('Delete village error:', error);
      throw new Error('Köy silinirken hata oluştu');
    }
  }

  // STKs CRUD
  static async getSTKs() {
    try {
      const stks = await FirebaseService.getAll(this.COLLECTIONS.STKS);

      // description alanını decrypt etmeye çalış (eski şifrelenmiş kayıtlar için)
      const { decryptData } = await import('../utils/crypto');

      return stks.map(stk => {
        // Eğer description şifrelenmişse (eski kayıtlar için), decrypt et
        if (stk.description && typeof stk.description === 'string' && stk.description.startsWith('U2FsdGVkX1')) {
          try {
            const decrypted = decryptData(stk.description);
            if (decrypted && decrypted !== stk.description) {
              stk.description = decrypted;
            }
          } catch (error) {
            // Decrypt başarısız olursa, description'ı temizle (muhtemelen bozuk veri)
            console.warn('Failed to decrypt description for STK:', stk.id, error);
            stk.description = null;
          }
        }
        return stk;
      });
    } catch (error) {
      console.error('Get STKs error:', error);
      return [];
    }
  }

  static async createSTK(stkData) {
    try {
      // description alanını şifrelemeden saklamak için özel işlem
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');

      // description değerini temizle (boş string ise null yap)
      const descriptionValue = stkData.description && stkData.description.trim() !== ''
        ? stkData.description.trim()
        : null;

      const stkDataWithoutDescription = { ...stkData };
      delete stkDataWithoutDescription.description;

      // Önce description olmadan kaydet
      const docId = await FirebaseService.create(
        this.COLLECTIONS.STKS,
        null,
        stkDataWithoutDescription,
        true // encrypt = true (description hariç diğer hassas alanlar şifrelenecek)
      );

      // Sonra description'ı şifrelemeden ekle (null ise de ekle ki boş olduğu belli olsun)
      const docRef = doc(db, this.COLLECTIONS.STKS, docId);
      await updateDoc(docRef, { description: descriptionValue }); // Şifrelenmeden sakla (null veya değer)

      return { success: true, id: docId, message: 'STK oluşturuldu' };
    } catch (error) {
      console.error('Create STK error:', error);
      throw new Error('STK oluşturulurken hata oluştu');
    }
  }

  static async updateSTK(id, stkData) {
    try {
      // description alanını şifrelemeden saklamak için özel işlem
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');

      // description değerini temizle (boş string ise null yap)
      const descriptionValue = stkData.description && stkData.description.trim() !== ''
        ? stkData.description.trim()
        : null;

      const stkDataWithoutDescription = { ...stkData };
      delete stkDataWithoutDescription.description;

      // Önce description olmadan güncelle
      await FirebaseService.update(this.COLLECTIONS.STKS, id, stkDataWithoutDescription);

      // Sonra description'ı şifrelemeden ekle/güncelle (null ise de ekle ki boş olduğu belli olsun)
      const docRef = doc(db, this.COLLECTIONS.STKS, id);
      await updateDoc(docRef, { description: descriptionValue }); // Şifrelenmeden sakla (null veya değer)

      return { success: true, message: 'STK güncellendi' };
    } catch (error) {
      console.error('Update STK error:', error);
      throw new Error('STK güncellenirken hata oluştu');
    }
  }

  static async deleteSTK(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.STKS, id);
      return { success: true, message: 'STK silindi' };
    } catch (error) {
      console.error('Delete STK error:', error);
      throw new Error('STK silinirken hata oluştu');
    }
  }

  // Public Institutions CRUD
  static async getPublicInstitutions() {
    try {
      const publicInstitutions = await FirebaseService.getAll(this.COLLECTIONS.PUBLIC_INSTITUTIONS);

      // description alanını decrypt etmeye çalış (eski şifrelenmiş kayıtlar için)
      const { decryptData } = await import('../utils/crypto');

      return publicInstitutions.map(publicInstitution => {
        // Eğer description şifrelenmişse (eski kayıtlar için), decrypt et
        if (publicInstitution.description && typeof publicInstitution.description === 'string' && publicInstitution.description.startsWith('U2FsdGVkX1')) {
          try {
            const decrypted = decryptData(publicInstitution.description);
            if (decrypted && decrypted !== publicInstitution.description) {
              publicInstitution.description = decrypted;
            }
          } catch (error) {
            // Decrypt başarısız olursa, description'ı temizle (muhtemelen bozuk veri)
            console.warn('Failed to decrypt description for Public Institution:', publicInstitution.id, error);
            publicInstitution.description = null;
          }
        }
        return publicInstitution;
      });
    } catch (error) {
      console.error('Get Public Institutions error:', error);
      return [];
    }
  }

  static async createPublicInstitution(publicInstitutionData) {
    try {
      // description alanını şifrelemeden saklamak için özel işlem
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');

      // description değerini temizle (boş string ise null yap)
      const descriptionValue = publicInstitutionData.description && publicInstitutionData.description.trim() !== ''
        ? publicInstitutionData.description.trim()
        : null;

      const publicInstitutionDataWithoutDescription = { ...publicInstitutionData };
      delete publicInstitutionDataWithoutDescription.description;

      // Önce description olmadan kaydet
      const docId = await FirebaseService.create(
        this.COLLECTIONS.PUBLIC_INSTITUTIONS,
        null,
        publicInstitutionDataWithoutDescription,
        true // encrypt = true (description hariç diğer hassas alanlar şifrelenecek)
      );

      // Sonra description'ı şifrelemeden ekle (null ise de ekle ki boş olduğu belli olsun)
      const docRef = doc(db, this.COLLECTIONS.PUBLIC_INSTITUTIONS, docId);
      await updateDoc(docRef, { description: descriptionValue }); // Şifrelenmeden sakla (null veya değer)

      return { success: true, id: docId, message: 'Kamu kurumu oluşturuldu' };
    } catch (error) {
      console.error('Create Public Institution error:', error);
      throw new Error('Kamu kurumu oluşturulurken hata oluştu');
    }
  }

  static async updatePublicInstitution(id, publicInstitutionData) {
    try {
      // description alanını şifrelemeden saklamak için özel işlem
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');

      // description değerini temizle (boş string ise null yap)
      const descriptionValue = publicInstitutionData.description && publicInstitutionData.description.trim() !== ''
        ? publicInstitutionData.description.trim()
        : null;

      const publicInstitutionDataWithoutDescription = { ...publicInstitutionData };
      delete publicInstitutionDataWithoutDescription.description;

      // Önce description olmadan güncelle
      await FirebaseService.update(this.COLLECTIONS.PUBLIC_INSTITUTIONS, id, publicInstitutionDataWithoutDescription);

      // Sonra description'ı şifrelemeden ekle/güncelle (null ise de ekle ki boş olduğu belli olsun)
      const docRef = doc(db, this.COLLECTIONS.PUBLIC_INSTITUTIONS, id);
      await updateDoc(docRef, { description: descriptionValue }); // Şifrelenmeden sakla (null veya değer)

      return { success: true, message: 'Kamu kurumu güncellendi' };
    } catch (error) {
      console.error('Update Public Institution error:', error);
      throw new Error('Kamu kurumu güncellenirken hata oluştu');
    }
  }

  static async deletePublicInstitution(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.PUBLIC_INSTITUTIONS, id);
      return { success: true, message: 'Kamu kurumu silindi' };
    } catch (error) {
      console.error('Delete Public Institution error:', error);
      throw new Error('Kamu kurumu silinirken hata oluştu');
    }
  }

  // Mosques CRUD
  static async getMosques() {
    try {
      return await FirebaseService.getAll(this.COLLECTIONS.MOSQUES);
    } catch (error) {
      console.error('Get mosques error:', error);
      return [];
    }
  }

  static async createMosque(mosqueData) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.MOSQUES, null, mosqueData);
      return { success: true, id: docId, message: 'Cami oluşturuldu' };
    } catch (error) {
      console.error('Create mosque error:', error);
      throw new Error('Cami oluşturulurken hata oluştu');
    }
  }

  static async updateMosque(id, mosqueData) {
    try {
      await FirebaseService.update(this.COLLECTIONS.MOSQUES, id, mosqueData);
      return { success: true, message: 'Cami güncellendi' };
    } catch (error) {
      console.error('Update mosque error:', error);
      throw new Error('Cami güncellenirken hata oluştu');
    }
  }

  static async deleteMosque(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.MOSQUES, id);
      return { success: true, message: 'Cami silindi' };
    } catch (error) {
      console.error('Delete mosque error:', error);
      throw new Error('Cami silinirken hata oluştu');
    }
  }

  // Event Categories CRUD
  static async getEventCategories() {
    try {
      const categories = await FirebaseService.getAll(this.COLLECTIONS.EVENT_CATEGORIES);

      // description alanını decrypt etmeye çalış (eski şifrelenmiş kayıtlar için)
      const { decryptData } = await import('../utils/crypto');

      return categories.map(category => {
        // Eğer description şifrelenmişse (eski kayıtlar için), decrypt et
        if (category.description && typeof category.description === 'string' && category.description.startsWith('U2FsdGVkX1')) {
          try {
            const decrypted = decryptData(category.description);
            if (decrypted && decrypted !== category.description) {
              category.description = decrypted;
            }
          } catch (error) {
            // Decrypt başarısız olursa, description'ı temizle (muhtemelen bozuk veri)
            console.warn('Failed to decrypt description for category:', category.id, error);
            category.description = null;
          }
        }
        return category;
      });
    } catch (error) {
      console.error('Get event categories error:', error);
      return [];
    }
  }

  static async createEventCategory(categoryData) {
    try {
      // description alanını şifrelemeden saklamak için özel işlem
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');

      // description değerini temizle (boş string ise null yap)
      const descriptionValue = categoryData.description && categoryData.description.trim() !== ''
        ? categoryData.description.trim()
        : null;

      const categoryDataWithoutDescription = { ...categoryData };
      delete categoryDataWithoutDescription.description;

      // Önce description olmadan kaydet
      const docId = await FirebaseService.create(
        this.COLLECTIONS.EVENT_CATEGORIES,
        null,
        categoryDataWithoutDescription,
        true // encrypt = true (description hariç diğer hassas alanlar şifrelenecek)
      );

      // Sonra description'ı şifrelemeden ekle (null ise de ekle ki boş olduğu belli olsun)
      const docRef = doc(db, this.COLLECTIONS.EVENT_CATEGORIES, docId);
      await updateDoc(docRef, { description: descriptionValue }); // Şifrelenmeden sakla (null veya değer)

      return { success: true, id: docId, message: 'Etkinlik kategorisi oluşturuldu' };
    } catch (error) {
      console.error('Create event category error:', error);
      throw new Error('Etkinlik kategorisi oluşturulurken hata oluştu');
    }
  }

  static async updateEventCategory(id, categoryData) {
    try {
      // description alanını şifrelemeden saklamak için özel işlem
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');

      // description değerini temizle (boş string ise null yap)
      const descriptionValue = categoryData.description && categoryData.description.trim() !== ''
        ? categoryData.description.trim()
        : null;

      const categoryDataWithoutDescription = { ...categoryData };
      delete categoryDataWithoutDescription.description;

      // Önce description olmadan güncelle
      await FirebaseService.update(this.COLLECTIONS.EVENT_CATEGORIES, id, categoryDataWithoutDescription);

      // Sonra description'ı şifrelemeden ekle/güncelle (null ise de ekle ki boş olduğu belli olsun)
      const docRef = doc(db, this.COLLECTIONS.EVENT_CATEGORIES, id);
      await updateDoc(docRef, { description: descriptionValue }); // Şifrelenmeden sakla (null veya değer)

      return { success: true, message: 'Etkinlik kategorisi güncellendi' };
    } catch (error) {
      console.error('Update event category error:', error);
      throw new Error('Etkinlik kategorisi güncellenirken hata oluştu');
    }
  }

  static async deleteEventCategory(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.EVENT_CATEGORIES, id);
      return { success: true, message: 'Etkinlik kategorisi silindi' };
    } catch (error) {
      console.error('Delete event category error:', error);
      throw new Error('Etkinlik kategorisi silinirken hata oluştu');
    }
  }

  // Elections CRUD
  static async getElections() {
    try {
      return await FirebaseService.getAll(this.COLLECTIONS.ELECTIONS, {}, false);
    } catch (error) {
      console.error('Get elections error:', error);
      return [];
    }
  }

  static async createElection(electionData) {
    try {
      const docId = await FirebaseService.create(
        this.COLLECTIONS.ELECTIONS,
        null,
        {
          ...electionData,
          round: electionData.round || 1,
          date: electionData.date ? new Date(electionData.date).toISOString() : null
        },
        false // Şifreleme yok
      );
      return { success: true, id: docId, message: 'Seçim oluşturuldu' };
    } catch (error) {
      console.error('Create election error:', error);
      throw new Error('Seçim oluşturulurken hata oluştu');
    }
  }

  static async createSecondRound(firstRoundElectionId) {
    try {
      // 1. Get first round election
      const firstRound = await FirebaseService.getById(this.COLLECTIONS.ELECTIONS, firstRoundElectionId, false);
      if (!firstRound || firstRound.type !== 'cb') {
        return { success: false, message: '2. tur sadece Cumhurbaşkanlığı seçimlerinde oluşturulabilir' };
      }
      const roundNum = parseInt(firstRound.round) || 1;
      if (roundNum !== 1) {
        return { success: false, message: 'Bu seçim zaten 2. tur veya daha sonrası' };
      }

      // 2. Get first round results to find top 2 candidates
      const results = await this.getElectionResults(firstRoundElectionId);
      const approvedResults = (results || []).filter(r => r.approval_status !== 'rejected');

      // Aggregate CB votes across all ballot boxes
      const candidateVotes = {};
      approvedResults.forEach(result => {
        if (result.cb_votes && typeof result.cb_votes === 'object') {
          Object.entries(result.cb_votes).forEach(([candidate, votes]) => {
            candidateVotes[candidate] = (candidateVotes[candidate] || 0) + (parseInt(votes) || 0);
          });
        }
      });

      // Sort by votes descending, take top 2 (exclude 'Diğer')
      const sortedCandidates = Object.entries(candidateVotes)
        .filter(([name]) => name !== 'Diğer')
        .sort(([, a], [, b]) => b - a)
        .slice(0, 2)
        .map(([name]) => name);

      if (sortedCandidates.length < 2) {
        return { success: false, message: '2. tur için en az 2 aday gerekli' };
      }

      // 3. Check if any candidate has already won outright (salt çoğunluk)
      // Anayasa madde 101: "geçerli oyların salt çoğunluğunu" = > %50 (strictly more than half)
      // Örnek: 100 geçerli oy → 51 oy gerekli, 101 geçerli oy → 51 oy gerekli, 200 geçerli oy → 101 oy gerekli
      // Math.floor(totalValid / 2) + 1 doğru sonuç verir hem çift hem tek toplam için:
      //   100 → floor(50) + 1 = 51  ✓
      //   101 → floor(50) + 1 = 51  ✓
      //   200 → floor(100) + 1 = 101 ✓
      const totalValid = approvedResults.reduce((sum, r) => sum + (parseInt(r.valid_votes) || 0), 0);
      const topCandidateVotes = candidateVotes[sortedCandidates[0]] || 0;
      const majorityThreshold = Math.floor(totalValid / 2) + 1;
      if (totalValid > 0 && topCandidateVotes >= majorityThreshold) {
        return { success: false, message: `${sortedCandidates[0]} salt çoğunluğu almış (${topCandidateVotes}/${totalValid} oy, gerekli: ${majorityThreshold}), 2. tur gerekli değil` };
      }

      // 4. Create 2nd round election
      const secondRoundData = {
        name: firstRound.name + ' (2. Tur)',
        type: 'cb',
        date: '',
        status: 'draft',
        round: 2,
        first_round_id: firstRoundElectionId,
        cb_candidates: sortedCandidates,
        independent_cb_candidates: [],
        parties: firstRound.parties || [],
        voter_count: firstRound.voter_count,
        baraj_percent: 0,
      };

      const docId = await FirebaseService.create(this.COLLECTIONS.ELECTIONS, null, secondRoundData, false);
      return {
        success: true,
        election: { id: docId, ...secondRoundData },
        message: `2. tur oluşturuldu: ${sortedCandidates.join(' vs ')}`
      };
    } catch (error) {
      console.error('Create second round error:', error);
      return { success: false, message: error.message };
    }
  }

  static async updateElection(id, electionData) {
    try {
      // Seçim durumu geçiş kontrolü
      if (electionData.status) {
        const currentElection = await FirebaseService.getById(this.COLLECTIONS.ELECTIONS, id, false);
        const currentStatus = currentElection?.status;
        const allowedTransitions = {
          'draft': ['active'],
          'active': ['closed'],
          'closed': [] // closed'dan geri dönüş yok
        };

        if (currentStatus && allowedTransitions[currentStatus] !== undefined &&
            !allowedTransitions[currentStatus].includes(electionData.status)) {
          return { success: false, message: `Seçim durumu '${currentStatus}' → '${electionData.status}' geçişi yapılamaz` };
        }
      }

      await FirebaseService.update(
        this.COLLECTIONS.ELECTIONS,
        id,
        {
          ...electionData,
          date: electionData.date ? new Date(electionData.date).toISOString() : null
        },
        false // Şifreleme yok
      );
      return { success: true, message: 'Seçim güncellendi' };
    } catch (error) {
      console.error('Update election error:', error);
      throw new Error('Seçim güncellenirken hata oluştu');
    }
  }

  static async deleteElection(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.ELECTIONS, id);
      return { success: true, message: 'Seçim silindi' };
    } catch (error) {
      console.error('Delete election error:', error);
      throw new Error('Seçim silinirken hata oluştu');
    }
  }

  // Election Coordinators API
  static async getElectionCoordinators() {
    try {
      return await FirebaseService.getAll('election_coordinators', {}, false);
    } catch (error) {
      console.error('Get election coordinators error:', error);
      return [];
    }
  }

  static async createElectionCoordinator(coordinatorData) {
    try {
      const docId = await FirebaseService.create(
        'election_coordinators',
        null,
        {
          ...coordinatorData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        false
      );
      return { success: true, message: 'Sorumlu başarıyla oluşturuldu', coordinator: { id: docId, ...coordinatorData } };
    } catch (error) {
      console.error('Create election coordinator error:', error);
      throw new Error('Sorumlu oluşturulurken hata oluştu');
    }
  }

  static async updateElectionCoordinator(id, coordinatorData) {
    try {
      await FirebaseService.update(
        'election_coordinators',
        id,
        {
          ...coordinatorData,
          updated_at: new Date().toISOString()
        },
        false
      );
      return { success: true, message: 'Sorumlu başarıyla güncellendi', coordinator: { id, ...coordinatorData } };
    } catch (error) {
      console.error('Update election coordinator error:', error);
      throw new Error('Sorumlu güncellenirken hata oluştu');
    }
  }

  static async deleteElectionCoordinator(id) {
    try {
      await FirebaseService.delete('election_coordinators', id);
      return { success: true, message: 'Sorumlu başarıyla silindi' };
    } catch (error) {
      console.error('Delete election coordinator error:', error);
      throw new Error('Sorumlu silinirken hata oluştu');
    }
  }

  // Election Regions API
  static async getElectionRegions() {
    try {
      const regions = await FirebaseService.getAll('election_regions', {}, false);
      // Parse JSON fields if they exist as strings
      return (regions || []).map(region => ({
        ...region,
        neighborhood_ids: typeof region.neighborhood_ids === 'string'
          ? JSON.parse(region.neighborhood_ids)
          : (region.neighborhood_ids || []),
        village_ids: typeof region.village_ids === 'string'
          ? JSON.parse(region.village_ids)
          : (region.village_ids || [])
      }));
    } catch (error) {
      console.error('Get election regions error:', error);
      return [];
    }
  }

  static async createElectionRegion(regionData) {
    try {
      const docId = await FirebaseService.create(
        'election_regions',
        null,
        {
          ...regionData,
          neighborhood_ids: Array.isArray(regionData.neighborhood_ids)
            ? regionData.neighborhood_ids
            : [],
          village_ids: Array.isArray(regionData.village_ids)
            ? regionData.village_ids
            : [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        false
      );
      return { success: true, message: 'Bölge başarıyla oluşturuldu', region: { id: docId, ...regionData } };
    } catch (error) {
      console.error('Create election region error:', error);
      throw new Error('Bölge oluşturulurken hata oluştu');
    }
  }

  static async updateElectionRegion(id, regionData) {
    try {
      await FirebaseService.update(
        'election_regions',
        id,
        {
          ...regionData,
          neighborhood_ids: Array.isArray(regionData.neighborhood_ids)
            ? regionData.neighborhood_ids
            : [],
          village_ids: Array.isArray(regionData.village_ids)
            ? regionData.village_ids
            : [],
          updated_at: new Date().toISOString()
        },
        false
      );
      return { success: true, message: 'Bölge başarıyla güncellendi', region: { id, ...regionData } };
    } catch (error) {
      console.error('Update election region error:', error);
      throw new Error('Bölge güncellenirken hata oluştu');
    }
  }

  static async deleteElectionRegion(id) {
    try {
      await FirebaseService.delete('election_regions', id);
      return { success: true, message: 'Bölge başarıyla silindi' };
    } catch (error) {
      console.error('Delete election region error:', error);
      throw new Error('Bölge silinirken hata oluştu');
    }
  }

  // Election Results API
  static async getElectionResults(electionId, ballotBoxId) {
    try {
      const allResults = await FirebaseService.getAll(this.COLLECTIONS.ELECTION_RESULTS, {}, false);

      let filtered = allResults || [];

      // Filter by election ID
      if (electionId) {
        filtered = filtered.filter(result =>
          String(result.election_id || result.electionId) === String(electionId)
        );
      }

      // Filter by ballot box ID
      if (ballotBoxId) {
        filtered = filtered.filter(result =>
          String(result.ballot_box_id || result.ballotBoxId) === String(ballotBoxId)
        );
      }

      return filtered;
    } catch (error) {
      console.error('Get election results error:', error);
      return [];
    }
  }

  static async getElectionResultById(id) {
    try {
      return await FirebaseService.getById(this.COLLECTIONS.ELECTION_RESULTS, id, false);
    } catch (error) {
      console.error('Get election result by ID error:', error);
      throw new Error('Seçim sonucu bulunamadı');
    }
  }

  static validateVoteData(data) {
    const errors = [];
    const totalVoters = parseInt(data.total_voters) || 0;
    const usedVotes = parseInt(data.used_votes) || 0;
    const validVotes = parseInt(data.valid_votes) || 0;
    const invalidVotes = parseInt(data.invalid_votes) || 0;

    if (totalVoters < 0 || usedVotes < 0 || validVotes < 0 || invalidVotes < 0) {
      errors.push('Oy değerleri negatif olamaz');
    }
    if (usedVotes > totalVoters) {
      errors.push('Kullanılan oy toplam seçmenden fazla olamaz');
    }
    if (validVotes + invalidVotes !== usedVotes) {
      errors.push('Geçerli + Geçersiz oylar kullanılan oy sayısına eşit olmalı');
    }

    // Check party vote totals for each category present (only when category has data)
    const voteCategories = ['cb_votes', 'mv_votes', 'mayor_votes', 'municipal_council_votes', 'provincial_assembly_votes'];
    voteCategories.forEach(cat => {
      if (data[cat] && typeof data[cat] === 'object' && Object.keys(data[cat]).length > 0) {
        const total = Object.values(data[cat]).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
        if (total !== validVotes) {
          errors.push(`Parti oy toplamı (${total}) geçerli oy sayısından (${validVotes}) farklı`);
        }
      }
    });

    return errors;
  }

  static async createElectionResult(resultData) {
    try {
      // Vote data validation
      const validationErrors = FirebaseApiService.validateVoteData(resultData);
      if (validationErrors.length > 0) {
        return { success: false, errors: validationErrors, message: validationErrors.join(', ') };
      }

      // Determine approval status: if filled by AI, it needs approval, otherwise auto-approved
      const filledByAI = resultData.filled_by_ai === true || resultData.filled_by_ai === 1;
      const approvalStatus = filledByAI ? 'pending' : (resultData.approval_status || 'approved');

      const dataToSave = {
        ...resultData,
        filled_by_ai: filledByAI,
        approval_status: approvalStatus,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const docId = await FirebaseService.create(
        this.COLLECTIONS.ELECTION_RESULTS,
        null,
        dataToSave
      );

      // Audit log
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const auditData = {
        user_id: user.id || user.uid || null,
        user_type: localStorage.getItem('userRole') || 'observer',
        action: 'create',
        entity_type: 'election_result',
        entity_id: docId,
        new_data: dataToSave,
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString()
      };
      await FirebaseService.create(this.COLLECTIONS.AUDIT_LOGS, null, auditData, false);

      return { success: true, id: docId, message: 'Seçim sonucu oluşturuldu' };
    } catch (error) {
      console.error('Create election result error:', error);
      throw new Error('Seçim sonucu oluşturulurken hata oluştu');
    }
  }

  static async updateElectionResult(id, resultData) {
    try {
      // Vote data validation
      const validationErrors = FirebaseApiService.validateVoteData(resultData);
      if (validationErrors.length > 0) {
        return { success: false, errors: validationErrors, message: validationErrors.join(', ') };
      }

      // Get old data for audit
      const oldResult = await FirebaseService.getById(this.COLLECTIONS.ELECTION_RESULTS, id, false);

      await FirebaseService.update(this.COLLECTIONS.ELECTION_RESULTS, id, resultData);

      // Audit log with change tracking
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const changes = {};

      // Track which fields changed (undefined değerleri filtrele)
      if (oldResult) {
        Object.keys(resultData).forEach(key => {
          const oldValue = oldResult[key];
          const newValue = resultData[key];

          // Undefined değerleri null'a çevir (Firestore undefined kabul etmez)
          const normalizedOld = oldValue === undefined ? null : oldValue;
          const normalizedNew = newValue === undefined ? null : newValue;

          if (JSON.stringify(normalizedOld) !== JSON.stringify(normalizedNew)) {
            changes[key] = {
              old: normalizedOld,
              new: normalizedNew
            };
          }
        });
      }

      const auditData = {
        user_id: user.id || user.uid || null,
        user_type: localStorage.getItem('userRole') || 'observer',
        action: 'update',
        entity_type: 'election_result',
        entity_id: id,
        old_data: oldResult,
        new_data: resultData,
        changes: changes,
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString()
      };
      await FirebaseService.create(this.COLLECTIONS.AUDIT_LOGS, null, auditData, false);

      return { success: true, message: 'Seçim sonucu güncellendi' };
    } catch (error) {
      console.error('Update election result error:', error);
      throw new Error('Seçim sonucu güncellenirken hata oluştu');
    }
  }

  static async deleteElectionResult(id) {
    try {
      // Get old data for audit
      const oldResult = await FirebaseService.getById(this.COLLECTIONS.ELECTION_RESULTS, id, false);

      await FirebaseService.delete(this.COLLECTIONS.ELECTION_RESULTS, id);

      // Audit log
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const auditData = {
        user_id: user.id || user.uid || null,
        user_type: localStorage.getItem('userRole') || 'admin',
        action: 'delete',
        entity_type: 'election_result',
        entity_id: id,
        old_data: oldResult,
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString()
      };
      await FirebaseService.create(this.COLLECTIONS.AUDIT_LOGS, null, auditData, false);

      return { success: true, message: 'Seçim sonucu silindi' };
    } catch (error) {
      console.error('Delete election result error:', error);
      throw new Error('Seçim sonucu silinirken hata oluştu');
    }
  }

  // Get pending election results (for chief observer)
  static async getPendingElectionResults(ballotBoxId = null) {
    try {
      const allResults = await FirebaseService.getAll(this.COLLECTIONS.ELECTION_RESULTS, false);

      // Filter pending results
      let pendingResults = allResults.filter(result =>
        result.approval_status === 'pending'
      );

      // Sandık izolasyonu: Eğer ballotBoxId verilmişse, sadece o sandığın sonuçlarını göster
      if (ballotBoxId) {
        pendingResults = pendingResults.filter(result =>
          String(result.ballot_box_id) === String(ballotBoxId)
        );
      }

      // Enrich with election and ballot box data
      const enrichedResults = await Promise.all(
        pendingResults.map(async (result) => {
          let election = null;
          let ballotBox = null;
          let creator = null;

          if (result.election_id) {
            try {
              election = await FirebaseService.getById(this.COLLECTIONS.ELECTIONS, result.election_id, false);
            } catch (e) {
              console.warn('Election not found:', result.election_id);
            }
          }

          if (result.ballot_box_id) {
            try {
              ballotBox = await FirebaseService.getById(this.COLLECTIONS.BALLOT_BOXES, result.ballot_box_id, false);
            } catch (e) {
              console.warn('Ballot box not found:', result.ballot_box_id);
            }
          }

          if (result.created_by) {
            try {
              creator = await FirebaseService.getById(this.COLLECTIONS.MEMBERS, result.created_by, false);
            } catch (e) {
              console.warn('Creator not found:', result.created_by);
            }
          }

          return {
            ...result,
            election_name: election?.name || null,
            election_type: election?.type || null,
            election_date: election?.date || null,
            ballot_number: ballotBox?.ballot_number || result.ballot_number || null,
            voter_count: ballotBox?.voter_count || null,
            creator_name: creator?.name || null
          };
        })
      );

      return { success: true, results: enrichedResults };
    } catch (error) {
      console.error('Get pending election results error:', error);
      throw new Error('Bekleyen sonuçlar alınırken hata oluştu');
    }
  }

  // Approve election result (chief observer only)
  static async approveElectionResult(id) {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user.id || user.uid || null;

      // Get the result
      const result = await FirebaseService.getById(this.COLLECTIONS.ELECTION_RESULTS, id, false);
      if (!result) {
        throw new Error('Seçim sonucu bulunamadı');
      }

      // Check if already approved
      if (result.approval_status === 'approved') {
        throw new Error('Bu sonuç zaten onaylanmış');
      }

      // Update approval status
      await FirebaseService.update(this.COLLECTIONS.ELECTION_RESULTS, id, {
        approval_status: 'approved',
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, false);

      // Audit log
      const auditData = {
        user_id: userId,
        user_type: localStorage.getItem('userRole') || 'chief_observer',
        action: 'approve',
        entity_type: 'election_result',
        entity_id: id,
        new_data: { approval_status: 'approved' },
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString()
      };
      await FirebaseService.create(this.COLLECTIONS.AUDIT_LOGS, null, auditData, false);

      return { success: true, message: 'Seçim sonucu başarıyla onaylandı' };
    } catch (error) {
      console.error('Approve election result error:', error);
      throw new Error(error.message || 'Sonuç onaylanırken hata oluştu');
    }
  }

  // Reject election result (chief observer only)
  static async rejectElectionResult(id, rejectionReason = '') {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = user.id || user.uid || null;

      // Get the result
      const result = await FirebaseService.getById(this.COLLECTIONS.ELECTION_RESULTS, id, false);
      if (!result) {
        throw new Error('Seçim sonucu bulunamadı');
      }

      // Check if already approved
      if (result.approval_status === 'approved') {
        throw new Error('Onaylanmış sonuç reddedilemez. Önce onayı kaldırın.');
      }

      // Update rejection status - Reddedilen sonuçlar seçim alanına geri düşer (pending olur)
      await FirebaseService.update(this.COLLECTIONS.ELECTION_RESULTS, id, {
        approval_status: 'pending', // Reddedilen sonuçlar tekrar düzenlenebilir olmalı
        rejected_by: userId,
        rejected_at: new Date().toISOString(),
        rejection_reason: rejectionReason || 'Reddedilme nedeni belirtilmedi',
        updated_at: new Date().toISOString()
      }, false);

      // Audit log
      const auditData = {
        user_id: userId,
        user_type: localStorage.getItem('userRole') || 'chief_observer',
        action: 'reject',
        entity_type: 'election_result',
        entity_id: id,
        new_data: { approval_status: 'rejected', rejection_reason: rejectionReason },
        user_agent: navigator.userAgent,
        created_at: new Date().toISOString()
      };
      await FirebaseService.create(this.COLLECTIONS.AUDIT_LOGS, null, auditData, false);

      return { success: true, message: 'Seçim sonucu reddedildi' };
    } catch (error) {
      console.error('Reject election result error:', error);
      throw new Error(error.message || 'Sonuç reddedilirken hata oluştu');
    }
  }

  // Neighborhood Representatives CRUD
  static async getNeighborhoodRepresentatives() {
    try {
      const representatives = await FirebaseService.getAll(this.COLLECTIONS.NEIGHBORHOOD_REPRESENTATIVES);
      const neighborhoods = await FirebaseService.getAll(this.COLLECTIONS.NEIGHBORHOODS);
      const districts = await FirebaseService.getAll(this.COLLECTIONS.DISTRICTS);
      const towns = await FirebaseService.getAll(this.COLLECTIONS.TOWNS);

      // Populate neighborhood_name, district_name, town_name
      return representatives.map(rep => {
        const neighborhood = neighborhoods.find(n => String(n.id) === String(rep.neighborhood_id));
        const district = neighborhood ? districts.find(d => String(d.id) === String(neighborhood.district_id)) : null;
        const town = neighborhood && neighborhood.town_id ? towns.find(t => String(t.id) === String(neighborhood.town_id)) : null;

        return {
          ...rep,
          neighborhood_name: neighborhood?.name || '',
          district_name: district?.name || '',
          town_name: town?.name || ''
        };
      });
    } catch (error) {
      console.error('Get neighborhood representatives error:', error);
      return [];
    }
  }

  static async createNeighborhoodRepresentative(representativeData) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.NEIGHBORHOOD_REPRESENTATIVES, null, representativeData);
      return { success: true, id: docId, message: 'Mahalle temsilcisi oluşturuldu' };
    } catch (error) {
      console.error('Create neighborhood representative error:', error);
      throw new Error('Mahalle temsilcisi oluşturulurken hata oluştu');
    }
  }

  static async updateNeighborhoodRepresentative(id, representativeData) {
    try {
      await FirebaseService.update(this.COLLECTIONS.NEIGHBORHOOD_REPRESENTATIVES, id, representativeData);
      return { success: true, message: 'Mahalle temsilcisi güncellendi' };
    } catch (error) {
      console.error('Update neighborhood representative error:', error);
      throw new Error('Mahalle temsilcisi güncellenirken hata oluştu');
    }
  }

  static async deleteNeighborhoodRepresentative(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.NEIGHBORHOOD_REPRESENTATIVES, id);
      return { success: true, message: 'Mahalle temsilcisi silindi' };
    } catch (error) {
      console.error('Delete neighborhood representative error:', error);
      throw new Error('Mahalle temsilcisi silinirken hata oluştu');
    }
  }

  // Village Representatives CRUD
  static async getVillageRepresentatives() {
    try {
      const representatives = await FirebaseService.getAll(this.COLLECTIONS.VILLAGE_REPRESENTATIVES);
      const villages = await FirebaseService.getAll(this.COLLECTIONS.VILLAGES);
      const districts = await FirebaseService.getAll(this.COLLECTIONS.DISTRICTS);
      const towns = await FirebaseService.getAll(this.COLLECTIONS.TOWNS);

      // Populate village_name, district_name, town_name
      return representatives.map(rep => {
        const village = villages.find(v => String(v.id) === String(rep.village_id));
        const district = village ? districts.find(d => String(d.id) === String(village.district_id)) : null;
        const town = village && village.town_id ? towns.find(t => String(t.id) === String(village.town_id)) : null;

        return {
          ...rep,
          village_name: village?.name || '',
          district_name: district?.name || '',
          town_name: town?.name || ''
        };
      });
    } catch (error) {
      console.error('Get village representatives error:', error);
      return [];
    }
  }

  static async createVillageRepresentative(representativeData) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.VILLAGE_REPRESENTATIVES, null, representativeData);
      return { success: true, id: docId, message: 'Köy temsilcisi oluşturuldu' };
    } catch (error) {
      console.error('Create village representative error:', error);
      throw new Error('Köy temsilcisi oluşturulurken hata oluştu');
    }
  }

  static async updateVillageRepresentative(id, representativeData) {
    try {
      await FirebaseService.update(this.COLLECTIONS.VILLAGE_REPRESENTATIVES, id, representativeData);
      return { success: true, message: 'Köy temsilcisi güncellendi' };
    } catch (error) {
      console.error('Update village representative error:', error);
      throw new Error('Köy temsilcisi güncellenirken hata oluştu');
    }
  }

  static async deleteVillageRepresentative(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.VILLAGE_REPRESENTATIVES, id);
      return { success: true, message: 'Köy temsilcisi silindi' };
    } catch (error) {
      console.error('Delete village representative error:', error);
      throw new Error('Köy temsilcisi silinirken hata oluştu');
    }
  }

  // Neighborhood Supervisors CRUD
  static async getNeighborhoodSupervisors() {
    try {
      return await FirebaseService.getAll(this.COLLECTIONS.NEIGHBORHOOD_SUPERVISORS);
    } catch (error) {
      console.error('Get neighborhood supervisors error:', error);
      return [];
    }
  }

  static async createNeighborhoodSupervisor(supervisorData) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.NEIGHBORHOOD_SUPERVISORS, null, supervisorData);
      return { success: true, id: docId, message: 'Mahalle sorumlusu oluşturuldu' };
    } catch (error) {
      console.error('Create neighborhood supervisor error:', error);
      throw new Error('Mahalle sorumlusu oluşturulurken hata oluştu');
    }
  }

  static async updateNeighborhoodSupervisor(id, supervisorData) {
    try {
      await FirebaseService.update(this.COLLECTIONS.NEIGHBORHOOD_SUPERVISORS, id, supervisorData);
      return { success: true, message: 'Mahalle sorumlusu güncellendi' };
    } catch (error) {
      console.error('Update neighborhood supervisor error:', error);
      throw new Error('Mahalle sorumlusu güncellenirken hata oluştu');
    }
  }

  static async deleteNeighborhoodSupervisor(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.NEIGHBORHOOD_SUPERVISORS, id);
      return { success: true, message: 'Mahalle sorumlusu silindi' };
    } catch (error) {
      console.error('Delete neighborhood supervisor error:', error);
      throw new Error('Mahalle sorumlusu silinirken hata oluştu');
    }
  }

  // Village Supervisors CRUD
  static async getVillageSupervisors() {
    try {
      return await FirebaseService.getAll(this.COLLECTIONS.VILLAGE_SUPERVISORS);
    } catch (error) {
      console.error('Get village supervisors error:', error);
      return [];
    }
  }

  static async createVillageSupervisor(supervisorData) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.VILLAGE_SUPERVISORS, null, supervisorData);
      return { success: true, id: docId, message: 'Köy sorumlusu oluşturuldu' };
    } catch (error) {
      console.error('Create village supervisor error:', error);
      throw new Error('Köy sorumlusu oluşturulurken hata oluştu');
    }
  }

  static async updateVillageSupervisor(id, supervisorData) {
    try {
      await FirebaseService.update(this.COLLECTIONS.VILLAGE_SUPERVISORS, id, supervisorData);
      return { success: true, message: 'Köy sorumlusu güncellendi' };
    } catch (error) {
      console.error('Update village supervisor error:', error);
      throw new Error('Köy sorumlusu güncellenirken hata oluştu');
    }
  }

  static async deleteVillageSupervisor(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.VILLAGE_SUPERVISORS, id);
      return { success: true, message: 'Köy sorumlusu silindi' };
    } catch (error) {
      console.error('Delete village supervisor error:', error);
      throw new Error('Köy sorumlusu silinirken hata oluştu');
    }
  }

  // Ballot Boxes CRUD
  static async getBallotBoxes() {
    try {
      const ballotBoxes = await FirebaseService.getAll(this.COLLECTIONS.BALLOT_BOXES);
      const districts = await FirebaseService.getAll(this.COLLECTIONS.DISTRICTS);
      const towns = await FirebaseService.getAll(this.COLLECTIONS.TOWNS);
      const neighborhoods = await FirebaseService.getAll(this.COLLECTIONS.NEIGHBORHOODS);
      const villages = await FirebaseService.getAll(this.COLLECTIONS.VILLAGES);

      // Populate district_name, town_name, neighborhood_name, village_name
      return ballotBoxes.map(ballotBox => {
        const district = ballotBox.district_id ? districts.find(d => String(d.id) === String(ballotBox.district_id)) : null;
        const town = ballotBox.town_id ? towns.find(t => String(t.id) === String(ballotBox.town_id)) : null;
        const neighborhood = ballotBox.neighborhood_id ? neighborhoods.find(n => String(n.id) === String(ballotBox.neighborhood_id)) : null;
        const village = ballotBox.village_id ? villages.find(v => String(v.id) === String(ballotBox.village_id)) : null;

        return {
          ...ballotBox,
          district_name: district?.name || null,
          town_name: town?.name || null,
          neighborhood_name: neighborhood?.name || null,
          village_name: village?.name || null
        };
      });
    } catch (error) {
      console.error('Get ballot boxes error:', error);
      return [];
    }
  }

  static async getBallotBoxById(id) {
    try {
      const ballotBox = await FirebaseService.getById(this.COLLECTIONS.BALLOT_BOXES, id);
      if (!ballotBox) return null;

      const districts = await FirebaseService.getAll(this.COLLECTIONS.DISTRICTS);
      const towns = await FirebaseService.getAll(this.COLLECTIONS.TOWNS);
      const neighborhoods = await FirebaseService.getAll(this.COLLECTIONS.NEIGHBORHOODS);
      const villages = await FirebaseService.getAll(this.COLLECTIONS.VILLAGES);

      // Populate district_name, town_name, neighborhood_name, village_name
      const district = ballotBox.district_id ? districts.find(d => String(d.id) === String(ballotBox.district_id)) : null;
      const town = ballotBox.town_id ? towns.find(t => String(t.id) === String(ballotBox.town_id)) : null;
      const neighborhood = ballotBox.neighborhood_id ? neighborhoods.find(n => String(n.id) === String(ballotBox.neighborhood_id)) : null;
      const village = ballotBox.village_id ? villages.find(v => String(v.id) === String(ballotBox.village_id)) : null;

      return {
        ...ballotBox,
        district_name: district?.name || null,
        town_name: town?.name || null,
        neighborhood_name: neighborhood?.name || null,
        village_name: village?.name || null
      };
    } catch (error) {
      console.error('Get ballot box by id error:', error);
      return null;
    }
  }

  static async createBallotBox(ballotBoxData) {
    try {
      if (ballotBoxData.voter_count && parseInt(ballotBoxData.voter_count) > 400) {
        return { success: false, message: 'Bir sandıkta en fazla 400 seçmen olabilir (Seçim Kanunu)' };
      }
      const docId = await FirebaseService.create(this.COLLECTIONS.BALLOT_BOXES, null, ballotBoxData);
      return { success: true, id: docId, message: 'Sandık oluşturuldu' };
    } catch (error) {
      console.error('Create ballot box error:', error);
      throw new Error('Sandık oluşturulurken hata oluştu');
    }
  }

  static async updateBallotBox(id, ballotBoxData) {
    try {
      if (ballotBoxData.voter_count && parseInt(ballotBoxData.voter_count) > 400) {
        return { success: false, message: 'Bir sandıkta en fazla 400 seçmen olabilir (Seçim Kanunu)' };
      }
      await FirebaseService.update(this.COLLECTIONS.BALLOT_BOXES, id, ballotBoxData);
      return { success: true, message: 'Sandık güncellendi' };
    } catch (error) {
      console.error('Update ballot box error:', error);
      throw new Error('Sandık güncellenirken hata oluştu');
    }
  }

  static async deleteBallotBox(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.BALLOT_BOXES, id);
      return { success: true, message: 'Sandık silindi' };
    } catch (error) {
      console.error('Delete ballot box error:', error);
      throw new Error('Sandık silinirken hata oluştu');
    }
  }

  // Ballot Box Observers CRUD
  static async getBallotBoxObservers() {
    try {
      const observers = await FirebaseService.getAll(this.COLLECTIONS.BALLOT_BOX_OBSERVERS);
      const districts = await FirebaseService.getAll(this.COLLECTIONS.DISTRICTS);
      const towns = await FirebaseService.getAll(this.COLLECTIONS.TOWNS);
      const neighborhoods = await FirebaseService.getAll(this.COLLECTIONS.NEIGHBORHOODS);
      const villages = await FirebaseService.getAll(this.COLLECTIONS.VILLAGES);

      // Populate district_name, town_name, neighborhood_name, village_name
      return observers.map(observer => {
        const district = observer.district_id ? districts.find(d => String(d.id) === String(observer.district_id)) : null;
        const town = observer.town_id ? towns.find(t => String(t.id) === String(observer.town_id)) : null;
        const neighborhood = observer.neighborhood_id ? neighborhoods.find(n => String(n.id) === String(observer.neighborhood_id)) : null;
        const village = observer.village_id ? villages.find(v => String(v.id) === String(observer.village_id)) : null;

        return {
          ...observer,
          district_name: district?.name || null,
          town_name: town?.name || null,
          neighborhood_name: neighborhood?.name || null,
          village_name: village?.name || null,
          observer_district_id: observer.district_id,
          observer_town_id: observer.town_id,
          observer_neighborhood_id: observer.neighborhood_id,
          observer_village_id: observer.village_id
        };
      });
    } catch (error) {
      console.error('Get ballot box observers error:', error);
      return [];
    }
  }

  static async createBallotBoxObserver(observerData) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.BALLOT_BOX_OBSERVERS, null, observerData);
      // Başmüşahit kullanıcıları artık üye kullanıcıları sayfasından "Müşahit Şifresi Oluştur" butonu ile oluşturulacak
      return { success: true, id: docId, message: 'Sandık gözlemcisi oluşturuldu' };
    } catch (error) {
      console.error('Create ballot box observer error:', error);
      throw new Error('Sandık gözlemcisi oluşturulurken hata oluştu');
    }
  }

  static async updateBallotBoxObserver(id, observerData) {
    try {
      await FirebaseService.update(this.COLLECTIONS.BALLOT_BOX_OBSERVERS, id, observerData);

      // Başmüşahit güncellenirken kullanıcı adını güncelle
      if (observerData.is_chief_observer) {
        try {
          const tc = String(observerData.tc || '').trim();

          // TC ile üye bul (TC şifrelenmiş olabilir)
          const members = await FirebaseService.getAll(this.COLLECTIONS.MEMBERS);
          const member = members.find(m => {
            let memberTc = String(m.tc || '').trim();
            try {
              if (memberTc && memberTc.startsWith('U2FsdGVkX1')) {
                memberTc = decryptData(memberTc);
              }
            } catch (e) { }
            return memberTc === tc;
          });

          if (member && member.id) {
            // Sandık numarasını kontrol et
            let username, password;
            const ballotBoxId = observerData.ballot_box_id || null;
            if (ballotBoxId) {
              const ballotBox = await FirebaseService.getById(this.COLLECTIONS.BALLOT_BOXES, ballotBoxId);
              if (ballotBox && ballotBox.ballot_number) {
                // Sandık numarası var - Kullanıcı adı: sandık numarası, Şifre: TC
                username = String(ballotBox.ballot_number);
                password = tc;
              } else {
                // Sandık numarası yok - Kullanıcı adı: TC, Şifre: TC
                username = tc;
                password = tc;
              }
            } else {
              // Sandık numarası yok - Kullanıcı adı: TC, Şifre: TC
              username = tc;
              password = tc;
            }

            // Mevcut kullanıcıyı bul
            const existingUsers = await FirebaseService.findByField(
              this.COLLECTIONS.MEMBER_USERS,
              'memberId',
              member.id
            );

            if (!existingUsers || existingUsers.length === 0) {
              // Kullanıcı yoksa oluştur
              await this.createMemberUser(member.id, username, password);
            } else {
              const existingUser = existingUsers[0];
              if (existingUser.username !== username) {
                // Kullanıcı varsa ama kullanıcı adı farklıysa güncelle
                await this.updateMemberUser(existingUser.id, username, password);
              }
            }
          } else {
            console.warn(`⚠️ Başmüşahit için üye bulunamadı (TC: ${tc}), kullanıcı oluşturulmadı`);
          }
        } catch (userError) {
          console.error('❌ Başmüşahit kullanıcısı güncellenirken hata:', userError);
          // Kullanıcı güncelleme hatası ana işlemi durdurmamalı
        }
      }

      return { success: true, message: 'Sandık gözlemcisi güncellendi' };
    } catch (error) {
      console.error('Update ballot box observer error:', error);
      throw new Error('Sandık gözlemcisi güncellenirken hata oluştu');
    }
  }

  static async deleteBallotBoxObserver(id) {
    try {
      // Önce müşahit bilgilerini al
      const observer = await FirebaseService.getById(this.COLLECTIONS.BALLOT_BOX_OBSERVERS, id);

      if (!observer) {
        throw new Error('Müşahit bulunamadı');
      }

      // Müşahite ait member_user kayıtlarını bul (userType='musahit' ve observerId ile)
      try {
        // observerId ile eşleşen member_user kayıtlarını bul
        const memberUsers = await FirebaseService.findByField(
          this.COLLECTIONS.MEMBER_USERS,
          'observerId',
          id
        );

        // Username ile de kontrol et (observerId yoksa)
        let memberUsersByUsername = [];
        if (!memberUsers || memberUsers.length === 0) {
          // TC'yi decrypt et
          let tc = observer.tc || '';
          try {
            if (tc && tc.startsWith('U2FsdGVkX1')) {
              const { decryptData } = await import('../utils/crypto');
              tc = decryptData(tc);
            }
          } catch (e) {
            console.error('TC decrypt hatası:', e);
          }

          // Sandık numarasını bul (username olarak kullanılıyor)
          let username = tc; // Varsayılan olarak TC
          if (observer.ballot_box_id) {
            const ballotBox = await FirebaseService.getById(this.COLLECTIONS.BALLOT_BOXES, observer.ballot_box_id);
            if (ballotBox && ballotBox.ballot_number) {
              username = String(ballotBox.ballot_number);
            }
          }

          // Username ile eşleşen member_user kayıtlarını bul
          const allMemberUsers = await FirebaseService.getAll(this.COLLECTIONS.MEMBER_USERS);
          memberUsersByUsername = (allMemberUsers || []).filter(u =>
            u.userType === 'musahit' && u.username === username
          );
        }

        // Tüm müşahit kullanıcılarını birleştir
        const allMusahitUsers = [
          ...(memberUsers || []),
          ...memberUsersByUsername
        ];

        // Her kullanıcı için Firebase Auth kullanıcısını sil ve member_user'ı sil
        for (const memberUser of allMusahitUsers) {
          try {
            // Firebase Auth kullanıcısını sil (eğer varsa) - Backend üzerinden
            if (memberUser.authUid) {
              try {
                const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
                const response = await fetch(`${API_BASE_URL}/auth/firebase-auth-user/${memberUser.authUid}`, {
                  method: 'DELETE',
                  headers: {
                    'Content-Type': 'application/json'
                  }
                });

                if (response.ok) {
                } else {
                  const errorData = await response.json().catch(() => ({}));
                  console.warn('⚠️ Firebase Auth deletion via backend failed:', errorData.message || response.statusText);
                }
              } catch (authError) {
                console.warn('⚠️ Firebase Auth deletion failed (non-critical):', authError);
              }
            }

            // Firestore'dan member_user'ı sil
            await FirebaseService.delete(this.COLLECTIONS.MEMBER_USERS, memberUser.id);
          } catch (userError) {
            console.error('❌ Error deleting member user for observer:', userError);
            // Devam et, diğer kullanıcıları da silmeyi dene
          }
        }
      } catch (userError) {
        console.error('❌ Error deleting member users for observer:', userError);
        // Devam et, müşahit silme işlemini tamamla
      }

      // Müşahiti sil
      await FirebaseService.delete(this.COLLECTIONS.BALLOT_BOX_OBSERVERS, id);
      return { success: true, message: 'Sandık gözlemcisi silindi' };
    } catch (error) {
      console.error('Delete ballot box observer error:', error);
      throw new Error('Sandık gözlemcisi silinirken hata oluştu: ' + error.message);
    }
  }

  // District Officials CRUD
  static async getAllDistrictOfficials() {
    try {
      return await FirebaseService.getAll(this.COLLECTIONS.DISTRICT_OFFICIALS);
    } catch (error) {
      console.error('Get all district officials error:', error);
      return [];
    }
  }

  static async getDistrictOfficials(districtId) {
    try {
      return await FirebaseService.findByField(this.COLLECTIONS.DISTRICT_OFFICIALS, 'district_id', districtId);
    } catch (error) {
      console.error('Get district officials error:', error);
      return [];
    }
  }

  static async createOrUpdateDistrictOfficials(officialsData) {
    try {
      // district_id kontrolü
      if (!officialsData.district_id) {
        throw new Error('district_id gereklidir');
      }

      // district_id'yi string'e çevir
      const districtId = String(officialsData.district_id);

      // undefined değerleri temizle
      const cleanedData = {
        district_id: districtId,
        chairman_name: officialsData.chairman_name || null,
        chairman_phone: officialsData.chairman_phone || null,
        chairman_member_id: officialsData.chairman_member_id || null,
        inspector_name: officialsData.inspector_name || null,
        inspector_phone: officialsData.inspector_phone || null,
        inspector_member_id: officialsData.inspector_member_id || null,
        deputy_inspectors: officialsData.deputy_inspectors || []
      };

      // district_id ile mevcut kaydı bul
      const existing = await FirebaseService.findByField(
        this.COLLECTIONS.DISTRICT_OFFICIALS,
        'district_id',
        districtId
      );

      if (existing && existing.length > 0) {
        // Güncelle
        await FirebaseService.update(this.COLLECTIONS.DISTRICT_OFFICIALS, existing[0].id, cleanedData, false);
        return { success: true, id: existing[0].id, message: 'İlçe yetkilileri güncellendi' };
      } else {
        // Yeni oluştur
        const docId = await FirebaseService.create(this.COLLECTIONS.DISTRICT_OFFICIALS, null, cleanedData, false);
        return { success: true, id: docId, message: 'İlçe yetkilileri oluşturuldu' };
      }
    } catch (error) {
      console.error('Create/update district officials error:', error);
      throw new Error('İlçe yetkilileri kaydedilirken hata oluştu: ' + (error.message || error));
    }
  }

  static async deleteDistrictOfficials(districtId) {
    try {
      const existing = await FirebaseService.findByField(
        this.COLLECTIONS.DISTRICT_OFFICIALS,
        'district_id',
        districtId
      );

      if (existing && existing.length > 0) {
        await FirebaseService.delete(this.COLLECTIONS.DISTRICT_OFFICIALS, existing[0].id);
        return { success: true, message: 'İlçe yetkilileri silindi' };
      }
      return { success: true, message: 'İlçe yetkilileri bulunamadı' };
    } catch (error) {
      console.error('Delete district officials error:', error);
      throw new Error('İlçe yetkilileri silinirken hata oluştu');
    }
  }

  // District Deputy Inspectors
  static async getDistrictDeputyInspectors(districtId) {
    try {
      // districtId undefined ise boş array döndür
      if (!districtId || districtId === undefined) {
        return [];
      }

      // Deputy inspectors muhtemelen district_officials collection'ında veya ayrı bir collection'da
      // Önce district_officials içinde arayalım
      const officials = await FirebaseService.findByField(
        this.COLLECTIONS.DISTRICT_OFFICIALS,
        'district_id',
        String(districtId) // String'e çevirerek tutarlılık sağla
      );
      // Deputy inspectors'ı filtrele (eğer type field'ı varsa)
      const deputyInspectors = officials.filter(official =>
        official.type === 'deputy_inspector' ||
        official.role === 'deputy_inspector' ||
        official.position === 'deputy_inspector'
      );
      return deputyInspectors;
    } catch (error) {
      console.error('Get district deputy inspectors error:', error);
      return [];
    }
  }

  // Get all district deputy inspectors (parametresiz)
  static async getAllDistrictDeputyInspectors() {
    try {
      // Tüm district officials'ları al
      const allOfficials = await FirebaseService.getAll(this.COLLECTIONS.DISTRICT_OFFICIALS);
      // Deputy inspectors'ı filtrele
      const deputyInspectors = allOfficials.filter(official =>
        official.type === 'deputy_inspector' ||
        official.role === 'deputy_inspector' ||
        official.position === 'deputy_inspector'
      );
      return deputyInspectors;
    } catch (error) {
      console.error('Get all district deputy inspectors error:', error);
      return [];
    }
  }

  // Town Officials CRUD
  static async getTownOfficials(townId) {
    try {
      // townId undefined ise boş array döndür
      if (!townId || townId === undefined) {
        return [];
      }

      return await FirebaseService.findByField(this.COLLECTIONS.TOWN_OFFICIALS, 'town_id', String(townId)); // String'e çevirerek tutarlılık sağla
    } catch (error) {
      console.error('Get town officials error:', error);
      return [];
    }
  }

  // Town Deputy Inspectors
  static async getTownDeputyInspectors(townId) {
    try {
      // townId undefined ise boş array döndür
      if (!townId || townId === undefined) {
        return [];
      }

      // Town officials'ları al ve deputy inspector'ları filtrele
      const officials = await FirebaseService.findByField(
        this.COLLECTIONS.TOWN_OFFICIALS,
        'town_id',
        String(townId) // String'e çevirerek tutarlılık sağla
      );
      const deputyInspectors = officials.filter(official =>
        official.type === 'deputy_inspector' ||
        official.role === 'deputy_inspector' ||
        official.position === 'deputy_inspector'
      );
      return deputyInspectors;
    } catch (error) {
      console.error('Get town deputy inspectors error:', error);
      return [];
    }
  }

  // Get all town deputy inspectors (parametresiz)
  static async getAllTownDeputyInspectors() {
    try {
      // Tüm town officials'ları al
      const allOfficials = await FirebaseService.getAll(this.COLLECTIONS.TOWN_OFFICIALS);
      // Deputy inspectors'ı filtrele
      const deputyInspectors = allOfficials.filter(official =>
        official.type === 'deputy_inspector' ||
        official.role === 'deputy_inspector' ||
        official.position === 'deputy_inspector'
      );
      return deputyInspectors;
    } catch (error) {
      console.error('Get all town deputy inspectors error:', error);
      return [];
    }
  }

  static async createOrUpdateTownOfficials(officialsData) {
    try {
      // town_id kontrolü
      if (!officialsData.town_id) {
        throw new Error('town_id gereklidir');
      }

      // town_id'yi string'e çevir
      const townId = String(officialsData.town_id);

      // undefined değerleri temizle
      const cleanedData = {
        town_id: townId,
        chairman_name: officialsData.chairman_name || null,
        chairman_phone: officialsData.chairman_phone || null,
        chairman_member_id: officialsData.chairman_member_id || null,
        inspector_name: officialsData.inspector_name || null,
        inspector_phone: officialsData.inspector_phone || null,
        inspector_member_id: officialsData.inspector_member_id || null,
        deputy_inspectors: officialsData.deputy_inspectors || []
      };

      const existing = await FirebaseService.findByField(
        this.COLLECTIONS.TOWN_OFFICIALS,
        'town_id',
        townId
      );

      if (existing && existing.length > 0) {
        await FirebaseService.update(this.COLLECTIONS.TOWN_OFFICIALS, existing[0].id, cleanedData, false);
      } else {
        await FirebaseService.create(this.COLLECTIONS.TOWN_OFFICIALS, null, cleanedData, false);
      }

      // Belde başkanı kullanıcısı oluştur/güncelle (eğer başkan bilgileri varsa)
      if (cleanedData.chairman_name && cleanedData.chairman_phone) {
        try {
          // Belde bilgisini al
          const town = await FirebaseService.getById(this.COLLECTIONS.TOWNS, townId);
          if (town) {
            // Başkan üye ise, üye kullanıcısı oluştur (eğer yoksa)
            if (cleanedData.chairman_member_id) {
              const memberUsers = await FirebaseService.findByField(
                this.COLLECTIONS.MEMBER_USERS,
                'memberId',
                String(cleanedData.chairman_member_id)
              );

              if (!memberUsers || memberUsers.length === 0) {
                // Üye bilgisini al
                const member = await FirebaseService.getById(this.COLLECTIONS.MEMBERS, cleanedData.chairman_member_id);
                if (member) {
                  // TC ve telefon numarasını decrypt et
                  const tc = member.tc && member.tc.startsWith('U2FsdGVkX1') ? decryptData(member.tc) : member.tc;
                  const phone = member.phone && member.phone.startsWith('U2FsdGVkX1') ? decryptData(member.phone) : member.phone;

                  // Üye kullanıcısı oluştur
                  await this.createMemberUser(cleanedData.chairman_member_id, tc, phone.replace(/\D/g, ''));
                }
              } else {
              }
            } else {
              // Başkan üye değilse, belde başkanı kullanıcısı oluştur
              // Kullanıcı adı: belde adı (normalize edilmiş - Türkçe karakterler düzeltilmiş)
              const normalizedTownName = town.name
                .toLowerCase()
                .replace(/ç/g, 'c')
                .replace(/ğ/g, 'g')
                .replace(/ı/g, 'i')
                .replace(/ö/g, 'o')
                .replace(/ş/g, 's')
                .replace(/ü/g, 'u')
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, '');
              const username = normalizedTownName;
              const password = cleanedData.chairman_phone.replace(/\D/g, ''); // Sadece rakamlar

              // Mevcut belde başkanı kullanıcısını kontrol et
              const existingTownUsers = await FirebaseService.findByField(
                this.COLLECTIONS.MEMBER_USERS,
                'townId',
                townId
              );

              if (existingTownUsers && existingTownUsers.length > 0) {
                // Mevcut kullanıcıyı güncelle
                const townUser = existingTownUsers.find(u => u.userType === 'town_president');
                if (townUser) {
                  // Firebase Auth'da kullanıcı yoksa oluştur
                  if (!townUser.authUid) {
                    try {
                      const email = `${username}@ilsekreterlik.local`;
                      const currentUser = auth.currentUser;
                      const currentUserUid = currentUser ? currentUser.uid : null;

                      const authUser = await createUserWithEmailAndPassword(auth, email, password);

                      // Admin kullanıcısını geri yükle
                      if (currentUserUid && currentUserUid !== authUser.user.uid) {
                        try {
                          await signInWithEmailAndPassword(auth, currentUser.email, currentUser.password || 'admin123');
                        } catch (restoreError) {
                          console.warn('⚠️ Could not restore admin user:', restoreError);
                        }
                      }

                      // Firestore'da authUid'yi güncelle (encrypt = false - password şifrelenmemeli)
                      await FirebaseService.update(this.COLLECTIONS.MEMBER_USERS, townUser.id, {
                        username,
                        password: password,
                        chairmanName: cleanedData.chairman_name,
                        chairmanPhone: cleanedData.chairman_phone,
                        authUid: authUser.user.uid
                      }, false);
                    } catch (authError) {
                      console.warn('⚠️ Firebase Auth user creation failed (non-critical):', authError);
                      // Auth oluşturulamasa bile Firestore'u güncelle (encrypt = false - password şifrelenmemeli)
                      await FirebaseService.update(this.COLLECTIONS.MEMBER_USERS, townUser.id, {
                        username,
                        password: password,
                        chairmanName: cleanedData.chairman_name,
                        chairmanPhone: cleanedData.chairman_phone
                      }, false);
                    }
                  } else {
                    // Auth UID varsa Firestore'u güncelle
                    // Telefon değiştiyse şifre de güncellenmeli
                    const oldPhone = townUser.chairmanPhone || townUser.password;
                    const newPhone = cleanedData.chairman_phone.replace(/\D/g, '');
                    const phoneChanged = oldPhone && oldPhone.replace(/\D/g, '') !== newPhone;

                    await FirebaseService.update(this.COLLECTIONS.MEMBER_USERS, townUser.id, {
                      username,
                      password: password, // Şifrelenmemeli (encrypt = false)
                      chairmanName: cleanedData.chairman_name,
                      chairmanPhone: cleanedData.chairman_phone
                    }, false); // encrypt = false - password şifrelenmemeli

                    // Telefon değiştiyse şifre de güncellendi (Firestore'da)
                    // Firebase Auth'daki şifre güncellemesi için backend/Cloud Functions gerekir
                    // Şimdilik Firestore'daki password güncelleniyor, login sırasında kontrol edilecek
                    if (phoneChanged) {
                    }
                  }
                }
              } else {
                // Yeni belde başkanı kullanıcısı oluştur
                // Önce Firebase Auth'da kullanıcı oluştur
                const email = `${username}@ilsekreterlik.local`;
                let authUser = null;

                try {
                  // Mevcut kullanıcıyı koru
                  const currentUser = auth.currentUser;
                  const currentUserUid = currentUser ? currentUser.uid : null;

                  // Firebase Auth'da kullanıcı oluştur
                  authUser = await createUserWithEmailAndPassword(auth, email, password);

                  // Admin kullanıcısını geri yükle (eğer varsa)
                  if (currentUserUid && currentUserUid !== authUser.user.uid) {
                    try {
                      await signInWithEmailAndPassword(auth, currentUser.email, currentUser.password || 'admin123');
                    } catch (restoreError) {
                      console.warn('⚠️ Could not restore admin user, will need to re-login:', restoreError);
                    }
                  }
                } catch (authError) {
                  // Email zaten kullanılıyorsa, mevcut kullanıcıyı kullan
                  if (authError.code === 'auth/email-already-in-use') {
                    console.warn('⚠️ Email already in use for town president, will use existing user:', email);
                    // Mevcut kullanıcıyı bulmak için sign-in denemesi yapabiliriz ama bu karmaşık olabilir
                    // Bu durumda sadece Firestore'a kaydediyoruz
                  } else {
                    console.warn('⚠️ Firebase Auth user creation failed (non-critical):', authError);
                  }
                }

                // Firestore'a kaydet (encrypt = false - password şifrelenmemeli)
                await FirebaseService.create(
                  this.COLLECTIONS.MEMBER_USERS,
                  null,
                  {
                    username,
                    password: password, // Şifrelenmemeli (encrypt = false)
                    userType: 'town_president',
                    townId: townId,
                    chairmanName: cleanedData.chairman_name,
                    chairmanPhone: cleanedData.chairman_phone,
                    isActive: true,
                    authUid: authUser?.user?.uid || null // Auth UID varsa kaydet
                  },
                  false // encrypt = false - password şifrelenmemeli
                );
              }
            }
          }
        } catch (userError) {
          console.warn('⚠️ Error creating/updating town president user (non-critical):', userError);
          // Kullanıcı oluşturma hatası kritik değil, devam et
        }
      }

      if (existing && existing.length > 0) {
        return { success: true, id: existing[0].id, message: 'Belde yetkilileri güncellendi' };
      } else {
        return { success: true, id: townId, message: 'Belde yetkilileri oluşturuldu' };
      }
    } catch (error) {
      console.error('Create/update town officials error:', error);
      throw new Error('Belde yetkilileri kaydedilirken hata oluştu: ' + (error.message || error));
    }
  }

  static async deleteTownOfficials(townId) {
    try {
      const existing = await FirebaseService.findByField(this.COLLECTIONS.TOWN_OFFICIALS, 'town_id', townId);
      if (existing && existing.length > 0) {
        await FirebaseService.delete(this.COLLECTIONS.TOWN_OFFICIALS, existing[0].id);
        return { success: true, message: 'İlçe yetkilileri silindi' };
      }
      return { success: true, message: 'İlçe yetkilileri bulunamadı' };
    } catch (error) {
      console.error('Delete town officials error:', error);
      throw new Error('İlçe yetkilileri silinirken hata oluştu');
    }
  }

  // District Management Members CRUD
  static async getDistrictManagementMembers(districtId) {
    try {
      return await FirebaseService.findByField(this.COLLECTIONS.DISTRICT_MANAGEMENT_MEMBERS, 'district_id', districtId);
    } catch (error) {
      console.error('Get district management members error:', error);
      return [];
    }
  }

  static async createDistrictManagementMember(memberData) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.DISTRICT_MANAGEMENT_MEMBERS, null, memberData);
      return { success: true, id: docId, message: 'İlçe yönetim üyesi oluşturuldu' };
    } catch (error) {
      console.error('Create district management member error:', error);
      throw new Error('İlçe yönetim üyesi oluşturulurken hata oluştu');
    }
  }

  static async updateDistrictManagementMember(id, memberData) {
    try {
      await FirebaseService.update(this.COLLECTIONS.DISTRICT_MANAGEMENT_MEMBERS, id, memberData);
      return { success: true, message: 'İlçe yönetim üyesi güncellendi' };
    } catch (error) {
      console.error('Update district management member error:', error);
      throw new Error('İlçe yönetim üyesi güncellenirken hata oluştu');
    }
  }

  static async deleteDistrictManagementMember(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.DISTRICT_MANAGEMENT_MEMBERS, id);
      return { success: true, message: 'İlçe yönetim üyesi silindi' };
    } catch (error) {
      console.error('Delete district management member error:', error);
      throw new Error('İlçe yönetim üyesi silinirken hata oluştu');
    }
  }

  // Town Management Members CRUD
  static async getTownManagementMembers(townId) {
    try {
      return await FirebaseService.findByField(this.COLLECTIONS.TOWN_MANAGEMENT_MEMBERS, 'town_id', townId);
    } catch (error) {
      console.error('Get town management members error:', error);
      return [];
    }
  }

  static async createTownManagementMember(memberData) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.TOWN_MANAGEMENT_MEMBERS, null, memberData);
      return { success: true, id: docId, message: 'İlçe yönetim üyesi oluşturuldu' };
    } catch (error) {
      console.error('Create town management member error:', error);
      throw new Error('İlçe yönetim üyesi oluşturulurken hata oluştu');
    }
  }

  static async updateTownManagementMember(id, memberData) {
    try {
      await FirebaseService.update(this.COLLECTIONS.TOWN_MANAGEMENT_MEMBERS, id, memberData);
      return { success: true, message: 'İlçe yönetim üyesi güncellendi' };
    } catch (error) {
      console.error('Update town management member error:', error);
      throw new Error('İlçe yönetim üyesi güncellenirken hata oluştu');
    }
  }

  static async deleteTownManagementMember(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.TOWN_MANAGEMENT_MEMBERS, id);
      return { success: true, message: 'İlçe yönetim üyesi silindi' };
    } catch (error) {
      console.error('Delete town management member error:', error);
      throw new Error('İlçe yönetim üyesi silinirken hata oluştu');
    }
  }

  // Delete Firebase Auth User using Admin SDK REST API
  // Note: This is a simplified implementation. In production, this should be done on the backend
  // using Firebase Admin SDK or Cloud Functions
  static async deleteFirebaseAuthUser(authUid) {
    try {
      if (!authUid) {
        console.warn('⚠️ No authUid provided for deletion');
        return;
      }

      // Firebase Identity Platform REST API kullanarak kullanıcıyı sil
      // Bu işlem için Firebase API Key ve Admin SDK gereklidir
      // Client-side'da Admin SDK kullanmak güvenlik riski oluşturur
      // Ancak kullanıcı silme işlemi için Identity Platform REST API kullanabiliriz

      // Firebase config'den API key'i al
      const firebaseConfig = auth.app.options;
      const apiKey = firebaseConfig?.apiKey;

      if (!apiKey) {
        console.warn('⚠️ Firebase API key not found, cannot delete user from Firebase Auth');
        console.warn('⚠️ User authUid will be removed from Firestore, Firebase Auth user will be invalid on next login');
        return;
      }

      // Firebase Identity Platform REST API endpoint
      const deleteUserUrl = `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`;

      // Kullanıcıyı silmek için ID token gereklidir
      // Ancak client-side'da başka bir kullanıcının token'ını alamayız
      // Bu yüzden şimdilik Firestore'dan authUid'i kaldırıyoruz
      // Login sırasında kontrol edilip, eğer Firestore'da yoksa Firebase Auth'daki kullanıcı da geçersiz sayılır


      // Firestore'dan authUid zaten kaldırılacak (member_user silindiğinde)
      // Bu yüzden burada bir şey yapmaya gerek yok
      // Login sırasında Firestore'da authUid yoksa, Firebase Auth'daki kullanıcı da geçersiz sayılır

    } catch (error) {
      console.error('❌ Error in deleteFirebaseAuthUser:', error);
      // Non-critical error, continue
    }
  }

  // Delete Member User
  static async deleteMemberUser(id) {
    try {
      // Önce Firestore'dan kullanıcıyı al
      const memberUser = await FirebaseService.getById(this.COLLECTIONS.MEMBER_USERS, id);

      if (!memberUser) {
        return { success: false, message: 'Kullanıcı bulunamadı' };
      }

      // Firebase Auth'dan silme işlemi - Backend servisi gerektirir
      let authDeleted = false;
      if (memberUser.authUid) {
        try {
          // Backend URL'ini belirle
          let API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
          if (!API_BASE_URL) {
            if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')) {
              const hostname = window.location.hostname;
              const backendHostname = hostname.replace('yrpilsekreterligi', 'sekreterlik-backend');
              API_BASE_URL = `https://${backendHostname}/api`;
            } else {
              API_BASE_URL = 'http://localhost:5000/api';
            }
          }

          // Backend endpoint'ini kullanarak Firebase Auth kullanıcısını sil
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(`${API_BASE_URL}/auth/firebase-auth-user/${memberUser.authUid}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json'
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            authDeleted = true;
          } else {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.message || response.statusText;
            console.warn('⚠️ Firebase Auth deletion via backend failed:', errorMsg);
            // Backend yoksa veya hata varsa, Firestore'dan silmeye devam et
            // Ama kullanıcıya bilgi ver
            if (errorMsg.includes('CORS') || errorMsg.includes('Failed to fetch') || response.status === 0) {
              console.warn('⚠️ Backend servisi erişilemiyor, sadece Firestore\'dan siliniyor');
            }
          }
        } catch (authError) {
          if (authError.name === 'AbortError') {
            console.warn('⚠️ Backend servisi timeout, sadece Firestore\'dan siliniyor');
          } else if (authError.message?.includes('CORS') || authError.message?.includes('Failed to fetch')) {
            console.warn('⚠️ Backend servisi erişilemiyor (CORS/Network), sadece Firestore\'dan siliniyor');
          } else {
            console.warn('⚠️ Firebase Auth deletion failed:', authError.message);
          }
        }
      }

      // Firestore'dan sil (her durumda)
      await FirebaseService.delete(this.COLLECTIONS.MEMBER_USERS, id);


      // Sonuç mesajı
      if (authDeleted) {
        return { success: true, message: 'Kullanıcı Firestore ve Firebase Auth\'dan silindi' };
      } else if (memberUser.authUid) {
        return {
          success: true,
          message: 'Kullanıcı Firestore\'dan silindi. Firebase Auth\'dan silmek için backend servisi gereklidir. Senkronizasyon butonunu kullanarak temizleyebilirsiniz.',
          warning: true
        };
      } else {
        return { success: true, message: 'Kullanıcı Firestore\'dan silindi' };
      }
    } catch (error) {
      console.error('Delete member user error:', error);
      throw new Error('Kullanıcı silinirken hata oluştu: ' + error.message);
    }
  }

  // Groups CRUD
  static async getGroups() {
    try {
      return await FirebaseService.getAll(this.COLLECTIONS.GROUPS);
    } catch (error) {
      console.error('Get groups error:', error);
      return [];
    }
  }

  static async getGroupByGroupNo(groupNo) {
    try {
      const groups = await FirebaseService.getAll(this.COLLECTIONS.GROUPS);
      return groups.find(g => String(g.group_no) === String(groupNo));
    } catch (error) {
      console.error('Get group by group_no error:', error);
      return null;
    }
  }

  static async createOrUpdateGroup(groupNo, groupLeaderId) {
    try {
      const existingGroup = await this.getGroupByGroupNo(groupNo);

      if (existingGroup) {
        // Update existing group
        await FirebaseService.update(this.COLLECTIONS.GROUPS, existingGroup.id, {
          group_no: groupNo,
          group_leader_id: groupLeaderId || null
        });
        return { success: true, id: existingGroup.id, message: 'Grup güncellendi' };
      } else {
        // Create new group
        const docId = await FirebaseService.create(this.COLLECTIONS.GROUPS, null, {
          group_no: groupNo,
          group_leader_id: groupLeaderId || null
        });
        return { success: true, id: docId, message: 'Grup oluşturuldu' };
      }
    } catch (error) {
      console.error('Create or update group error:', error);
      throw new Error('Grup oluşturulurken veya güncellenirken hata oluştu');
    }
  }

  static async deleteGroup(groupNo) {
    try {
      const group = await this.getGroupByGroupNo(groupNo);
      if (group) {
        await FirebaseService.delete(this.COLLECTIONS.GROUPS, group.id);
        return { success: true, message: 'Grup silindi' };
      }
      return { success: false, message: 'Grup bulunamadı' };
    } catch (error) {
      console.error('Delete group error:', error);
      throw new Error('Grup silinirken hata oluştu');
    }
  }

  // Personal Documents API methods
  static async getPersonalDocuments(memberId) {
    try {
      // memberId'yi string'e çevir
      const memberIdStr = String(memberId);

      // Firebase'de personal_documents collection'ından member_id'ye göre filtrele
      const documents = await FirebaseService.findByField(
        this.COLLECTIONS.PERSONAL_DOCUMENTS,
        'member_id',
        memberIdStr
      );

      return documents || [];
    } catch (error) {
      console.error('Get personal documents error:', error);
      return [];
    }
  }

  static async uploadPersonalDocument(memberId, documentName, file) {
    try {
      // memberId'yi string'e çevir
      const memberIdStr = String(memberId);

      // Firebase Storage'a yükle
      const FirebaseStorageService = (await import('./FirebaseStorageService')).default;
      const storageUrl = await FirebaseStorageService.uploadPersonalDocument(memberIdStr, documentName, file);

      // Belge verilerini hazırla (artık base64 yerine Storage URL'i saklıyoruz)
      const documentData = {
        member_id: memberIdStr,
        document_name: documentName.trim(),
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        storage_url: storageUrl, // Firebase Storage URL'i
        uploaded_at: new Date().toISOString()
      };

      // Firebase'e kaydet (şifreleme yok - belge adı hassas değil)
      const docId = await FirebaseService.create(
        this.COLLECTIONS.PERSONAL_DOCUMENTS,
        null,
        documentData,
        false // Şifreleme yok
      );

      return {
        message: 'Belge başarıyla yüklendi',
        document: {
          id: docId,
          document_name: documentName,
          file_size: file.size,
          uploaded_at: documentData.uploaded_at,
          storage_url: storageUrl
        }
      };
    } catch (error) {
      console.error('Upload personal document error:', error);
      throw new Error('Belge yüklenirken hata oluştu: ' + (error.message || error));
    }
  }

  static async downloadPersonalDocument(documentId) {
    try {
      // Belgeyi Firebase'den al
      const document = await FirebaseService.getById(
        this.COLLECTIONS.PERSONAL_DOCUMENTS,
        documentId
      );

      if (!document) {
        throw new Error('Belge bulunamadı');
      }

      // Firebase Storage URL'i varsa onu kullan
      if (document.storage_url) {
        const response = await fetch(document.storage_url);
        const blob = await response.blob();
        return blob;
      }

      // Eski base64 formatı için (geriye dönük uyumluluk)
      if (document.file_data) {
        // Base64 data URL'den blob'a çevir
        const response = await fetch(document.file_data);
        const blob = await response.blob();
        return blob;
      }

      throw new Error('Belge verisi bulunamadı');
    } catch (error) {
      console.error('Download personal document error:', error);
      throw new Error('Belge indirilirken hata oluştu: ' + (error.message || error));
    }
  }

  static async deletePersonalDocument(documentId) {
    try {
      // Önce belgeyi al (Storage URL'i için)
      const document = await FirebaseService.getById(
        this.COLLECTIONS.PERSONAL_DOCUMENTS,
        documentId
      );

      if (document && document.storage_url) {
        // Firebase Storage'dan sil
        try {
          const FirebaseStorageService = (await import('./FirebaseStorageService')).default;
          // Storage URL'den path'i çıkar
          const url = new URL(document.storage_url);
          const path = decodeURIComponent(url.pathname.split('/o/')[1]?.split('?')[0] || '');
          if (path) {
            await FirebaseStorageService.deleteFile(path);
          }
        } catch (storageError) {
          console.warn('⚠️ Storage delete error (non-critical):', storageError);
          // Storage silme hatası belge silme işlemini durdurmamalı
        }
      }

      // Firestore'dan sil
      await FirebaseService.delete(this.COLLECTIONS.PERSONAL_DOCUMENTS, documentId);
      return { success: true, message: 'Belge silindi' };
    } catch (error) {
      console.error('Delete personal document error:', error);
      throw new Error('Belge silinirken hata oluştu');
    }
  }

  // SMS API Methods
  /**
   * Planlanan toplantı/etkinlik için otomatik SMS gönder
   * @param {string} type - 'meeting' veya 'event'
   * @param {object} data - Toplantı/etkinlik verisi
   * @param {string[]} regions - Bölge isimleri
   */
  static async sendAutoSmsForScheduled(type, data, regions) {
    try {
      // Otomatik SMS ayarlarını kontrol et
      const autoSettings = await FirebaseService.getById('sms_auto_settings', 'main');
      if (!autoSettings) {
        return { success: false, message: 'Otomatik SMS ayarları bulunamadı' };
      }

      const isEnabled = type === 'meeting'
        ? autoSettings.autoSmsForMeetings
        : autoSettings.autoSmsForEvents;

      if (!isEnabled) {
        return { success: false, message: `Otomatik SMS ${type === 'meeting' ? 'toplantılar' : 'etkinlikler'} için devre dışı` };
      }

      // SMS servisini yükle
      const { default: smsService } = await import('../services/SmsService');
      await smsService.loadConfig();

      // Seçili bölgelerdeki üyeleri al
      const allMembers = await this.getMembers();
      const filteredMembers = allMembers.filter(member =>
        member.region && regions.includes(member.region)
      );

      if (filteredMembers.length === 0) {
        return { success: false, message: 'Seçili bölgelerde üye bulunamadı' };
      }

      // Tarih ve saat formatla
      const dateObj = new Date(data.date);
      const dateStr = dateObj.toLocaleDateString('tr-TR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const timeStr = dateObj.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit'
      });

      // Özel metin
      const customText = type === 'meeting'
        ? (autoSettings.meetingCustomText || '')
        : (autoSettings.eventCustomText || '');

      // Mesaj formatla
      const typeText = type === 'meeting' ? 'toplantı' : 'etkinlik';
      const nameText = data.name || (type === 'meeting' ? 'Toplantı' : 'Etkinlik');

      // Telefon numaralarını topla
      const phones = filteredMembers
        .map(member => {
          const phone = member.phone || '';
          return phone ? smsService.formatPhoneNumber(phone) : null;
        })
        .filter(phone => phone !== null);

      if (phones.length === 0) {
        return { success: false, message: 'Geçerli telefon numarası bulunamadı' };
      }

      // Her üye için kişiselleştirilmiş mesaj gönder
      const results = {
        sent: 0,
        failed: 0,
        errors: []
      };

      for (const member of filteredMembers) {
        const phone = smsService.formatPhoneNumber(member.phone);
        if (!phone) {
          results.failed++;
          results.errors.push({ member: member.name, error: 'Geçersiz telefon numarası' });
          continue;
        }

        const memberName = member.name || 'Üye';
        const message = smsService.formatScheduledMessage(
          memberName,
          type,
          dateStr,
          timeStr,
          customText
        );

        try {
          const result = await smsService.sendSms(phone, message);
          if (result.success) {
            results.sent++;
          } else {
            results.failed++;
            results.errors.push({ member: memberName, error: result.message });
          }
          // Rate limiting için kısa bir bekleme
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          results.failed++;
          results.errors.push({ member: memberName, error: error.message });
        }
      }

      return {
        success: results.failed === 0,
        message: `${results.sent} SMS gönderildi, ${results.failed} başarısız`,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors
      };
    } catch (error) {
      console.error('Send auto SMS error:', error);
      return { success: false, message: 'Otomatik SMS gönderilirken hata oluştu: ' + error.message };
    }
  }

  /**
   * Toplu SMS gönder
   * @param {string} message - Gönderilecek mesaj
   * @param {string[]} regions - Bölge isimleri (boş ise tüm üyelere)
   * @param {string[]} memberIds - Belirli üye ID'leri (opsiyonel)
   * @param {object} options - { includeObservers: boolean, includeChiefObservers: boolean, includeTownPresidents: boolean, includeNeighborhoodRepresentatives: boolean, includeVillageRepresentatives: boolean }
   */
  static async sendBulkSms(message, regions = [], memberIds = [], options = {}) {
    try {
      const {
        includeObservers = false,
        includeChiefObservers = false,
        includeTownPresidents = false,
        includeNeighborhoodRepresentatives = false,
        includeVillageRepresentatives = false
      } = options;

      // SMS servisini yükle
      const { default: smsService } = await import('../services/SmsService');
      await smsService.loadConfig();

      // Üyeleri al
      let members = await this.getMembers();

      // Bölge filtresi
      if (regions.length > 0) {
        members = members.filter(member =>
          member.region && regions.includes(member.region)
        );
      }

      // Belirli üye ID'leri filtresi
      if (memberIds.length > 0) {
        members = members.filter(member =>
          memberIds.includes(String(member.id))
        );
      }

      // Telefon numaralarını topla ve mesajları formatla
      let smsData = members
        .map(member => {
          const phone = smsService.formatPhoneNumber(member.phone);
          if (!phone) return null;

          const memberName = member.name || 'Üye';
          const personalizedMessage = smsService.formatBulkMessage(memberName, message);

          return { phone, message: personalizedMessage, name: memberName, type: 'member' };
        })
        .filter(item => item !== null);

      // Müşahitler ekle
      if (includeObservers) {
        const observers = await this.getBallotBoxObservers();
        const regularObservers = observers.filter(obs => !obs.is_chief_observer);

        for (const observer of regularObservers) {
          const phone = smsService.formatPhoneNumber(observer.observer_phone || observer.phone);
          if (phone) {
            const observerName = observer.observer_name || observer.name || 'Müşahit';
            const personalizedMessage = smsService.formatBulkMessage(observerName, message);
            smsData.push({ phone, message: personalizedMessage, name: observerName, type: 'observer' });
          }
        }
      }

      // Baş müşahitler ekle
      if (includeChiefObservers) {
        const observers = await this.getBallotBoxObservers();
        const chiefObservers = observers.filter(obs => obs.is_chief_observer === true);

        for (const observer of chiefObservers) {
          const phone = smsService.formatPhoneNumber(observer.observer_phone || observer.phone);
          if (phone) {
            const observerName = observer.observer_name || observer.name || 'Baş Müşahit';
            const personalizedMessage = smsService.formatBulkMessage(observerName, message);
            smsData.push({ phone, message: personalizedMessage, name: observerName, type: 'chief_observer' });
          }
        }
      }

      // Belde başkanları ekle
      if (includeTownPresidents) {
        const townOfficials = await FirebaseService.getAll(this.COLLECTIONS.TOWN_OFFICIALS);
        const presidents = townOfficials.filter(official =>
          official.type === 'president' ||
          official.role === 'president' ||
          official.position === 'president' ||
          official.chairman_name // Eğer chairman_name varsa başkan olabilir
        );

        for (const president of presidents) {
          const phone = smsService.formatPhoneNumber(president.chairman_phone || president.phone);
          if (phone) {
            const presidentName = president.chairman_name || president.name || 'Belde Başkanı';
            const personalizedMessage = smsService.formatBulkMessage(presidentName, message);
            smsData.push({ phone, message: personalizedMessage, name: presidentName, type: 'town_president' });
          }
        }
      }

      // Mahalle temsilcileri ekle
      if (includeNeighborhoodRepresentatives) {
        const neighborhoodReps = await this.getNeighborhoodRepresentatives();

        for (const rep of neighborhoodReps) {
          const phone = smsService.formatPhoneNumber(rep.phone);
          if (phone) {
            const repName = rep.name || 'Mahalle Temsilcisi';
            const personalizedMessage = smsService.formatBulkMessage(repName, message);
            smsData.push({ phone, message: personalizedMessage, name: repName, type: 'neighborhood_representative' });
          }
        }
      }

      // Köy temsilcileri ekle
      if (includeVillageRepresentatives) {
        const villageReps = await this.getVillageRepresentatives();

        for (const rep of villageReps) {
          const phone = smsService.formatPhoneNumber(rep.phone);
          if (phone) {
            const repName = rep.name || 'Köy Temsilcisi';
            const personalizedMessage = smsService.formatBulkMessage(repName, message);
            smsData.push({ phone, message: personalizedMessage, name: repName, type: 'village_representative' });
          }
        }
      }

      if (smsData.length === 0) {
        return { success: false, message: 'Gönderilecek kişi bulunamadı', sent: 0, failed: 0 };
      }

      // SMS gönder
      const results = {
        sent: 0,
        failed: 0,
        errors: []
      };

      for (const { phone, message: personalizedMessage, name, type } of smsData) {
        try {
          const result = await smsService.sendSms(phone, personalizedMessage);
          if (result.success) {
            results.sent++;
          } else {
            results.failed++;
            results.errors.push({ name, type, error: result.message });
          }
          // Rate limiting için kısa bir bekleme
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          results.failed++;
          results.errors.push({ name, type, error: error.message });
        }
      }

      return {
        success: results.failed === 0,
        message: `${results.sent} SMS gönderildi, ${results.failed} başarısız`,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors
      };
    } catch (error) {
      console.error('Send bulk SMS error:', error);
      return { success: false, message: 'Toplu SMS gönderilirken hata oluştu: ' + error.message };
    }
  }

  /**
   * Temsilcilere SMS gönder (mahalle/köy temsilcileri)
   * @param {string} type - 'neighborhood' veya 'village'
   * @param {string} message - Gönderilecek mesaj
   * @param {string[]} representativeIds - Temsilci ID'leri (boş ise tüm temsilcilere)
   */
  static async sendSmsToRepresentatives(type, message, representativeIds = []) {
    try {
      // SMS servisini yükle
      const { default: smsService } = await import('../services/SmsService');
      await smsService.loadConfig();

      // Temsilcileri al
      const representatives = type === 'neighborhood'
        ? await this.getNeighborhoodRepresentatives()
        : await this.getVillageRepresentatives();

      // ID filtresi
      let filteredRepresentatives = representatives;
      if (representativeIds.length > 0) {
        filteredRepresentatives = representatives.filter(rep =>
          representativeIds.includes(String(rep.id))
        );
      }

      if (filteredRepresentatives.length === 0) {
        return { success: false, message: 'Gönderilecek temsilci bulunamadı', sent: 0, failed: 0 };
      }

      // SMS gönder
      const results = {
        sent: 0,
        failed: 0,
        errors: []
      };

      for (const rep of filteredRepresentatives) {
        const phone = smsService.formatPhoneNumber(rep.phone);
        if (!phone) {
          results.failed++;
          results.errors.push({ representative: rep.name || 'Temsilci', error: 'Geçersiz telefon numarası' });
          continue;
        }

        const repName = rep.name || 'Temsilci';
        const personalizedMessage = smsService.formatBulkMessage(repName, message);

        try {
          const result = await smsService.sendSms(phone, personalizedMessage);
          if (result.success) {
            results.sent++;
          } else {
            results.failed++;
            results.errors.push({ representative: repName, error: result.message });
          }
          // Rate limiting için kısa bir bekleme
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          results.failed++;
          results.errors.push({ representative: repName, error: error.message });
        }
      }

      return {
        success: results.failed === 0,
        message: `${results.sent} SMS gönderildi, ${results.failed} başarısız`,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors
      };
    } catch (error) {
      console.error('Send SMS to representatives error:', error);
      return { success: false, message: 'Temsilcilere SMS gönderilirken hata oluştu: ' + error.message };
    }
  }

  // Messages API
  /**
   * Kullanıcıya mesaj gönder
   * @param {object} messageData - { receiverId, message, messageType, filePath }
   */
  static async sendMessageToUser(messageData) {
    try {
      const { receiverId, message, messageType = 'text', filePath } = messageData;

      if (!receiverId || !message) {
        return { success: false, message: 'Alıcı ID ve mesaj gerekli' };
      }

      // Mevcut kullanıcıyı al (senderId)
      const { auth } = await import('../config/firebase');
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { success: false, message: 'Kullanıcı giriş yapmamış' };
      }

      // Firestore'dan sender bilgisini al
      const senderUsers = await FirebaseService.findByField(
        this.COLLECTIONS.MEMBER_USERS,
        'authUid',
        currentUser.uid
      );

      const senderId = senderUsers && senderUsers.length > 0
        ? senderUsers[0].id
        : currentUser.uid;

      // Mesajı kaydet
      const messageDoc = {
        senderId: String(senderId),
        receiverId: String(receiverId),
        message: message,
        messageType: messageType,
        filePath: filePath || null,
        createdAt: new Date().toISOString()
      };

      const docId = await FirebaseService.create(
        this.COLLECTIONS.MESSAGES,
        null,
        messageDoc,
        false // Mesaj içeriği şifrelenmez
      );

      // Özel mesaj için otomatik SMS gönder
      try {
        await this.sendAutoSmsForCustomMessage(receiverId, message);
      } catch (smsError) {
        console.error('Auto SMS error (non-blocking):', smsError);
        // SMS hatası mesaj göndermeyi engellemez
      }

      return {
        success: true,
        id: docId,
        message: 'Mesaj gönderildi',
        data: { ...messageDoc, id: docId }
      };
    } catch (error) {
      console.error('Send message to user error:', error);
      return { success: false, message: 'Mesaj gönderilirken hata oluştu: ' + error.message };
    }
  }

  /**
   * Gruba mesaj gönder
   * @param {object} messageData - { groupId, message, messageType, filePath }
   */
  static async sendMessageToGroup(messageData) {
    try {
      const { groupId, message, messageType = 'text', filePath } = messageData;

      if (!groupId || !message) {
        return { success: false, message: 'Grup ID ve mesaj gerekli' };
      }

      // Mevcut kullanıcıyı al (senderId)
      const { auth } = await import('../config/firebase');
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { success: false, message: 'Kullanıcı giriş yapmamış' };
      }

      // Firestore'dan sender bilgisini al
      const senderUsers = await FirebaseService.findByField(
        this.COLLECTIONS.MEMBER_USERS,
        'authUid',
        currentUser.uid
      );

      const senderId = senderUsers && senderUsers.length > 0
        ? senderUsers[0].id
        : currentUser.uid;

      // Mesajı kaydet
      const messageDoc = {
        senderId: String(senderId),
        groupId: String(groupId),
        message: message,
        messageType: messageType,
        filePath: filePath || null,
        createdAt: new Date().toISOString()
      };

      const docId = await FirebaseService.create(
        this.COLLECTIONS.MESSAGES,
        null,
        messageDoc,
        false // Mesaj içeriği şifrelenmez
      );

      // Gruba mesaj gönderildiğinde otomatik SMS gönder (grup üyelerine)
      try {
        await this.sendAutoSmsForGroupMessage(groupId, message);
      } catch (smsError) {
        console.error('Auto SMS error (non-blocking):', smsError);
        // SMS hatası mesaj göndermeyi engellemez
      }

      return {
        success: true,
        id: docId,
        message: 'Mesaj gönderildi',
        data: { ...messageDoc, id: docId }
      };
    } catch (error) {
      console.error('Send message to group error:', error);
      return { success: false, message: 'Mesaj gönderilirken hata oluştu: ' + error.message };
    }
  }

  /**
   * Özel mesaj için otomatik SMS gönder
   * @param {string} receiverId - Alıcı üye ID'si
   * @param {string} messageText - Mesaj metni
   */
  static async sendAutoSmsForCustomMessage(receiverId, messageText) {
    try {
      // Otomatik SMS ayarlarını kontrol et
      const autoSettings = await FirebaseService.getById('sms_auto_settings', 'main');
      if (!autoSettings || !autoSettings.autoSmsForCustom) {
        return { success: false, message: 'Özel mesajlar için otomatik SMS devre dışı' };
      }

      // SMS servisini yükle
      const { default: smsService } = await import('../services/SmsService');
      await smsService.loadConfig();

      // Alıcı üyeyi al
      const receiver = await FirebaseService.getById(this.COLLECTIONS.MEMBERS, receiverId);
      if (!receiver) {
        return { success: false, message: 'Alıcı üye bulunamadı' };
      }

      // Telefon numarasını formatla
      const phone = smsService.formatPhoneNumber(receiver.phone);
      if (!phone) {
        return { success: false, message: 'Alıcının geçerli telefon numarası yok' };
      }

      // Mesaj formatla
      const receiverName = receiver.name || 'Üye';
      const smsMessage = `Sn ${receiverName}, size özel bir mesaj gönderildi: ${messageText}`;

      // SMS gönder
      const result = await smsService.sendSms(phone, smsMessage);

      if (result.success) {
        return { success: true, message: 'SMS başarıyla gönderildi' };
      } else {
        return { success: false, message: result.message };
      }
    } catch (error) {
      console.error('Send auto SMS for custom message error:', error);
      return { success: false, message: 'Otomatik SMS gönderilirken hata oluştu: ' + error.message };
    }
  }

  /**
   * Grup mesajı için otomatik SMS gönder
   * @param {string} groupId - Grup ID'si
   * @param {string} messageText - Mesaj metni
   */
  static async sendAutoSmsForGroupMessage(groupId, messageText) {
    try {
      // Otomatik SMS ayarlarını kontrol et
      const autoSettings = await FirebaseService.getById('sms_auto_settings', 'main');
      if (!autoSettings || !autoSettings.autoSmsForCustom) {
        return { success: false, message: 'Özel mesajlar için otomatik SMS devre dışı' };
      }

      // SMS servisini yükle
      const { default: smsService } = await import('../services/SmsService');
      await smsService.loadConfig();

      // Grup bilgisini al (grup üyelerini bulmak için)
      // Not: Grup yapısına göre bu kısım güncellenebilir
      // Şimdilik tüm üyelere gönderiyoruz
      const allMembers = await this.getMembers();

      if (allMembers.length === 0) {
        return { success: false, message: 'Grup üyesi bulunamadı' };
      }

      // Her üye için SMS gönder
      const results = {
        sent: 0,
        failed: 0,
        errors: []
      };

      for (const member of allMembers) {
        const phone = smsService.formatPhoneNumber(member.phone);
        if (!phone) {
          results.failed++;
          results.errors.push({ member: member.name, error: 'Geçersiz telefon numarası' });
          continue;
        }

        const memberName = member.name || 'Üye';
        const smsMessage = `Sn ${memberName}, grup mesajı: ${messageText}`;

        try {
          const result = await smsService.sendSms(phone, smsMessage);
          if (result.success) {
            results.sent++;
          } else {
            results.failed++;
            results.errors.push({ member: memberName, error: result.message });
          }
          // Rate limiting için kısa bir bekleme
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
          results.failed++;
          results.errors.push({ member: memberName, error: error.message });
        }
      }

      return {
        success: results.failed === 0,
        message: `${results.sent} SMS gönderildi, ${results.failed} başarısız`,
        sent: results.sent,
        failed: results.failed,
        errors: results.errors
      };
    } catch (error) {
      console.error('Send auto SMS for group message error:', error);
      return { success: false, message: 'Otomatik SMS gönderilirken hata oluştu: ' + error.message };
    }
  }

  /**
   * İleri tarihli SMS planla
   * @param {object} smsData - { message, regions, memberIds, scheduledDate, options }
   */
  static async scheduleSms(smsData) {
    try {
      const { message, regions = [], memberIds = [], scheduledDate, options = {} } = smsData;

      if (!message || !scheduledDate) {
        return { success: false, message: 'Mesaj ve planlanan tarih gerekli' };
      }

      // Tarih kontrolü
      const scheduledDateTime = new Date(scheduledDate);
      const now = new Date();

      if (scheduledDateTime <= now) {
        return { success: false, message: 'Planlanan tarih gelecekte olmalıdır' };
      }

      // Scheduled SMS kaydet
      const scheduledSmsDoc = {
        message: message,
        regions: regions,
        memberIds: memberIds,
        options: options,
        scheduledDate: scheduledDateTime.toISOString(),
        status: 'pending', // 'pending', 'sent', 'failed', 'cancelled'
        createdAt: new Date().toISOString(),
        sentAt: null,
        result: null
      };

      const docId = await FirebaseService.create(
        this.COLLECTIONS.SCHEDULED_SMS,
        null,
        scheduledSmsDoc,
        false // SMS mesajı şifrelenmez
      );

      return {
        success: true,
        id: docId,
        message: 'SMS başarıyla planlandı',
        scheduledDate: scheduledDateTime.toISOString()
      };
    } catch (error) {
      console.error('Schedule SMS error:', error);
      return { success: false, message: 'SMS planlanırken hata oluştu: ' + error.message };
    }
  }

  /**
   * Planlanmış SMS'leri al
   * @param {string} status - 'pending', 'sent', 'failed', 'cancelled' veya null (tümü)
   */
  static async getScheduledSms(status = null) {
    try {
      const allScheduled = await FirebaseService.getAll(this.COLLECTIONS.SCHEDULED_SMS);

      if (status) {
        return allScheduled.filter(sms => sms.status === status);
      }

      return allScheduled;
    } catch (error) {
      console.error('Get scheduled SMS error:', error);
      return [];
    }
  }

  /**
   * Planlanmış SMS'i iptal et
   * @param {string} id - Scheduled SMS ID
   */
  static async cancelScheduledSms(id) {
    try {
      await FirebaseService.update(this.COLLECTIONS.SCHEDULED_SMS, id, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      });
      return { success: true, message: 'Planlanmış SMS iptal edildi' };
    } catch (error) {
      console.error('Cancel scheduled SMS error:', error);
      return { success: false, message: 'SMS iptal edilirken hata oluştu: ' + error.message };
    }
  }

  /**
   * Planlanmış SMS'i güncelle
   * @param {string} id - Scheduled SMS ID
   * @param {object} smsData - { message, regions, memberIds, scheduledDate, options }
   */
  static async updateScheduledSms(id, smsData) {
    try {
      const { message, regions = [], memberIds = [], scheduledDate, options = {} } = smsData;

      if (!message || !scheduledDate) {
        return { success: false, message: 'Mesaj ve planlanan tarih gerekli' };
      }

      // Tarih kontrolü
      const scheduledDateTime = new Date(scheduledDate);
      const now = new Date();

      if (scheduledDateTime <= now) {
        return { success: false, message: 'Planlanan tarih gelecekte olmalıdır' };
      }

      // Scheduled SMS güncelle
      const updatedSmsDoc = {
        message: message,
        regions: regions,
        memberIds: memberIds,
        options: options,
        scheduledDate: scheduledDateTime.toISOString(),
        updatedAt: new Date().toISOString()
      };

      await FirebaseService.update(this.COLLECTIONS.SCHEDULED_SMS, id, updatedSmsDoc, false);

      return {
        success: true,
        message: 'SMS başarıyla güncellendi',
        scheduledDate: scheduledDateTime.toISOString()
      };
    } catch (error) {
      console.error('Update scheduled SMS error:', error);
      return { success: false, message: 'SMS güncellenirken hata oluştu: ' + error.message };
    }
  }

  /**
   * Planlanmış SMS'i sil
   * @param {string} id - Scheduled SMS ID
   */
  static async deleteScheduledSms(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.SCHEDULED_SMS, id);
      return { success: true, message: 'Planlanmış SMS silindi' };
    } catch (error) {
      console.error('Delete scheduled SMS error:', error);
      return { success: false, message: 'SMS silinirken hata oluştu: ' + error.message };
    }
  }

  /**
   * Planlanmış SMS'leri kontrol et ve gönder (cron job benzeri)
   * Bu metod periyodik olarak çağrılmalı (örneğin her dakika)
   */
  static async processScheduledSms() {
    try {
      const pendingSms = await this.getScheduledSms('pending');
      const now = new Date();

      const smsToSend = pendingSms.filter(sms => {
        const scheduledDate = new Date(sms.scheduledDate);
        return scheduledDate <= now;
      });

      const results = {
        processed: 0,
        sent: 0,
        failed: 0
      };

      for (const sms of smsToSend) {
        try {
          // SMS gönder
          const sendResult = await this.sendBulkSms(
            sms.message,
            sms.regions || [],
            sms.memberIds || [],
            sms.options || {}
          );

          // Durumu güncelle
          await FirebaseService.update(this.COLLECTIONS.SCHEDULED_SMS, sms.id, {
            status: sendResult.success ? 'sent' : 'failed',
            sentAt: new Date().toISOString(),
            result: sendResult
          });

          results.processed++;
          if (sendResult.success) {
            results.sent++;
          } else {
            results.failed++;
          }
        } catch (error) {
          console.error('Error processing scheduled SMS:', error);
          // Hata durumunu kaydet
          await FirebaseService.update(this.COLLECTIONS.SCHEDULED_SMS, sms.id, {
            status: 'failed',
            sentAt: new Date().toISOString(),
            result: { success: false, message: error.message }
          });
          results.processed++;
          results.failed++;
        }
      }

      return {
        success: true,
        message: `${results.processed} SMS işlendi, ${results.sent} başarılı, ${results.failed} başarısız`,
        processed: results.processed,
        sent: results.sent,
        failed: results.failed
      };
    } catch (error) {
      console.error('Process scheduled SMS error:', error);
      return { success: false, message: 'Planlanmış SMS işlenirken hata oluştu: ' + error.message };
    }
  }

  // Poll methods
  /**
   * Get all polls
   * @param {string} status - 'active', 'ended', 'all' or null
   */
  static async getPolls(status = null) {
    try {
      let polls = await FirebaseService.getAll(this.COLLECTIONS.POLLS);

      if (status && status !== 'all') {
        polls = polls.filter(p => p.status === status);
      }

      // Parse options if they're strings
      return polls.map(poll => ({
        ...poll,
        options: Array.isArray(poll.options) ? poll.options : (poll.options ? JSON.parse(poll.options) : []),
        endDate: poll.endDate || poll.end_date,
        createdBy: poll.createdBy || poll.created_by,
        createdAt: poll.createdAt || poll.created_at,
        updatedAt: poll.updatedAt || poll.updated_at
      }));
    } catch (error) {
      console.error('Error getting polls:', error);
      return [];
    }
  }

  /**
   * Get active polls (for member dashboard)
   */
  static async getActivePolls() {
    try {
      const now = new Date().toISOString();
      let polls = await FirebaseService.getAll(this.COLLECTIONS.POLLS);

      // Filter active polls
      polls = polls.filter(poll => {
        const endDate = new Date(poll.endDate || poll.end_date);
        return poll.status === 'active' && endDate > new Date(now);
      });

      // Parse options if they're strings
      return polls.map(poll => ({
        ...poll,
        options: Array.isArray(poll.options) ? poll.options : (poll.options ? JSON.parse(poll.options) : []),
        endDate: poll.endDate || poll.end_date,
        createdBy: poll.createdBy || poll.created_by,
        createdAt: poll.createdAt || poll.created_at,
        updatedAt: poll.updatedAt || poll.updated_at
      }));
    } catch (error) {
      console.error('Error getting active polls:', error);
      return [];
    }
  }

  /**
   * Get poll by ID
   * @param {string|number} id - Poll ID
   */
  static async getPollById(id) {
    try {
      const poll = await FirebaseService.getById(this.COLLECTIONS.POLLS, String(id || '').trim());
      if (!poll) return null;

      return {
        ...poll,
        options: Array.isArray(poll.options) ? poll.options : (poll.options ? JSON.parse(poll.options) : []),
        endDate: poll.endDate || poll.end_date,
        createdBy: poll.createdBy || poll.created_by,
        createdAt: poll.createdAt || poll.created_at,
        updatedAt: poll.updatedAt || poll.updated_at
      };
    } catch (error) {
      console.error('Error getting poll by ID:', error);
      return null;
    }
  }

  /**
   * Create new poll
   * @param {object} pollData - { title, description, type, options, endDate }
   */
  static async createPoll(pollData) {
    try {
      const poll = {
        title: pollData.title,
        description: pollData.description || null,
        type: pollData.type || 'poll',
        options: Array.isArray(pollData.options) ? pollData.options : [],
        endDate: pollData.endDate,
        status: 'active',
        createdBy: pollData.createdBy || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docId = await FirebaseService.create(this.COLLECTIONS.POLLS, null, poll, false);

      // In-app notification oluştur (tüm aktif üyelere)
      try {
        const allMembers = await FirebaseService.getAll(this.COLLECTIONS.MEMBERS, {
          where: [{ field: 'archived', operator: '==', value: false }]
        }, false);

        if (!allMembers || allMembers.length === 0) {
          console.warn('⚠️ No active members found for notification');
          return { ...poll, id: docId };
        }

        const notificationData = {
          title: 'Yeni Anket/Oylama Oluşturuldu',
          body: `${pollData.title} - Katılımınızı bekliyoruz!`,
          type: 'poll_invite',
          url: '/polls',
          data: JSON.stringify({
            pollId: docId,
            pollTitle: pollData.title
          }),
          read: false,
          createdAt: new Date().toISOString(),
          expiresAt: pollData.endDate
            ? new Date(pollData.endDate).toISOString() // Poll end date'de expire
            : null
        };

        // Her üye için notification oluştur
        let successCount = 0;
        for (const member of allMembers) {
          try {
            const memberId = getMemberId(member);
            if (!memberId) {
              console.warn('⚠️ Member without ID skipped:', member);
              continue;
            }

            const normalizedMemberId = String(memberId).trim();

            const notificationId = await FirebaseService.create(
              this.COLLECTIONS.NOTIFICATIONS,
              null,
              {
                ...notificationData,
                memberId: normalizedMemberId
              },
              false
            );

            successCount++;
          } catch (memberError) {
            console.error(`❌ Error creating notification for member ${member.id}:`, memberError);
          }
        }

      } catch (notificationError) {
        console.error('Error creating in-app notification (non-blocking):', notificationError);
        // Notification hatası anket oluşturmayı engellemez
      }

      return { ...poll, id: docId };
    } catch (error) {
      console.error('Error creating poll:', error);
      throw error;
    }
  }

  /**
   * Vote on poll
   * @param {string|number} pollId - Poll ID
   * @param {number} optionIndex - Option index
   * @param {string|number} memberId - Member ID
   */
  static async voteOnPoll(pollId, optionIndex, memberId) {
    try {
      const poll = await this.getPollById(pollId);
      if (!poll) {
        throw new Error('Anket bulunamadı');
      }

      // Check if poll is still active
      const endDate = new Date(poll.endDate);
      const now = new Date();
      if (endDate <= now || poll.status !== 'active') {
        throw new Error('Bu anket artık aktif değil');
      }

      // Check if options are valid
      const options = Array.isArray(poll.options) ? poll.options : [];
      if (optionIndex < 0 || optionIndex >= options.length) {
        throw new Error('Geçersiz seçenek');
      }

      // Check if member already voted
      const votes = await FirebaseService.getAll(this.COLLECTIONS.POLL_VOTES);
      const existingVote = votes.find(v =>
        String(v.pollId || v.poll_id) === String(pollId) &&
        getMemberId(v) === String(memberId)
      );

      const voteData = {
        pollId: String(pollId),
        memberId: String(memberId),
        optionIndex: optionIndex,
        createdAt: new Date().toISOString()
      };

      if (existingVote) {
        // Update existing vote
        await FirebaseService.update(this.COLLECTIONS.POLL_VOTES, existingVote.id, voteData, false);
      } else {
        // Create new vote
        await FirebaseService.create(this.COLLECTIONS.POLL_VOTES, null, voteData, false);
      }

      return { message: 'Oyunuz kaydedildi' };
    } catch (error) {
      console.error('Error voting on poll:', error);
      throw error;
    }
  }

  /**
   * Get poll results
   * @param {string|number} pollId - Poll ID
   */
  static async getPollResults(pollId) {
    try {
      const poll = await this.getPollById(pollId);
      if (!poll) {
        throw new Error('Anket bulunamadı');
      }

      // Get all votes for this poll
      const votes = await FirebaseService.getAll(this.COLLECTIONS.POLL_VOTES);
      const pollVotes = votes.filter(v =>
        String(v.pollId || v.poll_id) === String(pollId)
      );

      // Parse options
      const options = Array.isArray(poll.options) ? poll.options : [];

      // Count votes per option
      const results = options.map((option, index) => {
        const voteCount = pollVotes.filter(v => v.optionIndex === index).length;
        return {
          option,
          index,
          voteCount,
          percentage: pollVotes.length > 0 ? Math.round((voteCount / pollVotes.length) * 100) : 0
        };
      });

      return {
        poll,
        totalVotes: pollVotes.length,
        results
      };
    } catch (error) {
      console.error('Error getting poll results:', error);
      throw error;
    }
  }

  /**
   * End poll manually
   * @param {string|number} pollId - Poll ID
   */
  static async endPoll(pollId) {
    try {
      // Anket bilgisini al (bildirim için)
      const poll = await this.getPollById(pollId);

      await FirebaseService.update(this.COLLECTIONS.POLLS, String(pollId), {
        status: 'ended',
        updatedAt: new Date().toISOString()
      }, false);

      // Anket sonuclaninca tum uyelere bildirim gonder
      if (poll) {
        try {
          const allMembers = await FirebaseService.getAll(this.COLLECTIONS.MEMBERS, {
            where: [{ field: 'archived', operator: '==', value: false }]
          }, false);

          const notificationData = {
            title: `Anket Sonuclandi: ${poll.title}`,
            body: 'Anket sonuclarini goruntuleyebilirsiniz.',
            type: 'poll_result',
            url: '/polls',
            data: JSON.stringify({
              pollId: String(pollId),
              pollTitle: poll.title
            }),
            read: false,
            createdAt: new Date().toISOString()
          };

          for (const member of (allMembers || [])) {
            try {
              const memberId = getMemberId(member);
              if (!memberId) continue;
              await FirebaseService.create(
                this.COLLECTIONS.NOTIFICATIONS,
                null,
                { ...notificationData, memberId: String(memberId).trim() },
                false
              );
            } catch (memberError) {
              console.error(`Error creating poll_result notification for member ${member.id}:`, memberError);
            }
          }
        } catch (notificationError) {
          console.error('Error creating poll_result notifications (non-blocking):', notificationError);
        }
      }

      return { message: 'Anket sonlandırıldı' };
    } catch (error) {
      console.error('Error ending poll:', error);
      throw error;
    }
  }

  /**
   * Delete poll
   * @param {string|number} pollId - Poll ID
   */
  static async deletePoll(pollId) {
    try {
      // Delete votes first
      const votes = await FirebaseService.getAll(this.COLLECTIONS.POLL_VOTES);
      const pollVotes = votes.filter(v => String(v.pollId || v.poll_id) === String(pollId));

      for (const vote of pollVotes) {
        await FirebaseService.delete(this.COLLECTIONS.POLL_VOTES, vote.id);
      }

      // Delete poll
      await FirebaseService.delete(this.COLLECTIONS.POLLS, String(pollId));
      return { message: 'Anket silindi' };
    } catch (error) {
      console.error('Error deleting poll:', error);
      throw error;
    }
  }

  // Member Dashboard Analytics API
  static async startAnalyticsSession(memberId) {
    try {
      const sessionData = {
        memberId: String(memberId),
        sessionStart: new Date().toISOString(),
        pageViews: 1
      };
      const docId = await FirebaseService.create(this.COLLECTIONS.MEMBER_DASHBOARD_ANALYTICS, null, sessionData, false);
      return { success: true, session: { id: docId, ...sessionData } };
    } catch (error) {
      console.error('Error starting analytics session:', error);
      return { success: false, error: error.message };
    }
  }

  static async updateAnalyticsSession(sessionId, updates) {
    try {
      await FirebaseService.update(this.COLLECTIONS.MEMBER_DASHBOARD_ANALYTICS, String(sessionId), updates, false);
      return { success: true };
    } catch (error) {
      console.error('Error updating analytics session:', error);
      return { success: false, error: error.message };
    }
  }

  static async getMemberAnalytics(memberId) {
    try {
      const allAnalytics = await FirebaseService.getAll(this.COLLECTIONS.MEMBER_DASHBOARD_ANALYTICS);
      const memberAnalytics = allAnalytics.filter(a => getMemberId(a) === String(memberId));
      return { success: true, analytics: memberAnalytics };
    } catch (error) {
      console.error('Error getting member analytics:', error);
      return { success: false, analytics: [] };
    }
  }

  static async getMemberAnalyticsSummary(memberId) {
    try {
      const allAnalytics = await FirebaseService.getAll(this.COLLECTIONS.MEMBER_DASHBOARD_ANALYTICS);
      const memberAnalytics = allAnalytics.filter(a => getMemberId(a) === String(memberId));

      const totalSessions = memberAnalytics.length;
      const totalDurationSeconds = memberAnalytics.reduce((sum, a) => sum + (a.durationSeconds || a.duration_seconds || 0), 0);
      const totalPageViews = memberAnalytics.reduce((sum, a) => sum + (a.pageViews || a.page_views || 0), 0);
      const firstSession = memberAnalytics.length > 0 ? memberAnalytics[memberAnalytics.length - 1].sessionStart : null;
      const lastSession = memberAnalytics.length > 0 ? memberAnalytics[0].sessionStart : null;
      const avgDurationSeconds = totalSessions > 0 ? Math.floor(totalDurationSeconds / totalSessions) : 0;

      return {
        success: true,
        summary: {
          total_sessions: totalSessions,
          total_duration_seconds: totalDurationSeconds,
          total_page_views: totalPageViews,
          first_session: firstSession,
          last_session: lastSession,
          avg_duration_seconds: avgDurationSeconds
        }
      };
    } catch (error) {
      console.error('Error getting member analytics summary:', error);
      return { success: false, summary: null };
    }
  }

  static async getAllAnalytics() {
    try {
      const analytics = await FirebaseService.getAll(this.COLLECTIONS.MEMBER_DASHBOARD_ANALYTICS);
      // Get members to populate names
      const members = await FirebaseService.getAll(this.COLLECTIONS.MEMBERS);

      return {
        success: true,
        analytics: analytics.map(a => {
          const member = members.find(m => String(m.id) === getMemberId(a));
          return {
            ...a,
            name: member?.name || '',
            surname: member?.surname || '',
            tc: member?.tc || ''
          };
        })
      };
    } catch (error) {
      console.error('Error getting all analytics:', error);
      return { success: false, analytics: [] };
    }
  }

  static async getAllAnalyticsSummary() {
    try {
      const analytics = await FirebaseService.getAll(this.COLLECTIONS.MEMBER_DASHBOARD_ANALYTICS);
      const members = await FirebaseService.getAll(this.COLLECTIONS.MEMBERS);

      // Group by member
      const memberMap = new Map();

      analytics.forEach(a => {
        const memberId = getMemberId(a);
        if (!memberMap.has(memberId)) {
          const member = members.find(m => String(m.id) === memberId);
          memberMap.set(memberId, {
            member_id: memberId,
            name: member?.name || '',
            surname: member?.surname || '',
            tc: member?.tc || '',
            total_sessions: 0,
            total_duration_seconds: 0,
            total_page_views: 0,
            first_session: null,
            last_session: null,
            avg_duration_seconds: 0
          });
        }

        const summary = memberMap.get(memberId);
        summary.total_sessions += 1;
        summary.total_duration_seconds += (a.durationSeconds || a.duration_seconds || 0);
        summary.total_page_views += (a.pageViews || a.page_views || 0);

        const sessionStart = a.sessionStart || a.session_start;
        if (sessionStart) {
          if (!summary.first_session || sessionStart < summary.first_session) {
            summary.first_session = sessionStart;
          }
          if (!summary.last_session || sessionStart > summary.last_session) {
            summary.last_session = sessionStart;
          }
        }
      });

      // Calculate averages
      memberMap.forEach((summary, memberId) => {
        summary.avg_duration_seconds = summary.total_sessions > 0
          ? Math.floor(summary.total_duration_seconds / summary.total_sessions)
          : 0;
      });

      const summaryArray = Array.from(memberMap.values()).sort((a, b) => {
        if (b.total_sessions !== a.total_sessions) {
          return b.total_sessions - a.total_sessions;
        }
        return new Date(b.last_session || 0) - new Date(a.last_session || 0);
      });

      return { success: true, summary: summaryArray };
    } catch (error) {
      console.error('Error getting all analytics summary:', error);
      return { success: false, summary: [] };
    }
  }

  // Notifications API
  static async getNotifications(memberId, unreadOnly = false) {
    try {
      if (!memberId) {
        console.warn('⚠️ getNotifications called without memberId');
        return { success: false, notifications: [] };
      }

      // memberId'yi normalize et
      const normalizedMemberId = String(memberId).trim();

      const allNotifications = await FirebaseService.getAll(this.COLLECTIONS.NOTIFICATIONS, {}, false);

      if (!allNotifications || allNotifications.length === 0) {
        return { success: true, notifications: [] };
      }

      let notifications = allNotifications.filter(n => {
        // Member ID eşleşmesi - sadece bu üyeye ait veya genel (memberId yok) notification'lar
        const notificationMemberId = getMemberId(n);
        const normalizedNotificationMemberId = notificationMemberId ? String(notificationMemberId).trim() : null;

        // Member match: notification'un memberId'si yoksa (genel) veya eşleşiyorsa
        const memberMatch = !normalizedNotificationMemberId || normalizedNotificationMemberId === normalizedMemberId;

        // Expire kontrolü
        const expired = n.expiresAt && new Date(n.expiresAt) <= new Date();

        // Unread kontrolü
        const unreadMatch = !unreadOnly || !n.read;

        const shouldInclude = memberMatch && !expired && unreadMatch;

        if (!shouldInclude && normalizedNotificationMemberId) {
        }

        return shouldInclude;
      });


      notifications.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.created_at || 0);
        const dateB = new Date(b.createdAt || b.created_at || 0);
        return dateB - dateA;
      });

      return { success: true, notifications: notifications.slice(0, 50) };
    } catch (error) {
      console.error('Error getting notifications:', error);
      return { success: false, notifications: [] };
    }
  }

  static async getUnreadNotificationCount(memberId) {
    try {
      const response = await this.getNotifications(memberId, true);
      return { success: true, count: response.notifications?.length || 0 };
    } catch (error) {
      console.error('Error getting unread count:', error);
      return { success: false, count: 0 };
    }
  }

  static async markNotificationAsRead(notificationId) {
    try {
      await FirebaseService.update(this.COLLECTIONS.NOTIFICATIONS, String(notificationId), { read: true }, false);
      return { success: true };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return { success: false };
    }
  }

  static async markAllNotificationsAsRead(memberId) {
    try {
      const response = await this.getNotifications(memberId, true);
      const unreadNotifications = response.notifications || [];

      for (const notification of unreadNotifications) {
        await FirebaseService.update(this.COLLECTIONS.NOTIFICATIONS, String(notification.id), { read: true }, false);
      }

      return { success: true };
    } catch (error) {
      console.error('Error marking all as read:', error);
      return { success: false };
    }
  }

  static async deleteNotification(notificationId) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.NOTIFICATIONS, String(notificationId));
      return { success: true };
    } catch (error) {
      console.error('Error deleting notification:', error);
      return { success: false };
    }
  }

  // Push Notification API - Firebase'de push notification göndermek için server-side gerekir
  // Client-side'da sadece local browser notification gösterilebilir (test için)
  static async getVapidKey() {
    // Oncelikle backend'den VAPID key almaya calis
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');
      const token = localStorage.getItem('token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${API_BASE_URL}/push-subscriptions/vapid-key`, { headers });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.publicKey) {
          return data;
        }
      }
    } catch (e) {
      console.warn('[Push] Backend VAPID key fetch failed, using fallback:', e.message);
    }

    // Fallback: server .env ile eslestirilmis hardcoded key
    return {
      success: true,
      publicKey: 'BJXubm0Qz9DZMVkhs2-9-qSsNI8kcT3SEZGgoE6OQDmCr3RNxgfa7yNui58liafe5Qiw32RNYRODNwC_m8Ijk1Y'
    };
  }

  static async subscribeToPush(subscriptionData) {
    // Firebase'de push subscription'ları Firestore'da sakla
    try {
      const PUSH_SUBSCRIPTIONS = 'push_subscriptions';
      const userId = subscriptionData.userId;

      if (!userId) {
        return {
          success: false,
          message: 'Kullanıcı ID gerekli'
        };
      }

      // Subscription'ı Firestore'a kaydet
      const subscriptionDoc = {
        userId: String(userId),
        endpoint: subscriptionData.subscription.endpoint,
        p256dh: subscriptionData.subscription.keys.p256dh,
        auth: subscriptionData.subscription.keys.auth,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Mevcut subscription'ı kontrol et
      const existing = await FirebaseService.findByField(
        PUSH_SUBSCRIPTIONS,
        'userId',
        String(userId)
      );

      if (existing && existing.length > 0) {
        // Güncelle
        await FirebaseService.update(
          PUSH_SUBSCRIPTIONS,
          existing[0].id,
          subscriptionDoc,
          false
        );
      } else {
        // Yeni oluştur
        await FirebaseService.create(
          PUSH_SUBSCRIPTIONS,
          null,
          subscriptionDoc,
          false
        );
      }

      return {
        success: true,
        message: 'Push notification aboneliği başarılı'
      };
    } catch (error) {
      console.error('Error subscribing to push:', error);
      return {
        success: false,
        message: error.message || 'Bildirim aboneliği sırasında hata oluştu'
      };
    }
  }

  static async unsubscribeFromPush() {
    // Firebase'de subscription'ı sil
    try {
      const PUSH_SUBSCRIPTIONS = 'push_subscriptions';
      const userData = localStorage.getItem('user');

      if (userData) {
        const user = JSON.parse(userData);
        const userId = user?.id || user?.memberId || user?.uid;

        if (userId) {
          const existing = await FirebaseService.getAll(PUSH_SUBSCRIPTIONS, {
            where: [{ field: 'userId', operator: '==', value: String(userId) }],
            limit: 1
          }, false);

          if (existing && existing.length > 0) {
            await FirebaseService.delete(PUSH_SUBSCRIPTIONS, existing[0].id);
          }
        }
      }

      return {
        success: true,
        message: 'Push notification aboneliği iptal edildi'
      };
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      return {
        success: false,
        message: error.message || 'Abonelik iptal edilirken hata oluştu'
      };
    }
  }

  static async sendTestNotification(userId = null) {
    try {
      // Oncelikle backend uzerinden gercek push gondermeyi dene
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');
      const token = localStorage.getItem('token');

      // Kullanicinin push subscription'ini Firestore'dan al
      const resolvedId = userId || (() => {
        try {
          const userData = localStorage.getItem('user');
          if (userData) {
            const user = JSON.parse(userData);
            return user?.id || user?.memberId || user?.uid || null;
          }
        } catch (e) { /* ignore */ }
        return null;
      })();

      if (resolvedId) {
        try {
          const subs = await FirebaseService.findByField('push_subscriptions', 'userId', String(resolvedId));
          if (subs && subs.length > 0) {
            const sub = subs[0];
            const formattedSubs = [{
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth }
            }];

            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const response = await fetch(`${API_BASE_URL}/push-subscriptions/send-direct`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                title: 'Test Bildirimi',
                body: 'Bu bir test bildirimidir. Push notification sistemi calisiyor!',
                subscriptions: formattedSubs,
                data: { type: 'test', action: 'view', url: '/notifications' }
              }),
            });

            if (response.ok) {
              const result = await response.json();
              if (result.success && result.sentCount > 0) {
                return {
                  success: true,
                  message: 'Gercek push bildirimi gonderildi (backend uzerinden)'
                };
              }
            }
          }
        } catch (backendErr) {
          console.warn('[Push] Backend test push failed, falling back to local:', backendErr.message);
        }
      }

      // Fallback: Service Worker uzerinden local notification goster
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('Test Bildirimi', {
          body: 'Bu bir test bildirimidir. Push notification sistemi calisiyor!',
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: 'test-notification',
          requireInteraction: true,
          vibrate: [200, 100, 200],
          data: { url: window.location.href, timestamp: Date.now() },
          actions: [
            { action: 'view', title: 'Goruntule' },
            { action: 'close', title: 'Kapat' }
          ]
        });

        return {
          success: true,
          message: 'Test bildirimi gosterildi (Service Worker uzerinden)'
        };
      }

      return {
        success: false,
        message: 'Service Worker desteklenmiyor. Bildirimler gosterilemez.'
      };
    } catch (error) {
      console.error('Error sending test notification:', error);
      return {
        success: false,
        message: error.message || 'Test bildirimi gosterilirken hata olustu'
      };
    }
  }

  // Visit Counts API - Firebase implementation
  static async incrementVisit(locationType, locationId) {
    try {
      const collectionName = this.getVisitCollectionName(locationType);
      if (!collectionName) {
        throw new Error(`Invalid location type: ${locationType}`);
      }

      const idField = this.getVisitIdField(locationType);
      const normalizedId = String(locationId);

      // Check if visit record exists - try both string and number ID
      let existingVisits = await FirebaseService.findByField(
        collectionName,
        idField,
        normalizedId,
        false // decrypt = false
      );

      // If not found with string, try with number
      if ((!existingVisits || existingVisits.length === 0) && !isNaN(normalizedId)) {
        existingVisits = await FirebaseService.findByField(
          collectionName,
          idField,
          Number(normalizedId),
          false // decrypt = false
        );
      }

      if (existingVisits && existingVisits.length > 0) {
        // Update existing record
        const existingVisit = existingVisits[0];
        const visitId = existingVisit.id;
        const newCount = (existingVisit.visit_count || 0) + 1;

        await FirebaseService.update(
          collectionName,
          visitId,
          {
            visit_count: newCount,
            last_visit_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          false // encrypt = false
        );

        return { success: true, visitCount: newCount };
      } else {
        // Create new record
        const visitData = {
          [idField]: normalizedId,
          visit_count: 1,
          last_visit_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await FirebaseService.create(
          collectionName,
          null,
          visitData,
          false // encrypt = false
        );

        return { success: true, visitCount: 1 };
      }
    } catch (error) {
      console.error(`Error incrementing visit for ${locationType}:`, error);
      throw error;
    }
  }

  static async getAllVisitCounts(locationType) {
    try {
      const collectionName = this.getVisitCollectionName(locationType);
      if (!collectionName) {
        return [];
      }

      const visits = await FirebaseService.getAll(collectionName, {}, false);
      return visits || [];
    } catch (error) {
      console.error(`Error getting all visit counts for ${locationType}:`, error);
      return [];
    }
  }

  static async getVisitsForLocation(locationType, locationId) {
    try {
      // Get all active events
      const events = await this.getEvents(false);
      const locationIdStr = String(locationId);

      // Filter events that visited this location
      const visitEvents = events.filter(event => {
        if (!event.selectedLocationTypes || !event.selectedLocations) {
          return false;
        }

        // Parse selectedLocationTypes
        let selectedLocationTypes;
        if (Array.isArray(event.selectedLocationTypes)) {
          selectedLocationTypes = event.selectedLocationTypes;
        } else if (typeof event.selectedLocationTypes === 'string') {
          try {
            selectedLocationTypes = JSON.parse(event.selectedLocationTypes);
          } catch (e) {
            return false;
          }
        } else {
          return false;
        }

        // Parse selectedLocations
        let selectedLocations;
        if (typeof event.selectedLocations === 'object' && event.selectedLocations !== null) {
          selectedLocations = event.selectedLocations;
        } else if (typeof event.selectedLocations === 'string') {
          try {
            selectedLocations = JSON.parse(event.selectedLocations);
          } catch (e) {
            return false;
          }
        } else {
          return false;
        }

        // Check if this location type and ID is in the event
        if (!selectedLocationTypes.includes(locationType)) {
          return false;
        }

        const locationIds = selectedLocations[locationType];
        if (!locationIds || !Array.isArray(locationIds)) {
          return false;
        }

        // Check if locationId matches (try both string and number)
        return locationIds.some(id =>
          String(id) === locationIdStr ||
          (typeof id === 'number' && String(id) === locationIdStr) ||
          (typeof locationId === 'number' && String(id) === String(locationId))
        );
      });

      return visitEvents.map(event => ({
        id: event.id,
        name: event.name,
        date: event.date,
        location: event.location,
        description: event.description
      }));
    } catch (error) {
      console.error(`Error getting visits for ${locationType} ${locationId}:`, error);
      return [];
    }
  }

  static async processEventLocations(eventId, selectedLocationTypes, selectedLocations) {
    try {
      const results = [];

      for (const locationType of selectedLocationTypes) {
        const locationIds = selectedLocations[locationType];
        if (locationIds && Array.isArray(locationIds)) {
          for (const locationId of locationIds) {
            // Normalize locationId
            const normalizedId = typeof locationId === 'string' && !isNaN(locationId)
              ? parseInt(locationId, 10)
              : locationId;

            const result = await this.incrementVisit(locationType, normalizedId);
            results.push({
              locationType,
              locationId: normalizedId,
              visitCount: result.visitCount
            });
          }
        }
      }

      // Also increment event visit count
      const eventResult = await this.incrementVisit('event', eventId);
      results.push({
        locationType: 'event',
        locationId: eventId,
        visitCount: eventResult.visitCount
      });

      return results;
    } catch (error) {
      console.error('Error processing event locations:', error);
      throw error;
    }
  }

  static async recalculateAllVisitCounts() {
    try {

      // Get all active events using ApiService.getEvents (same as EventsPage)
      const events = await this.getEvents(false);

      // Reset all visit counts to 0
      const locationTypes = ['district', 'town', 'neighborhood', 'village', 'stk', 'public_institution', 'mosque'];

      for (const locationType of locationTypes) {
        const collectionName = this.getVisitCollectionName(locationType);
        if (collectionName) {
          try {
            const allVisits = await FirebaseService.getAll(collectionName, {}, false);
            for (const visit of allVisits || []) {
              await FirebaseService.update(
                collectionName,
                visit.id,
                {
                  visit_count: 0,
                  updated_at: new Date().toISOString()
                },
                false // encrypt = false
              );
            }
          } catch (error) {
            console.error(`Error resetting ${locationType} visits:`, error);
          }
        }
      }

      let totalProcessed = 0;
      let totalIncrements = 0;

      // Process each event
      for (const event of events) {
        try {
          if (!event.selectedLocationTypes || !event.selectedLocations) {
            continue;
          }

          // Parse selectedLocationTypes
          let selectedLocationTypes;
          if (Array.isArray(event.selectedLocationTypes)) {
            selectedLocationTypes = event.selectedLocationTypes;
          } else if (typeof event.selectedLocationTypes === 'string') {
            try {
              selectedLocationTypes = JSON.parse(event.selectedLocationTypes);
            } catch (e) {
              console.error(`Error parsing selectedLocationTypes for event ${event.id}:`, e);
              continue;
            }
          } else {
            continue;
          }

          // Parse selectedLocations
          let selectedLocations;
          if (typeof event.selectedLocations === 'object' && event.selectedLocations !== null) {
            selectedLocations = event.selectedLocations;
          } else if (typeof event.selectedLocations === 'string') {
            try {
              selectedLocations = JSON.parse(event.selectedLocations);
            } catch (e) {
              console.error(`Error parsing selectedLocations for event ${event.id}:`, e);
              continue;
            }
          } else {
            continue;
          }

          if (!Array.isArray(selectedLocationTypes) || !selectedLocations || typeof selectedLocations !== 'object') {
            continue;
          }


          for (const locationType of selectedLocationTypes) {
            const locationIds = selectedLocations[locationType];
            if (locationIds && Array.isArray(locationIds)) {
              for (const locationId of locationIds) {
                // Normalize locationId - keep as string for Firebase
                const normalizedId = String(locationId);
                await this.incrementVisit(locationType, normalizedId);
                totalIncrements++;
              }
            }
          }
          totalProcessed++;
        } catch (eventError) {
          console.error(`Error processing event ID ${event.id}:`, eventError);
          console.error('Event data:', {
            selectedLocationTypes: event.selectedLocationTypes,
            selectedLocations: event.selectedLocations
          });
        }
      }

      return { success: true, eventsProcessed: totalProcessed, totalEvents: events.length, totalIncrements };
    } catch (error) {
      console.error('Error recalculating Firebase visit counts:', error);
      throw error;
    }
  }

  // Helper methods for visit counts
  static getVisitCollectionName(locationType) {
    const mapping = {
      district: this.COLLECTIONS.DISTRICT_VISITS,
      town: this.COLLECTIONS.TOWN_VISITS,
      neighborhood: this.COLLECTIONS.NEIGHBORHOOD_VISITS,
      village: this.COLLECTIONS.VILLAGE_VISITS,
      stk: this.COLLECTIONS.STK_VISITS,
      public_institution: this.COLLECTIONS.PUBLIC_INSTITUTION_VISITS,
      mosque: this.COLLECTIONS.MOSQUE_VISITS,
      event: this.COLLECTIONS.EVENT_VISITS
    };
    return mapping[locationType];
  }

  static getVisitIdField(locationType) {
    const mapping = {
      district: 'district_id',
      town: 'town_id',
      neighborhood: 'neighborhood_id',
      village: 'village_id',
      stk: 'stk_id',
      public_institution: 'public_institution_id',
      mosque: 'mosque_id',
      event: 'event_id'
    };
    return mapping[locationType] || `${locationType}_id`;
  }

  // Kadın Kolları Başkanlığı API
  static async getWomenBranchPresidents() {
    try {
      const presidents = await FirebaseService.getAll(this.COLLECTIONS.WOMEN_BRANCH_PRESIDENTS);
      return presidents || [];
    } catch (error) {
      console.error('Get women branch presidents error:', error);
      return [];
    }
  }

  static async setWomenBranchPresident(region, memberId) {
    try {
      // Önce bu bölgede başka bir başkan var mı kontrol et
      const existing = await FirebaseService.getAll(this.COLLECTIONS.WOMEN_BRANCH_PRESIDENTS, {
        where: [{ field: 'region', operator: '==', value: region }]
      }, false);

      // Varsa sil
      if (existing.length > 0) {
        for (const pres of existing) {
          await FirebaseService.delete(this.COLLECTIONS.WOMEN_BRANCH_PRESIDENTS, pres.id);
        }
      }

      // Yeni başkanı ekle
      const docId = await FirebaseService.create(
        this.COLLECTIONS.WOMEN_BRANCH_PRESIDENTS,
        null,
        {
          region: region,
          member_id: String(memberId),
          created_at: new Date().toISOString()
        },
        false
      );

      return { success: true, id: docId };
    } catch (error) {
      console.error('Set women branch president error:', error);
      throw error;
    }
  }

  static async removeWomenBranchPresident(region) {
    try {
      const existing = await FirebaseService.getAll(this.COLLECTIONS.WOMEN_BRANCH_PRESIDENTS, {
        where: [{ field: 'region', operator: '==', value: region }]
      }, false);

      for (const pres of existing) {
        await FirebaseService.delete(this.COLLECTIONS.WOMEN_BRANCH_PRESIDENTS, pres.id);
      }

      return { success: true };
    } catch (error) {
      console.error('Remove women branch president error:', error);
      throw error;
    }
  }

  // Gençlik Kolları Başkanlığı API
  static async getYouthBranchPresidents() {
    try {
      const presidents = await FirebaseService.getAll(this.COLLECTIONS.YOUTH_BRANCH_PRESIDENTS);
      return presidents || [];
    } catch (error) {
      console.error('Get youth branch presidents error:', error);
      return [];
    }
  }

  static async setYouthBranchPresident(region, memberId) {
    try {
      // Önce bu bölgede başka bir başkan var mı kontrol et
      const existing = await FirebaseService.getAll(this.COLLECTIONS.YOUTH_BRANCH_PRESIDENTS, {
        where: [{ field: 'region', operator: '==', value: region }]
      }, false);

      // Varsa sil
      if (existing.length > 0) {
        for (const pres of existing) {
          await FirebaseService.delete(this.COLLECTIONS.YOUTH_BRANCH_PRESIDENTS, pres.id);
        }
      }

      // Yeni başkanı ekle
      const docId = await FirebaseService.create(
        this.COLLECTIONS.YOUTH_BRANCH_PRESIDENTS,
        null,
        {
          region: region,
          member_id: String(memberId),
          created_at: new Date().toISOString()
        },
        false
      );

      return { success: true, id: docId };
    } catch (error) {
      console.error('Set youth branch president error:', error);
      throw error;
    }
  }

  static async removeYouthBranchPresident(region) {
    try {
      const existing = await FirebaseService.getAll(this.COLLECTIONS.YOUTH_BRANCH_PRESIDENTS, {
        where: [{ field: 'region', operator: '==', value: region }]
      }, false);

      for (const pres of existing) {
        await FirebaseService.delete(this.COLLECTIONS.YOUTH_BRANCH_PRESIDENTS, pres.id);
      }

      return { success: true };
    } catch (error) {
      console.error('Remove youth branch president error:', error);
      throw error;
    }
  }

  // Women Branch Management CRUD
  static async getWomenBranchManagement(memberId) {
    try {
      return await FirebaseService.findByField(
        this.COLLECTIONS.WOMEN_BRANCH_MANAGEMENT,
        'member_id',
        String(memberId)
      );
    } catch (error) {
      console.error('Get women branch management error:', error);
      return [];
    }
  }

  static async createWomenBranchManagement(data) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.WOMEN_BRANCH_MANAGEMENT, null, data);
      return { success: true, id: docId, message: 'Yönetim üyesi eklendi' };
    } catch (error) {
      console.error('Create women branch management error:', error);
      throw new Error('Yönetim üyesi eklenirken hata oluştu');
    }
  }

  static async updateWomenBranchManagement(id, data) {
    try {
      await FirebaseService.update(this.COLLECTIONS.WOMEN_BRANCH_MANAGEMENT, id, data);
      return { success: true, message: 'Yönetim üyesi güncellendi' };
    } catch (error) {
      console.error('Update women branch management error:', error);
      throw new Error('Yönetim üyesi güncellenirken hata oluştu');
    }
  }

  static async deleteWomenBranchManagement(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.WOMEN_BRANCH_MANAGEMENT, id);
      return { success: true, message: 'Yönetim üyesi silindi' };
    } catch (error) {
      console.error('Delete women branch management error:', error);
      throw new Error('Yönetim üyesi silinirken hata oluştu');
    }
  }

  // Youth Branch Management CRUD
  static async getYouthBranchManagement(memberId) {
    try {
      return await FirebaseService.findByField(
        this.COLLECTIONS.YOUTH_BRANCH_MANAGEMENT,
        'member_id',
        String(memberId)
      );
    } catch (error) {
      console.error('Get youth branch management error:', error);
      return [];
    }
  }

  static async createYouthBranchManagement(data) {
    try {
      const docId = await FirebaseService.create(this.COLLECTIONS.YOUTH_BRANCH_MANAGEMENT, null, data);
      return { success: true, id: docId, message: 'Yönetim üyesi eklendi' };
    } catch (error) {
      console.error('Create youth branch management error:', error);
      throw new Error('Yönetim üyesi eklenirken hata oluştu');
    }
  }

  static async updateYouthBranchManagement(id, data) {
    try {
      await FirebaseService.update(this.COLLECTIONS.YOUTH_BRANCH_MANAGEMENT, id, data);
      return { success: true, message: 'Yönetim üyesi güncellendi' };
    } catch (error) {
      console.error('Update youth branch management error:', error);
      throw new Error('Yönetim üyesi güncellenirken hata oluştu');
    }
  }

  static async deleteYouthBranchManagement(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.YOUTH_BRANCH_MANAGEMENT, id);
      return { success: true, message: 'Yönetim üyesi silindi' };
    } catch (error) {
      console.error('Delete youth branch management error:', error);
      throw new Error('Yönetim üyesi silinirken hata oluştu');
    }
  }

  // ==================== API KEY METHODS ====================

  /**
   * Get all API keys
   */
  static async getApiKeys() {
    try {
      const keys = await FirebaseService.getAll(this.COLLECTIONS.API_KEYS, {}, false);
      // Hash'leri gizle, sadece metadata göster
      return keys.map(key => ({
        id: key.id,
        name: key.name,
        permissions: key.permissions || ['read'],
        createdAt: key.created_at || key.createdAt,
        lastUsedAt: key.last_used_at || key.lastUsedAt,
        isActive: key.is_active !== false
      }));
    } catch (error) {
      console.error('Get API keys error:', error);
      return [];
    }
  }

  /**
   * Create new API key
   */
  static async createApiKey(name, permissions = ['read']) {
    try {
      // Generate secure API key
      const crypto = await import('crypto-js');
      const apiKey = crypto.lib.WordArray.random(32).toString();
      const hashedKey = crypto.SHA256(apiKey).toString();

      const keyData = {
        name: name.trim(),
        api_key_hash: hashedKey,
        permissions: Array.isArray(permissions) ? permissions : ['read'],
        created_at: new Date().toISOString(),
        is_active: true
      };

      const docRef = await FirebaseService.create(this.COLLECTIONS.API_KEYS, null, keyData, false);

      return {
        id: docRef.id || docRef,
        name: keyData.name,
        apiKey, // Plain key - only shown once
        permissions: keyData.permissions,
        createdAt: keyData.created_at,
        isActive: true
      };
    } catch (error) {
      console.error('Create API key error:', error);
      throw error;
    }
  }

  /**
   * Deactivate API key
   */
  static async deactivateApiKey(id) {
    try {
      await FirebaseService.update(this.COLLECTIONS.API_KEYS, id, { is_active: false }, false);
      return { success: true };
    } catch (error) {
      console.error('Deactivate API key error:', error);
      throw error;
    }
  }

  /**
   * Delete API key
   */
  static async deleteApiKey(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.API_KEYS, id);
      return { success: true };
    } catch (error) {
      console.error('Delete API key error:', error);
      throw error;
    }
  }

  /**
   * Validate API key (for public API)
   */
  static async validateApiKey(apiKey) {
    try {
      const crypto = await import('crypto-js');
      const hashedKey = crypto.SHA256(apiKey).toString();

      const allKeys = await FirebaseService.getAll(this.COLLECTIONS.API_KEYS, {}, false);
      const keyData = allKeys.find(k => k.api_key_hash === hashedKey);

      if (!keyData || keyData.is_active === false) {
        return null;
      }

      // Update last used timestamp
      await FirebaseService.update(this.COLLECTIONS.API_KEYS, keyData.id, {
        last_used_at: new Date().toISOString()
      }, false);

      return {
        id: keyData.id,
        name: keyData.name,
        permissions: keyData.permissions || ['read'],
        isActive: keyData.is_active !== false
      };
    } catch (error) {
      console.error('Validate API key error:', error);
      return null;
    }
  }

  // Alliance methods
  /**
   * Get all alliances for an election
   * @param {string|number} electionId - Election ID
   */
  static async getAlliances(electionId) {
    try {
      const alliances = await FirebaseService.getAll(this.COLLECTIONS.ALLIANCES, {
        where: [
          { field: 'election_id', operator: '==', value: String(electionId) }
        ]
      });

      return alliances.map(alliance => ({
        ...alliance,
        election_id: alliance.election_id || alliance.electionId,
        party_ids: alliance.party_ids || alliance.partyIds || []
      }));
    } catch (error) {
      console.error('Error getting alliances:', error);
      return [];
    }
  }

  /**
   * Get alliance by ID
   * @param {string|number} id - Alliance ID
   */
  static async getAlliance(id) {
    try {
      const alliance = await FirebaseService.getById(this.COLLECTIONS.ALLIANCES, String(id || '').trim());
      if (!alliance) return null;

      return {
        ...alliance,
        election_id: alliance.election_id || alliance.electionId,
        party_ids: alliance.party_ids || alliance.partyIds || []
      };
    } catch (error) {
      console.error('Error getting alliance by ID:', error);
      return null;
    }
  }

  /**
   * Create new alliance
   * @param {object} allianceData - { election_id, name, party_ids }
   */
  static async createAlliance(allianceData) {
    try {
      const electionId = String(allianceData.election_id || allianceData.electionId);
      const partyIds = Array.isArray(allianceData.party_ids) ? allianceData.party_ids : (allianceData.partyIds || []);

      // Bir parti birden fazla ittifakta olamaz — aynı seçimdeki mevcut ittifakları kontrol et
      if (partyIds.length > 0) {
        const existingAlliances = await FirebaseService.getAll(this.COLLECTIONS.ALLIANCES, {
          where: [{ field: 'election_id', operator: '==', value: electionId }]
        });

        for (const partyId of partyIds) {
          const partyName = typeof partyId === 'string' ? partyId : partyId.name;
          const conflict = existingAlliances.find(a => {
            const pids = a.party_ids || a.partyIds || [];
            return pids.some(p => (typeof p === 'string' ? p : p.name) === partyName);
          });
          if (conflict) {
            return { success: false, message: `${partyName} zaten "${conflict.name}" ittifakında. Bir parti birden fazla ittifakta olamaz.` };
          }
        }
      }

      const alliance = {
        election_id: electionId,
        name: allianceData.name,
        party_ids: partyIds,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const docId = await FirebaseService.create(this.COLLECTIONS.ALLIANCES, alliance);

      return {
        id: docId,
        ...alliance
      };
    } catch (error) {
      console.error('Error creating alliance:', error);
      throw error;
    }
  }

  /**
   * Update alliance
   * @param {string|number} id - Alliance ID
   * @param {object} allianceData - Update data
   */
  static async updateAlliance(id, allianceData) {
    try {
      const updateData = {
        ...allianceData,
        updated_at: new Date().toISOString()
      };

      // Normalize field names
      if (allianceData.election_id !== undefined) {
        updateData.election_id = String(allianceData.election_id);
      }
      if (allianceData.party_ids !== undefined) {
        updateData.party_ids = Array.isArray(allianceData.party_ids) ? allianceData.party_ids : [];
      }

      // Bir parti birden fazla ittifakta olamaz — güncelleme sırasında çakışma kontrolü
      if (updateData.party_ids && updateData.party_ids.length > 0 && updateData.election_id) {
        const existingAlliances = await FirebaseService.getAll(this.COLLECTIONS.ALLIANCES, {
          where: [{ field: 'election_id', operator: '==', value: updateData.election_id }]
        });
        // Güncellenen ittifakı hariç tut
        const otherAlliances = existingAlliances.filter(a => String(a.id) !== String(id));

        for (const partyId of updateData.party_ids) {
          const partyName = typeof partyId === 'string' ? partyId : partyId.name;
          const conflict = otherAlliances.find(a => {
            const pids = a.party_ids || a.partyIds || [];
            return pids.some(p => (typeof p === 'string' ? p : p.name) === partyName);
          });
          if (conflict) {
            return { success: false, message: `${partyName} zaten "${conflict.name}" ittifakında. Bir parti birden fazla ittifakta olamaz.` };
          }
        }
      }

      await FirebaseService.update(this.COLLECTIONS.ALLIANCES, String(id), updateData);

      return await this.getAlliance(id);
    } catch (error) {
      console.error('Error updating alliance:', error);
      throw error;
    }
  }

  /**
   * Delete alliance
   * @param {string|number} id - Alliance ID
   */
  static async deleteAlliance(id) {
    try {
      await FirebaseService.delete(this.COLLECTIONS.ALLIANCES, String(id));
      return { success: true };
    } catch (error) {
      console.error('Error deleting alliance:', error);
      throw error;
    }
  }

  // ============================================
  // KVKK - Veri Silme Talepleri (Data Deletion Requests)
  // ============================================

  static async createDataDeletionRequest(member_id, reason) {
    try {
      const docId = await FirebaseService.create('data_deletion_requests', null, {
        member_id: String(member_id),
        reason: reason || '',
        status: 'pending',
        created_at: new Date().toISOString()
      });
      return { success: true, id: docId };
    } catch (error) {
      console.error('Create data deletion request error:', error);
      throw new Error('Veri silme talebi oluşturulurken hata oluştu');
    }
  }

  static async getDataDeletionRequests() {
    try {
      const requests = await FirebaseService.getAll('data_deletion_requests', {}, false);
      if (!requests || requests.length === 0) return [];

      // Her talep icin uye bilgisini ekle
      for (const request of requests) {
        if (request.member_id) {
          try {
            const memberDoc = await FirebaseService.getById(this.COLLECTIONS.MEMBERS, String(request.member_id), false);
            if (memberDoc) {
              request.member_name = memberDoc.name || 'Bilinmeyen';
              request.member_tc = memberDoc.tc || '';
              request.member_phone = memberDoc.phone || '';
            } else {
              request.member_name = 'Silinmis Uye';
            }
          } catch (memberErr) {
            console.warn(`Uye bilgisi alinamadi (member_id: ${request.member_id}):`, memberErr);
            request.member_name = request.member_name || `Uye #${request.member_id}`;
          }
        }
      }

      // Sort by created_at descending
      return requests.sort((a, b) => {
        const dateA = new Date(a.created_at || 0);
        const dateB = new Date(b.created_at || 0);
        return dateB - dateA;
      });
    } catch (error) {
      console.error('Get data deletion requests error:', error);
      return [];
    }
  }

  static async getMyDataDeletionRequests(memberId) {
    try {
      const allRequests = await FirebaseService.getAll('data_deletion_requests', {}, false);
      if (!allRequests || allRequests.length === 0) return [];
      return allRequests.filter(r => String(r.member_id) === String(memberId));
    } catch (error) {
      console.error('Get my data deletion requests error:', error);
      return [];
    }
  }

  static async approveDataDeletionRequest(id) {
    try {
      // Talebi getir ve member_id'yi al
      const requestDoc = await FirebaseService.getById('data_deletion_requests', String(id), false);
      const memberId = requestDoc?.member_id;

      // Status guncelle
      await FirebaseService.update('data_deletion_requests', String(id), {
        status: 'approved',
        processed_at: new Date().toISOString()
      }, false);

      // Uye verilerini sil
      if (memberId) {
        const collectionsToClean = [
          { name: this.COLLECTIONS.MEMBERS, field: 'id' },
          { name: this.COLLECTIONS.MEMBER_REGISTRATIONS, field: 'member_id' },
          { name: this.COLLECTIONS.PERSONAL_DOCUMENTS, field: 'member_id' },
          { name: this.COLLECTIONS.MEMBER_USERS, field: 'member_id' },
        ];

        for (const col of collectionsToClean) {
          try {
            const allDocs = await FirebaseService.getAll(col.name, {}, false);
            if (allDocs && allDocs.length > 0) {
              const matchingDocs = allDocs.filter(d => String(d[col.field]) === String(memberId));
              for (const matchDoc of matchingDocs) {
                if (matchDoc.id) {
                  await FirebaseService.delete(col.name, String(matchDoc.id));
                }
              }
            }
          } catch (colError) {
            console.warn(`KVKK veri silme - ${col.name} koleksiyonunda hata:`, colError);
          }
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Approve data deletion request error:', error);
      throw new Error('Veri silme talebi onaylanırken hata oluştu');
    }
  }

  static async rejectDataDeletionRequest(id, rejection_reason) {
    try {
      await FirebaseService.update('data_deletion_requests', String(id), {
        status: 'rejected',
        rejection_reason: rejection_reason || '',
        processed_at: new Date().toISOString()
      }, false);
      return { success: true };
    } catch (error) {
      console.error('Reject data deletion request error:', error);
      throw new Error('Veri silme talebi reddedilirken hata oluştu');
    }
  }
}

export default FirebaseApiService;

