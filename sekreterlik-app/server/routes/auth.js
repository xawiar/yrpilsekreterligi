const express = require('express');
const router = express.Router();
const Admin = require('../models/Admin');
const MemberUser = require('../models/MemberUser');
const db = require('../config/database');

// Login endpoint
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  console.log('Login attempt:', { username, password });
  
  try {
    if (!username || !password) {
      console.log('Missing credentials');
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı adı ve şifre zorunludur'
      });
    }

    // First try admin login
    const isAdminValid = await Admin.verifyAdmin(username, password);
    console.log('Admin validation result:', isAdminValid);
    
    if (isAdminValid) {
      console.log('Admin login successful');
      // Generate a simple token (in a real app, use JWT)
      const token = 'simple-auth-token';
      
      res.json({
        success: true,
        token,
        user: {
          username,
          name: 'Parti Sekreteri',
          role: 'admin'
        }
      });
      return;
    }

    // Then try member user login (including district and town presidents)
    // Normalize password: remove all non-digit characters (phone numbers are stored as digits only)
    const normalizedPassword = password.replace(/\D/g, '');
    console.log('Trying member user login with:', { username, originalPassword: password, normalizedPassword });
    const memberUser = await MemberUser.getUserByCredentialsUpdated(username, normalizedPassword);
    console.log('Member user validation result:', memberUser ? 'Found' : 'Not found');
    
    if (memberUser) {
      // Generate a simple token (in a real app, use JWT)
      const token = 'simple-auth-token';
      
      let userRole = 'member';
      let userData = {
        username,
        name: memberUser.name || memberUser.chairman_name,
        role: userRole,
        memberId: memberUser.member_id,
        region: memberUser.region,
        position: memberUser.position
      };

      // Handle different user types
      if (memberUser.user_type === 'district_president') {
        userRole = 'district_president';
        userData = {
          username,
          name: memberUser.chairman_name,
          role: userRole,
          districtId: memberUser.district_id,
          districtName: memberUser.district_name,
          chairmanName: memberUser.chairman_name
        };
      } else if (memberUser.user_type === 'town_president') {
        userRole = 'town_president';
        userData = {
          username,
          name: memberUser.chairman_name,
          role: userRole,
          townId: memberUser.town_id,
          townName: memberUser.town_name,
          chairmanName: memberUser.chairman_name
        };
      }
      
      res.json({
        success: true,
        token,
        user: userData
      });
      return;
    }

    // If neither admin nor member user found
    console.log('Login failed - invalid credentials');
    res.status(401).json({
      success: false,
      message: 'Geçersiz kullanıcı adı veya şifre'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Giriş sırasında bir hata oluştu'
    });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  // In a real application, you would invalidate the token
  res.json({
    success: true,
    message: 'Çıkış yapıldı'
  });
});

// Get admin info endpoint
router.get('/admin', async (req, res) => {
  try {
    const admin = await Admin.getAdmin();
    res.json({
      success: true,
      admin: {
        username: admin.username,
        // Don't send password in response
        created_at: admin.created_at,
        updated_at: admin.updated_at
      }
    });
  } catch (error) {
    console.error('Get admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Admin bilgileri alınırken hata oluştu'
    });
  }
});

// Update admin credentials endpoint
router.put('/admin', async (req, res) => {
  const { username, password, currentPassword } = req.body;
  
  try {
    if (!username || !password || !currentPassword) {
      return res.status(400).json({
        success: false,
        message: 'Tüm alanlar zorunludur'
      });
    }

    // Verify current password
    const currentAdmin = await Admin.getAdmin();
    const isCurrentPasswordValid = await Admin.verifyAdmin(currentAdmin.username, currentPassword);
    
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Mevcut şifre yanlış'
      });
    }

    // Update admin credentials
    await Admin.updateAdmin(username, password);
    
    res.json({
      success: true,
      message: 'Admin bilgileri başarıyla güncellendi'
    });
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Admin bilgileri güncellenirken hata oluştu'
    });
  }
});

// Get all member users endpoint
router.get('/member-users', async (req, res) => {
  try {
    const memberUsers = await MemberUser.getAllMemberUsers();
    res.json({
      success: true,
      users: memberUsers
    });
  } catch (error) {
    console.error('Get member users error:', error);
    res.status(500).json({
      success: false,
      message: 'Üye kullanıcıları alınırken hata oluştu'
    });
  }
});

// Create user for member endpoint
router.post('/member-users', async (req, res) => {
  const { memberId, username, password } = req.body;
  
  try {
    if (!memberId || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Tüm alanlar zorunludur'
      });
    }

    // Check if user already exists for this member
    const existingUser = await MemberUser.getUserByMemberId(memberId);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Bu üye için zaten bir kullanıcı oluşturulmuş'
      });
    }

    // Create user
    const newUser = await MemberUser.createMemberUser(memberId, username, password);
    
    res.json({
      success: true,
      message: 'Üye kullanıcısı başarıyla oluşturuldu',
      user: newUser
    });
  } catch (error) {
    console.error('Create member user error:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({
        success: false,
        message: 'Bu kullanıcı adı zaten kullanılıyor'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Üye kullanıcısı oluşturulurken hata oluştu'
      });
    }
  }
});

// Update member user credentials endpoint
router.put('/member-users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, password } = req.body;
  
  try {
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı adı ve şifre zorunludur'
      });
    }

    // Update user credentials
    await MemberUser.updateUserCredentials(id, username, password);
    
    res.json({
      success: true,
      message: 'Üye kullanıcı bilgileri başarıyla güncellendi'
    });
  } catch (error) {
    console.error('Update member user error:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({
        success: false,
        message: 'Bu kullanıcı adı zaten kullanılıyor'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Üye kullanıcı bilgileri güncellenirken hata oluştu'
      });
    }
  }
});

