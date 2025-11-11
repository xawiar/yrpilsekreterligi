/**
 * Belirli bir TC'ye sahip kullanıcının bilgilerini kontrol eder
 * Debug/test amaçlı kullanılır
 */
import FirebaseService from '../services/FirebaseService';

export const checkUserCredentials = async (tcNumber) => {
  try {
    console.log(`🔍 Checking credentials for TC: ${tcNumber}`);
    
    // Normalize TC (sadece rakamlar)
    const normalizedTC = tcNumber.toString().replace(/\D/g, '');
    
    // 1. Members collection'ından üyeyi bul
    const allMembers = await FirebaseService.getAll('members', {
      where: [{ field: 'archived', operator: '==', value: false }]
    }, true); // decrypt = true
    
    const member = allMembers.find(m => {
      const memberTC = (m.tc || '').toString().replace(/\D/g, '');
      return memberTC === normalizedTC;
    });
    
    if (!member) {
      console.log(`❌ Member not found for TC: ${normalizedTC}`);
      return {
        found: false,
        message: 'Üye bulunamadı'
      };
    }
    
    console.log(`✅ Member found:`, {
      id: member.id,
      name: member.name,
      tc: member.tc,
      phone: member.phone
    });
    
    // 2. Member users collection'ından kullanıcıyı bul
    const allMemberUsers = await FirebaseService.getAll('member_users', {
      where: [{ field: 'userType', operator: '==', value: 'member' }]
    }, false);
    
    const memberUser = allMemberUsers.find(u => {
      const userId = u.memberId || u.member_id;
      return String(userId) === String(member.id);
    });
    
    if (!memberUser) {
      console.log(`❌ Member user not found for member ID: ${member.id}`);
      return {
        found: true,
        member: {
          id: member.id,
          name: member.name,
          tc: member.tc,
          phone: member.phone
        },
        user: null,
        message: 'Üye kullanıcısı bulunamadı',
        match: false
      };
    }
    
    console.log(`✅ Member user found:`, {
      id: memberUser.id,
      username: memberUser.username,
      password: memberUser.password ? `${memberUser.password.substring(0, 3)}***` : 'N/A'
    });
    
    // 3. Karşılaştır
    const expectedUsername = (member.tc || '').toString().replace(/\D/g, '');
    const expectedPassword = (member.phone || '').toString().replace(/\D/g, '');
    const actualUsername = (memberUser.username || '').toString().replace(/\D/g, '');
    const actualPassword = (memberUser.password || '').toString().replace(/\D/g, '');
    
    const usernameMatch = expectedUsername === actualUsername;
    const passwordMatch = expectedPassword === actualPassword;
    const isMatch = usernameMatch && passwordMatch;
    
    const result = {
      found: true,
      member: {
        id: member.id,
        name: member.name,
        tc: member.tc,
        phone: member.phone,
        normalizedTC: expectedUsername,
        normalizedPhone: expectedPassword
      },
      user: {
        id: memberUser.id,
        username: memberUser.username,
        password: memberUser.password ? `${memberUser.password.substring(0, 3)}***` : 'N/A',
        normalizedUsername: actualUsername,
        normalizedPassword: actualPassword ? `${actualPassword.substring(0, 3)}***` : 'N/A'
      },
      match: isMatch,
      usernameMatch,
      passwordMatch,
      message: isMatch 
        ? '✅ Üye ve kullanıcı bilgileri eşleşiyor' 
        : `❌ Eşleşme hatası: ${!usernameMatch ? 'Kullanıcı adı' : ''} ${!passwordMatch ? 'Şifre' : ''} eşleşmiyor`
    };
    
    console.log('📊 Comparison result:', result);
    
    return result;
  } catch (error) {
    console.error('❌ Error checking user credentials:', error);
    return {
      found: false,
      error: error.message,
      message: 'Kontrol sırasında hata oluştu'
    };
  }
};