// Toggle member user status endpoint
router.patch('/member-users/:id/toggle', async (req, res) => {
  const { id } = req.params;
  
  try {
    await MemberUser.toggleUserStatus(id);
    
    res.json({
      success: true,
      message: 'Üye kullanıcı durumu güncellendi'
    });
  } catch (error) {
    console.error('Toggle member user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Üye kullanıcı durumu güncellenirken hata oluştu'
    });
  }
});

// Delete member user endpoint
router.delete('/member-users/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await MemberUser.deleteUser(id);
    
    res.json({
      success: true,
      message: 'Üye kullanıcısı başarıyla silindi'
    });
  } catch (error) {
    console.error('Delete member user error:', error);
    res.status(500).json({
      success: false,
      message: 'Üye kullanıcısı silinirken hata oluştu'
    });
  }
});

// Create district president user endpoint
router.post('/district-president-users', async (req, res) => {
  const { districtId, districtName, chairmanName, chairmanPhone } = req.body;
  
  try {
    if (!districtId || !districtName || !chairmanName || !chairmanPhone) {
      return res.status(400).json({
        success: false,
        message: 'Tüm alanlar zorunludur'
      });
    }

    // Check if user already exists for this district
    const existingUser = await MemberUser.getUserByCredentialsUpdated(
      districtName.toLowerCase().replace(/\s+/g, '_'), 
      chairmanPhone.replace(/\D/g, '')
    );
    
    if (existingUser && existingUser.user_type === 'district_president') {
      return res.status(400).json({
        success: false,
        message: 'Bu ilçe için zaten bir başkan kullanıcısı oluşturulmuş'
      });
    }

    // Create district president user
    const newUser = await MemberUser.createDistrictPresidentUser(districtId, districtName, chairmanName, chairmanPhone);
    
    res.json({
      success: true,
      message: 'İlçe başkanı kullanıcısı başarıyla oluşturuldu',
      user: newUser
    });
  } catch (error) {
    console.error('Create district president user error:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({
        success: false,
        message: 'Bu kullanıcı adı zaten kullanılıyor'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'İlçe başkanı kullanıcısı oluşturulurken hata oluştu'
      });
    }
  }
});

// Create town president user endpoint
router.post('/town-president-users', async (req, res) => {
  const { townId, townName, chairmanName, chairmanPhone } = req.body;
  
  try {
    if (!townId || !townName || !chairmanName || !chairmanPhone) {
      return res.status(400).json({
        success: false,
        message: 'Tüm alanlar zorunludur'
      });
    }

    // Check if user already exists for this town
    const existingUser = await MemberUser.getUserByCredentialsUpdated(
      townName.toLowerCase().replace(/\s+/g, '_'), 
      chairmanPhone.replace(/\D/g, '')
    );
    
    if (existingUser && existingUser.user_type === 'town_president') {
      return res.status(400).json({
        success: false,
        message: 'Bu belde için zaten bir başkan kullanıcısı oluşturulmuş'
      });
    }

    // Create town president user
    const newUser = await MemberUser.createTownPresidentUser(townId, townName, chairmanName, chairmanPhone);
    
    res.json({
      success: true,
      message: 'Belde başkanı kullanıcısı başarıyla oluşturuldu',
      user: newUser
    });
  } catch (error) {
    console.error('Create town president user error:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({
        success: false,
        message: 'Bu kullanıcı adı zaten kullanılıyor'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Belde başkanı kullanıcısı oluşturulurken hata oluştu'
      });
    }
  }
});

// Update all user credentials based on current member/district/town data
router.post('/update-all-credentials', async (req, res) => {
  try {
    const results = {
      memberUsers: { updated: 0, errors: [] },
      districtPresidents: { updated: 0, errors: [] },
      townPresidents: { updated: 0, errors: [] }
    };

    // Update member users - Check all active members and create/update users
    try {
      const { decryptField } = require('../utils/crypto');
      
      // Get all active (non-archived) members
      console.log('Starting member users update...');
      const allMembers = await db.all('SELECT * FROM members WHERE archived = 0');
      console.log(`Found ${allMembers.length} active members`);
      
      for (const member of allMembers) {
        try {
          const tc = decryptField(member.tc);
          const phone = decryptField(member.phone);
          const username = tc; // Username should be TC
          const password = phone.replace(/\D/g, ''); // Normalize password (remove non-digits)
          
          // Check if user exists for this member
          const existingUser = await MemberUser.getUserByMemberId(member.id);
          
          if (existingUser) {
            // Always update existing user to ensure username is TC and password is phone
            // This fixes any incorrect usernames (e.g., encrypted TC instead of plain TC)
            await MemberUser.updateMemberUser(member.id, tc, phone);
            results.memberUsers.updated++;
            console.log(`Updated member user for member ID ${member.id} (username: ${username})`);
          } else {
            // Create new user if doesn't exist
            // Check if username already exists (might be taken by another member or user type)
            const userWithSameUsername = await new Promise((resolve, reject) => {
              db.get('SELECT * FROM member_users WHERE username = ? AND (member_id IS NULL OR member_id != ?)', [username, member.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
              });
            });
            
            if (!userWithSameUsername) {
              await MemberUser.createMemberUser(member.id, username, password);
              results.memberUsers.updated++;
              console.log(`Created member user for member ID ${member.id} (username: ${username})`);
            } else {
              // If username exists but for different member, try to update that user or create with member_id
              results.memberUsers.errors.push(`Member ID ${member.id}: Username ${username} already taken by another user`);
            }
          }
        } catch (error) {
          console.error(`Error processing member ID ${member.id}:`, error);
          results.memberUsers.errors.push(`Member ID ${member.id}: ${error.message}`);
        }
      }
    } catch (error) {
      console.error('General error in member users update:', error);
      results.memberUsers.errors.push(`General error: ${error.message}`);
    }

    // Update district presidents - Check all district officials and create/update users
    try {
      console.log('Starting district presidents update...');
      const districtOfficials = await db.all('SELECT * FROM district_officials WHERE chairman_name IS NOT NULL AND chairman_phone IS NOT NULL');
      console.log(`Found ${districtOfficials.length} district officials with chairman info`);
      for (const official of districtOfficials) {
        try {
          const district = await db.get('SELECT * FROM districts WHERE id = ?', [official.district_id]);
          if (district) {
            const existingUser = await MemberUser.getUserByDistrictId(official.district_id);
            if (existingUser) {
              // Update existing user
              await MemberUser.updateDistrictPresidentUser(
                official.district_id,
                district.name,
                official.chairman_name,
                official.chairman_phone
              );
              results.districtPresidents.updated++;
              console.log(`Updated district president user for district ID ${official.district_id}`);
            } else {
              // Create new user if doesn't exist
              await MemberUser.createDistrictPresidentUser(
                official.district_id,
                district.name,
                official.chairman_name,
                official.chairman_phone
              );
              results.districtPresidents.updated++;
              console.log(`Created district president user for district ID ${official.district_id}`);
            }
          }
        } catch (error) {
          results.districtPresidents.errors.push(`District ID ${official.district_id}: ${error.message}`);
        }
      }
    } catch (error) {
      results.districtPresidents.errors.push(`General error: ${error.message}`);
    }

    // Update town presidents - Check all town officials and create/update users
    // For town presidents: username is normalized town name, password is chairman phone (normalized)
    try {
      console.log('Starting town presidents update...');
      const townOfficials = await db.all('SELECT * FROM town_officials WHERE chairman_name IS NOT NULL AND chairman_phone IS NOT NULL');
      console.log(`Found ${townOfficials.length} town officials with chairman info`);
      for (const official of townOfficials) {
        try {
          const town = await db.get('SELECT * FROM towns WHERE id = ?', [official.town_id]);
          if (town) {
            const existingUser = await MemberUser.getUserByTownId(official.town_id);
            if (existingUser) {
              // Always update existing user to ensure credentials match current town/chairman info
              await MemberUser.updateTownPresidentUser(
                official.town_id,
                town.name,
                official.chairman_name,
                official.chairman_phone
              );
              results.townPresidents.updated++;
              console.log(`Updated town president user for town ID ${official.town_id} (town: ${town.name})`);
            } else {
              // Create new user if doesn't exist
              await MemberUser.createTownPresidentUser(
                official.town_id,
                town.name,
                official.chairman_name,
                official.chairman_phone
              );
              results.townPresidents.updated++;
              console.log(`Created town president user for town ID ${official.town_id} (town: ${town.name})`);
            }
          }
        } catch (error) {
          results.townPresidents.errors.push(`Town ID ${official.town_id}: ${error.message}`);
        }
      }
    } catch (error) {
      results.townPresidents.errors.push(`General error: ${error.message}`);
    }

    // Clean up orphaned users - users that don't belong to any active member or town/district president
    try {
      const { decryptField } = require('../utils/crypto');
      let deletedCount = 0;
      const deletedErrors = [];
      
      // Get all member_users
      const allUsers = await MemberUser.getAll();
      
      for (const user of allUsers) {
        try {
          let shouldDelete = false;
          let reason = '';
          
          if (user.user_type === 'member') {
            // For member type users, must have a valid member_id and active member
            if (!user.member_id) {
              // No member_id means orphaned user
              shouldDelete = true;
              reason = `Member user has no member_id`;
            } else {
              // Check if member exists and is not archived
              const member = await db.get('SELECT * FROM members WHERE id = ? AND archived = 0', [user.member_id]);
              if (!member) {
                shouldDelete = true;
                reason = `Member ID ${user.member_id} does not exist or is archived`;
              }
            }
          } else if (user.user_type === 'town_president') {
            if (!user.town_id) {
              // No town_id means orphaned user
              shouldDelete = true;
              reason = `Town president user has no town_id`;
            } else {
              // Check if town official exists with chairman info
              const townOfficial = await db.get(
                'SELECT * FROM town_officials WHERE town_id = ? AND chairman_name IS NOT NULL AND chairman_phone IS NOT NULL',
                [user.town_id]
              );
              if (!townOfficial) {
                shouldDelete = true;
                reason = `Town ID ${user.town_id} does not have a chairman`;
              }
            }
          } else if (user.user_type === 'district_president') {
            if (!user.district_id) {
              // No district_id means orphaned user
              shouldDelete = true;
              reason = `District president user has no district_id`;
            } else {
              // Check if district official exists with chairman info
              const districtOfficial = await db.get(
                'SELECT * FROM district_officials WHERE district_id = ? AND chairman_name IS NOT NULL AND chairman_phone IS NOT NULL',
                [user.district_id]
              );
              if (!districtOfficial) {
                shouldDelete = true;
                reason = `District ID ${user.district_id} does not have a chairman`;
              }
            }
          }
          
          if (shouldDelete) {
            await MemberUser.deleteUser(user.id);
            deletedCount++;
            console.log(`Deleted orphaned user ID ${user.id} (${user.user_type}): ${reason}`);
          }
        } catch (error) {
          deletedErrors.push(`User ID ${user.id}: ${error.message}`);
        }
      }
      
      results.cleaned = { deleted: deletedCount, errors: deletedErrors };
      console.log(`Cleaned up ${deletedCount} orphaned users`);
    } catch (error) {
      console.error('Error cleaning up orphaned users:', error);
      results.cleaned = { deleted: 0, errors: [`General error: ${error.message}`] };
    }

    res.json({
      success: true,
      message: 'Kullanıcı bilgileri güncellendi',
      results
    });
  } catch (error) {
    console.error('Error updating all credentials:', error);
    res.status(500).json({ message: 'Sunucu hatası', error: error.message });
  }
});

// Find Firebase Auth user by email (server-side, requires Firebase Admin SDK)
router.post('/find-firebase-auth-user', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'email zorunludur'
      });
    }

    const { getAdmin } = require('../config/firebaseAdmin');
    const firebaseAdmin = getAdmin();
    
    if (!firebaseAdmin) {
      return res.status(503).json({
        success: false,
        message: 'Firebase Admin SDK initialize edilemedi'
      });
    }

    try {
      console.log('🔍 Finding Firebase Auth user by email:', email);
      const userRecord = await firebaseAdmin.auth().getUserByEmail(email);
      console.log('✅ Found Firebase Auth user:', userRecord.uid, userRecord.email);
      const responseData = {
        success: true,
        authUid: userRecord.uid,
        email: userRecord.email
      };
      console.log('📤 Sending find response:', JSON.stringify(responseData));
      return res.status(200).json(responseData);
    } catch (firebaseError) {
      if (firebaseError.code === 'auth/user-not-found') {
        console.log('ℹ️ User not found in Firebase Auth by email:', email);
        const responseData = {
          success: false,
          message: 'Kullanıcı bulunamadı',
          authUid: null
        };
        console.log('📤 Sending find response (not found):', JSON.stringify(responseData));
        return res.status(200).json(responseData);
      } else {
        console.error('❌ Firebase Auth error:', firebaseError);
        throw firebaseError;
      }
    }
  } catch (error) {
    console.error('Error finding Firebase Auth user:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası: ' + error.message
    });
  }
});

// Update Firebase Auth password for a user (server-side, requires Firebase Admin SDK)
router.post('/update-firebase-auth-password', async (req, res) => {
  try {
    let { authUid, password, email } = req.body;
    
    console.log('🔐 Firebase Auth password update request received:', {
      authUid: authUid || 'null',
      email: email || 'null',
      passwordLength: password?.length || 0,
      passwordPreview: password ? password.substring(0, 3) + '***' : 'null'
    });
    
    if (!password) {
      console.error('❌ Password is required');
      return res.status(400).json({
        success: false,
        message: 'Password zorunludur'
      });
    }

    const { getAdmin } = require('../config/firebaseAdmin');
    const firebaseAdmin = getAdmin();
    
    if (!firebaseAdmin) {
      console.error('❌ Firebase Admin SDK not initialized');
      return res.status(503).json({
        success: false,
        message: 'Firebase Admin SDK initialize edilemedi. FIREBASE_SERVICE_ACCOUNT_KEY environment variable kontrol edin.'
      });
    }

    // Password'u normalize et (sadece rakamlar) - Firebase Auth minimum 6 karakter ister
    const normalizedPassword = password.toString().replace(/\D/g, '');
    const finalPassword = normalizedPassword.length < 6 ? normalizedPassword.padStart(6, '0') : normalizedPassword;
    
    console.log('🔑 Password normalization:', {
      originalLength: password.length,
      normalizedLength: normalizedPassword.length,
      finalLength: finalPassword.length,
      padded: normalizedPassword.length < 6
    });
    
    // Eğer authUid yoksa ama email varsa, email ile kullanıcıyı bul
    if (!authUid && email) {
      console.log('🔍 authUid not provided, trying to find user by email:', email);
      try {
        const userRecord = await firebaseAdmin.auth().getUserByEmail(email);
        authUid = userRecord.uid;
        console.log('✅ Found user by email, authUid:', authUid);
      } catch (emailError) {
        if (emailError.code === 'auth/user-not-found') {
          console.log('ℹ️ User not found in Firebase Auth by email, creating new user:', email);
          // Kullanıcı yoksa oluştur
          try {
            const newUser = await firebaseAdmin.auth().createUser({
              email: email,
              password: finalPassword,
              emailVerified: false
            });
            authUid = newUser.uid;
            console.log('✅ Created new Firebase Auth user, authUid:', authUid);
          } catch (createError) {
            console.error('❌ Error creating Firebase Auth user:', createError);
            return res.status(500).json({
              success: false,
              message: `Firebase Auth kullanıcı oluşturma hatası: ${createError.message}`
            });
          }
        } else {
          console.error('❌ Firebase Auth error:', emailError);
          return res.status(500).json({
            success: false,
            message: `Firebase Auth hatası: ${emailError.message}`
          });
        }
      }
    }
    
    if (!authUid) {
      console.error('❌ authUid is required');
      return res.status(400).json({
        success: false,
        message: 'authUid (veya email) zorunludur'
      });
    }

    console.log('✅ Firebase Admin SDK initialized, updating user password for authUid:', authUid);
    
    try {
      await firebaseAdmin.auth().updateUser(authUid, {
        password: finalPassword
      });
      
      console.log('✅ Firebase Auth password updated successfully for authUid:', authUid);
      
      // Response'u düzgün gönder
      const responseData = {
        success: true,
        message: 'Firebase Auth şifresi güncellendi',
        authUid: authUid
      };
      console.log('📤 Sending password update response:', JSON.stringify(responseData));
      
      // res.json() kullan - daha güvenilir
      return res.status(200).json(responseData);
    } catch (firebaseError) {
      console.error('❌ Firebase Auth password update error:', {
        code: firebaseError.code,
        message: firebaseError.message,
        authUid,
        passwordLength: password?.length
      });
      return res.status(500).json({
        success: false,
        message: `Firebase Auth şifre güncelleme hatası: ${firebaseError.message}`
      });
    }
  } catch (error) {
    console.error('❌ Error updating Firebase Auth password:', error);
    return res.status(500).json({
      success: false,
      message: 'Sunucu hatası: ' + error.message
    });
  }
});

// Update Firebase Auth email and password for a user (server-side, requires Firebase Admin SDK)
router.post('/update-firebase-auth-user', async (req, res) => {
  try {
    let { authUid, email, password, oldEmail } = req.body;
    
    console.log('🔐 Firebase Auth user update request received:', {
      authUid: authUid || 'null',
      email: email || 'null',
      oldEmail: oldEmail || 'null',
      passwordLength: password?.length || 0,
      passwordPreview: password ? password.substring(0, 3) + '***' : 'null'
    });
    
    const { getAdmin } = require('../config/firebaseAdmin');
    const firebaseAdmin = getAdmin();
    
    if (!firebaseAdmin) {
      console.error('❌ Firebase Admin SDK not initialized');
      return res.status(503).json({
        success: false,
        message: 'Firebase Admin SDK initialize edilemedi. FIREBASE_SERVICE_ACCOUNT_KEY environment variable kontrol edin.'
      });
    }

    // Eğer authUid yoksa ama email varsa, email ile kullanıcıyı bul
    if (!authUid && (oldEmail || email)) {
      const searchEmail = oldEmail || email;
      console.log('🔍 authUid not provided, trying to find user by email:', searchEmail);
      try {
        const userRecord = await firebaseAdmin.auth().getUserByEmail(searchEmail);
        authUid = userRecord.uid;
        console.log('✅ Found user by email, authUid:', authUid);
      } catch (emailError) {
        if (emailError.code === 'auth/user-not-found') {
          console.log('ℹ️ User not found in Firebase Auth by email, creating new user:', email);
          // Kullanıcı yoksa oluştur
          if (email && password) {
            try {
              const normalizedPassword = password.toString().replace(/\D/g, '');
              const finalPassword = normalizedPassword.length < 6 ? normalizedPassword.padStart(6, '0') : normalizedPassword;
              
              const newUser = await firebaseAdmin.auth().createUser({
                email: email,
                password: finalPassword,
                emailVerified: false
              });
              authUid = newUser.uid;
              console.log('✅ Created new Firebase Auth user, authUid:', authUid);
              return res.status(200).json({
                success: true,
                message: 'Firebase Auth kullanıcısı oluşturuldu',
                authUid: authUid
              });
            } catch (createError) {
              console.error('❌ Error creating Firebase Auth user:', createError);
              return res.status(500).json({
                success: false,
                message: `Firebase Auth kullanıcı oluşturma hatası: ${createError.message}`
              });
            }
          } else {
            return res.status(400).json({
              success: false,
              message: 'Kullanıcı bulunamadı ve email/password eksik'
            });
          }
        } else {
          console.error('❌ Firebase Auth error:', emailError);
          return res.status(500).json({
            success: false,
            message: `Firebase Auth hatası: ${emailError.message}`
          });
        }
      }
    }
    
    if (!authUid) {
      console.error('❌ authUid is required');
      return res.status(400).json({
        success: false,
        message: 'authUid (veya email) zorunludur'
      });
    }

    // Güncelleme objesi oluştur
    const updateData = {};
    
    // Email güncellemesi
    if (email) {
      updateData.email = email;
      updateData.emailVerified = false; // Email değiştiği için verified'ı false yap
    }
    
    // Password güncellemesi
    if (password) {
      const normalizedPassword = password.toString().replace(/\D/g, '');
      const finalPassword = normalizedPassword.length < 6 ? normalizedPassword.padStart(6, '0') : normalizedPassword;
      updateData.password = finalPassword;
    }
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Email veya password gerekli'
      });
    }

    console.log('✅ Firebase Admin SDK initialized, updating user for authUid:', authUid, 'with data:', {
      email: updateData.email ? updateData.email.substring(0, 3) + '***' : 'not updating',
      password: updateData.password ? '***' : 'not updating'
    });
    
    try {
      await firebaseAdmin.auth().updateUser(authUid, updateData);
      
      console.log('✅ Firebase Auth user updated successfully for authUid:', authUid);
      
      return res.status(200).json({
        success: true,
        message: 'Firebase Auth kullanıcısı güncellendi',
        authUid: authUid,
        updatedFields: Object.keys(updateData)
      });
    } catch (firebaseError) {
      console.error('❌ Firebase Auth user update error:', {
        code: firebaseError.code,
        message: firebaseError.message,
        authUid,
        updateData
      });
      return res.status(500).json({
        success: false,
        message: `Firebase Auth kullanıcı güncelleme hatası: ${firebaseError.message}`
      });
    }
  } catch (error) {
    console.error('❌ Error updating Firebase Auth user:', error);
    return res.status(500).json({
      success: false,
      message: 'Sunucu hatası: ' + error.message
    });
  }
});

// Delete Firebase Auth user endpoint (server-side, requires Firebase Admin SDK)
router.delete('/firebase-auth-user/:authUid', async (req, res) => {
  try {
    const { authUid } = req.params;
    
    console.log('🗑️ Firebase Auth user deletion request received:', { authUid });
    
    if (!authUid) {
      return res.status(400).json({
        success: false,
        message: 'authUid gerekli'
      });
    }
    
    const { getAdmin } = require('../config/firebaseAdmin');
    const firebaseAdmin = getAdmin();
    
    if (!firebaseAdmin) {
      console.error('❌ Firebase Admin SDK not initialized');
      return res.status(503).json({
        success: false,
        message: 'Firebase Admin SDK initialize edilemedi. FIREBASE_SERVICE_ACCOUNT_KEY environment variable kontrol edin.'
      });
    }

    try {
      await firebaseAdmin.auth().deleteUser(authUid);
      
      console.log('✅ Firebase Auth user deleted successfully:', authUid);
      
      return res.status(200).json({
        success: true,
        message: 'Firebase Auth kullanıcısı silindi',
        authUid: authUid
      });
    } catch (firebaseError) {
      console.error('❌ Firebase Auth user deletion error:', {
        code: firebaseError.code,
        message: firebaseError.message,
        authUid
      });
      
      // Kullanıcı zaten yoksa, başarılı say
      if (firebaseError.code === 'auth/user-not-found') {
        console.log('ℹ️ User not found in Firebase Auth (already deleted):', authUid);
        return res.status(200).json({
          success: true,
          message: 'Firebase Auth kullanıcısı zaten silinmiş',
          authUid: authUid
        });
      }
      
      return res.status(500).json({
        success: false,
        message: `Firebase Auth kullanıcı silme hatası: ${firebaseError.message}`
      });
    }
  } catch (error) {
    console.error('❌ Error deleting Firebase Auth user:', error);
    return res.status(500).json({
      success: false,
      message: 'Sunucu hatası: ' + error.message
    });
  }
});

// Cleanup orphaned Firebase Auth users (users that exist in Firebase Auth but not in Firestore member_users)
// This endpoint requires admin authentication
router.post('/cleanup-orphaned-auth-users', async (req, res) => {
  try {
    console.log('🧹 Cleanup orphaned Firebase Auth users request received');
    
    const { getAdmin } = require('../config/firebaseAdmin');
    const firebaseAdmin = getAdmin();
    
    if (!firebaseAdmin) {
      console.error('❌ Firebase Admin SDK not initialized');
      return res.status(503).json({
        success: false,
        message: 'Firebase Admin SDK initialize edilemedi. FIREBASE_SERVICE_ACCOUNT_KEY environment variable kontrol edin.'
      });
    }

    // Firestore/SQLite'daki tüm member_users'ları al
    const USE_FIREBASE = process.env.VITE_USE_FIREBASE === 'true' || process.env.USE_FIREBASE === 'true';
    
    let firestoreAuthUids = new Set();
    let adminUid = null;
    
    if (USE_FIREBASE) {
      // Firebase kullanılıyorsa, Firestore Admin SDK ile direkt Firestore'dan al
      try {
        const firestore = firebaseAdmin.firestore();
        const memberUsersSnapshot = await firestore.collection('member_users').get();
        memberUsersSnapshot.forEach(doc => {
          const data = doc.data();
          if (data.authUid) {
            firestoreAuthUids.add(data.authUid);
          }
        });
        
        // Admin UID'sini Firestore'dan al
        const adminDoc = await firestore.collection('admin').doc('main').get();
        if (adminDoc.exists) {
          const adminData = adminDoc.data();
          if (adminData.uid) {
            adminUid = adminData.uid;
            firestoreAuthUids.add(adminUid);
          }
        }
        
        console.log(`📊 Found ${firestoreAuthUids.size} authUids in Firestore (including admin)`);
      } catch (firestoreError) {
        console.error('❌ Error reading from Firestore:', firestoreError);
        // Fallback: SQLite'dan da kontrol et
      }
    }
    
    // SQLite'dan da member_users'ları al (hem Firebase hem SQLite için backup)
    const db = require('../config/database');
    const memberUsers = await new Promise((resolve, reject) => {
      db.all('SELECT auth_uid, authUid FROM member_users WHERE (auth_uid IS NOT NULL AND auth_uid != "") OR (authUid IS NOT NULL AND authUid != "")', (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    // SQLite'daki authUid'leri de topla
    memberUsers.forEach(user => {
      if (user.auth_uid) firestoreAuthUids.add(user.auth_uid);
      if (user.authUid) firestoreAuthUids.add(user.authUid);
    });
    
    console.log(`📊 Found ${firestoreAuthUids.size} authUids in database (including admin)`);
    
    // Firebase Auth'daki tüm kullanıcıları al
    let allAuthUsers = [];
    let nextPageToken = null;
    
    do {
      const listUsersResult = await firebaseAdmin.auth().listUsers(1000, nextPageToken);
      allAuthUsers = allAuthUsers.concat(listUsersResult.users);
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
    
    console.log(`📊 Found ${allAuthUsers.length} users in Firebase Auth`);
    
    // Orphaned kullanıcıları bul (Firestore'da olmayan ama Firebase Auth'da olan)
    const orphanedUsers = allAuthUsers.filter(authUser => {
      // Admin kullanıcısını atla
      if (adminUid && authUser.uid === adminUid) return false;
      
      // Email formatı kontrolü - @ilsekreterlik.local olanları kontrol et
      const email = authUser.email || '';
      if (!email.includes('@ilsekreterlik.local')) {
        // Sistem kullanıcıları (admin vs) - bunları atla
        return false;
      }
      
      // Firestore'da yoksa orphaned
      return !firestoreAuthUids.has(authUser.uid);
    });
    
    console.log(`🗑️ Found ${orphanedUsers.length} orphaned users to delete`);
    
    // Orphaned kullanıcıları sil
    const deletedUsers = [];
    const errors = [];
    
    for (const orphanedUser of orphanedUsers) {
      try {
        await firebaseAdmin.auth().deleteUser(orphanedUser.uid);
        deletedUsers.push({
          uid: orphanedUser.uid,
          email: orphanedUser.email
        });
        console.log(`✅ Deleted orphaned user: ${orphanedUser.email} (${orphanedUser.uid})`);
      } catch (deleteError) {
        errors.push({
          uid: orphanedUser.uid,
          email: orphanedUser.email,
          error: deleteError.message
        });
        console.error(`❌ Error deleting orphaned user ${orphanedUser.uid}:`, deleteError.message);
      }
    }
    
    return res.status(200).json({
      success: true,
      message: `${deletedUsers.length} orphaned kullanıcı silindi`,
      deleted: deletedUsers.length,
      errors: errors.length,
      deletedUsers: deletedUsers,
      errors: errors
    });
  } catch (error) {
    console.error('❌ Error cleaning up orphaned auth users:', error);
    return res.status(500).json({
      success: false,
      message: 'Sunucu hatası: ' + error.message
    });
  }
});

// Sync member_users with Firebase Auth - ensures they are identical
// This endpoint:
// 1. Creates Firebase Auth users for member_users that don't have authUid
// 2. Deletes Firebase Auth users that don't exist in member_users
// 3. Updates Firebase Auth email/password if they differ from member_users
router.post('/sync-member-users-with-auth', async (req, res) => {
  try {
    console.log('🔄 Sync member_users with Firebase Auth request received');
    console.log('📥 Request headers:', req.headers);
    console.log('📥 Request body:', req.body);
    
    // Response'un gönderildiğinden emin olmak için timeout ekle
    res.setTimeout(300000, () => {
      if (!res.headersSent) {
        console.error('❌ Request timeout - response not sent');
        return res.status(504).json({
          success: false,
          message: 'İstek zaman aşımına uğradı (5 dakika)'
        });
      }
    });
    
    const { getAdmin } = require('../config/firebaseAdmin');
    const firebaseAdmin = getAdmin();
    
    if (!firebaseAdmin) {
      console.error('❌ Firebase Admin SDK not initialized');
      return res.status(503).json({
        success: false,
        message: 'Firebase Admin SDK initialize edilemedi. FIREBASE_SERVICE_ACCOUNT_KEY environment variable kontrol edin.'
      });
    }
    
    console.log('✅ Firebase Admin SDK initialized');

    const USE_FIREBASE = process.env.VITE_USE_FIREBASE === 'true' || process.env.USE_FIREBASE === 'true';
    const db = require('../config/database');
    const MemberUser = require('../models/MemberUser');
    const { decryptField } = require('../utils/crypto');
    
    // Get all member_users from database
    const memberUsers = await new Promise((resolve, reject) => {
      db.all(`
        SELECT mu.*, m.name as member_name, m.tc as member_tc, m.phone as member_phone
        FROM member_users mu
        LEFT JOIN members m ON mu.member_id = m.id
        WHERE mu.user_type = 'member' OR mu.user_type IS NULL
      `, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
    
    console.log(`📊 Found ${memberUsers.length} member_users in database`);
    
    // If Firebase is used, also get from Firestore
    let firestoreMemberUsers = [];
    if (USE_FIREBASE) {
      try {
        const firestore = firebaseAdmin.firestore();
        const memberUsersSnapshot = await firestore.collection('member_users')
          .where('userType', '==', 'member')
          .get();
        
        firestoreMemberUsers = memberUsersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log(`📊 Found ${firestoreMemberUsers.length} member_users in Firestore`);
      } catch (firestoreError) {
        console.error('❌ Error reading from Firestore:', firestoreError);
      }
    }
    
    // Combine SQLite and Firestore member_users (prioritize Firestore if both exist)
    const allMemberUsers = USE_FIREBASE && firestoreMemberUsers.length > 0 
      ? firestoreMemberUsers 
      : memberUsers;
    
    // Get all Firebase Auth users
    let allAuthUsers = [];
    let nextPageToken = null;
    
    do {
      const listUsersResult = await firebaseAdmin.auth().listUsers(1000, nextPageToken);
      allAuthUsers = allAuthUsers.concat(listUsersResult.users);
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
    
    // Filter only @ilsekreterlik.local users (member users)
    const memberAuthUsers = allAuthUsers.filter(authUser => {
      const email = authUser.email || '';
      return email.includes('@ilsekreterlik.local') && !email.includes('admin@');
    });
    
    console.log(`📊 Found ${memberAuthUsers.length} member users in Firebase Auth`);
    
    // Get admin UID to exclude
    let adminUid = null;
    if (USE_FIREBASE) {
      try {
        const firestore = firebaseAdmin.firestore();
        const adminDoc = await firestore.collection('admin').doc('main').get();
        if (adminDoc.exists) {
          adminUid = adminDoc.data().uid;
        }
      } catch (e) {
        console.warn('⚠️ Could not get admin UID:', e);
      }
    }
    
    const results = {
      created: [],
      deleted: [],
      updated: [],
      errors: []
    };
    
    // Step 1: Create Firebase Auth users for member_users that don't have authUid
    for (const memberUser of allMemberUsers) {
      try {
        // Skip if already has authUid
        const authUid = memberUser.auth_uid || memberUser.authUid;
        if (authUid) {
          // Verify user exists in Firebase Auth
          try {
            await firebaseAdmin.auth().getUser(authUid);
            // User exists, continue
            continue;
          } catch (e) {
            // User doesn't exist, clear authUid and create new
            console.log(`⚠️ Auth user ${authUid} not found, will create new`);
            if (USE_FIREBASE) {
              const firestore = firebaseAdmin.firestore();
              await firestore.collection('member_users').doc(memberUser.id).update({
                authUid: null
              });
            } else {
              await db.run('UPDATE member_users SET auth_uid = NULL WHERE id = ?', [memberUser.id]);
            }
          }
        }
        
        // Get username and password
        let username = memberUser.username;
        let password = memberUser.password;
        
        // If password is encrypted, decrypt it
        if (password && password.startsWith('U2FsdGVkX1')) {
          password = decryptField(password);
        }
        
        // If username is not available, try to get from member
        if (!username && memberUser.member_id) {
          const member = await db.get('SELECT * FROM members WHERE id = ?', [memberUser.member_id]);
          if (member) {
            username = decryptField(member.tc) || member.tc;
            const memberPhone = decryptField(member.phone) || member.phone;
            password = memberPhone.replace(/\D/g, '');
          }
        }
        
        if (!username || !password) {
          results.errors.push({
            memberUserId: memberUser.id,
            error: 'Username or password missing'
          });
          continue;
        }
        
        // Create Firebase Auth user
        const email = `${username}@ilsekreterlik.local`;
        const authUser = await firebaseAdmin.auth().createUser({
          email: email,
          password: password,
          emailVerified: false,
          displayName: memberUser.member_name || username
        });
        
        // Update member_user with authUid
        if (USE_FIREBASE) {
          const firestore = firebaseAdmin.firestore();
          await firestore.collection('member_users').doc(memberUser.id).update({
            authUid: authUser.uid
          });
        } else {
          await db.run('UPDATE member_users SET auth_uid = ? WHERE id = ?', [authUser.uid, memberUser.id]);
        }
        
        results.created.push({
          memberUserId: memberUser.id,
          username: username,
          authUid: authUser.uid,
          email: email
        });
        
        console.log(`✅ Created Firebase Auth user for member_user ${memberUser.id}: ${email}`);
      } catch (error) {
        console.error(`❌ Error creating Firebase Auth user for member_user ${memberUser.id}:`, error);
        results.errors.push({
          memberUserId: memberUser.id,
          error: error.message
        });
      }
    }
    
    // Step 2: Delete Firebase Auth users that don't exist in member_users
    const memberUserAuthUids = new Set();
    allMemberUsers.forEach(mu => {
      const uid = mu.auth_uid || mu.authUid;
      if (uid) memberUserAuthUids.add(uid);
    });
    
    for (const authUser of memberAuthUsers) {
      // Skip admin
      if (adminUid && authUser.uid === adminUid) continue;
      
      // Skip if exists in member_users
      if (memberUserAuthUids.has(authUser.uid)) {
        // Verify email matches username
        const email = authUser.email || '';
        const username = email.replace('@ilsekreterlik.local', '');
        
        // Find corresponding member_user
        const memberUser = allMemberUsers.find(mu => {
          const muUsername = mu.username;
          return muUsername === username;
        });
        
        if (memberUser) {
          // Check if password needs update (if phone changed)
          // This is handled in member update, so we skip here
          continue;
        }
      }
      
      // User doesn't exist in member_users, delete from Auth
      try {
        await firebaseAdmin.auth().deleteUser(authUser.uid);
        results.deleted.push({
          authUid: authUser.uid,
          email: authUser.email
        });
        console.log(`✅ Deleted orphaned Firebase Auth user: ${authUser.email}`);
      } catch (error) {
        console.error(`❌ Error deleting Firebase Auth user ${authUser.uid}:`, error);
        results.errors.push({
          authUid: authUser.uid,
          error: error.message
        });
      }
    }
    
    // Step 3: Update Firebase Auth users if email/password differs
    for (const memberUser of allMemberUsers) {
      const authUid = memberUser.auth_uid || memberUser.authUid;
      if (!authUid) continue; // Already handled in Step 1
      
      try {
        const authUser = await firebaseAdmin.auth().getUser(authUid);
        const email = authUser.email || '';
        const username = memberUser.username;
        const expectedEmail = `${username}@ilsekreterlik.local`;
        
        // Check if email needs update
        if (email !== expectedEmail) {
          await firebaseAdmin.auth().updateUser(authUid, {
            email: expectedEmail,
            emailVerified: false
          });
          results.updated.push({
            memberUserId: memberUser.id,
            authUid: authUid,
            change: 'email',
            oldEmail: email,
            newEmail: expectedEmail
          });
          console.log(`✅ Updated email for auth user ${authUid}: ${email} -> ${expectedEmail}`);
        }
        
        // Display name update (if member name available)
        if (memberUser.member_name && authUser.displayName !== memberUser.member_name) {
          await firebaseAdmin.auth().updateUser(authUid, {
            displayName: memberUser.member_name
          });
          results.updated.push({
            memberUserId: memberUser.id,
            authUid: authUid,
            change: 'displayName',
            oldDisplayName: authUser.displayName,
            newDisplayName: memberUser.member_name
          });
          console.log(`✅ Updated displayName for auth user ${authUid}`);
        }
      } catch (error) {
        console.error(`❌ Error updating Firebase Auth user ${authUid}:`, error);
        results.errors.push({
          memberUserId: memberUser.id,
          authUid: authUid,
          error: error.message
        });
      }
    }
    
    const responseData = {
      success: true,
      message: `Senkronizasyon tamamlandı: ${results.created.length} oluşturuldu, ${results.deleted.length} silindi, ${results.updated.length} güncellendi`,
      results: {
        created: results.created.length,
        deleted: results.deleted.length,
        updated: results.updated.length,
        errors: results.errors.length,
        details: results
      }
    };
    
    console.log('✅ Sync completed, sending response:', JSON.stringify(responseData).substring(0, 200));
    
    // Response'un gönderildiğinden emin ol
    if (res.headersSent) {
      console.warn('⚠️ Response already sent, skipping');
      return;
    }
    
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('❌ Error syncing member_users with Firebase Auth:', error);
    console.error('❌ Error stack:', error.stack);
    
    // Response'un gönderildiğinden emin ol
    if (res.headersSent) {
      console.warn('⚠️ Response already sent, cannot send error');
      return;
    }
    
    return res.status(500).json({
      success: false,
      message: 'Sunucu hatası: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;