/**
 * Test Başmüşahit Ekleme Scripti
 * 
 * Bu script Firebase'e test amaçlı bir başmüşahit ekler.
 * Kullanım: node scripts/add-test-chief-observer.js
 */

const { initFirebaseAdmin } = require('../config/firebaseAdmin');
const { decryptData } = require('../utils/crypto');

async function addTestChiefObserver() {
  try {
    console.log('🔥 Firebase Admin SDK başlatılıyor...');
    const admin = initFirebaseAdmin();
    
    if (!admin) {
      console.error('❌ Firebase Admin SDK başlatılamadı');
      return;
    }
    
    const db = admin.firestore();
    const database = db.database('yrpilsekreterligi');
    
    // İlk üyeyi bul (test için)
    console.log('🔍 Üyeler aranıyor...');
    const membersSnapshot = await db.collection('members').get();
    const members = [];
    
    membersSnapshot.forEach(doc => {
      const data = doc.data();
      if (!data.archived) {
        members.push({ id: doc.id, ...data });
      }
    });
    
    if (members.length === 0) {
      console.error('❌ Hiç üye bulunamadı. Önce bir üye ekleyin.');
      return;
    }
    
    // İlk üyeyi al
    const testMember = members[0];
    let memberTc = testMember.tc || testMember.tcNo || '';
    
    // TC decrypt et
    try {
      if (memberTc && memberTc.startsWith('U2FsdGVkX1')) {
        memberTc = decryptData(memberTc);
      }
    } catch (e) {
      console.warn('⚠️ TC decrypt edilemedi, direkt kullanılıyor');
    }
    
    console.log('✅ Test üye bulundu:', {
      id: testMember.id,
      name: testMember.name,
      tc: memberTc
    });
    
    // Sandık bul veya oluştur
    console.log('🔍 Sandık aranıyor...');
    const ballotBoxesSnapshot = await db.collection('ballot_boxes').get();
    let testBallotBox = null;
    
    ballotBoxesSnapshot.forEach(doc => {
      if (!testBallotBox) {
        testBallotBox = { id: doc.id, ...doc.data() };
      }
    });
    
    if (!testBallotBox) {
      console.log('📦 Test sandığı oluşturuluyor...');
      // İlk ilçeyi bul
      const districtsSnapshot = await db.collection('districts').get();
      let districtId = null;
      districtsSnapshot.forEach(doc => {
        if (!districtId) {
          districtId = doc.id;
        }
      });
      
      const newBallotBox = {
        ballot_number: '9999',
        institution_name: 'Test Sandığı',
        district_id: districtId || null,
        town_id: null,
        neighborhood_id: null,
        village_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const ballotBoxRef = await db.collection('ballot_boxes').add(newBallotBox);
      testBallotBox = { id: ballotBoxRef.id, ...newBallotBox };
      console.log('✅ Test sandığı oluşturuldu:', testBallotBox.id);
    } else {
      console.log('✅ Mevcut sandık kullanılıyor:', testBallotBox.id);
    }
    
    // Başmüşahit oluştur
    console.log('👤 Test başmüşahit oluşturuluyor...');
    const testObserver = {
      ballot_box_id: testBallotBox.id,
      tc: memberTc, // Şifrelenmemiş TC
      name: testMember.name || 'Test Başmüşahit',
      phone: testMember.phone || '05551234567',
      is_chief_observer: true,
      district_id: testBallotBox.district_id || null,
      town_id: testBallotBox.town_id || null,
      neighborhood_id: testBallotBox.neighborhood_id || null,
      village_id: testBallotBox.village_id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    const observerRef = await db.collection('ballot_box_observers').add(testObserver);
    console.log('✅ Test başmüşahit oluşturuldu:', observerRef.id);
    
    // Kullanıcı bilgilerini göster
    console.log('\n📋 TEST BAŞMÜŞAHİT BİLGİLERİ:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Ad Soyad:', testObserver.name);
    console.log('🆔 TC Kimlik:', memberTc);
    console.log('📞 Telefon:', testObserver.phone);
    console.log('🗳️ Sandık Numarası:', testBallotBox.ballot_number);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🔐 GİRİŞ BİLGİLERİ:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Kullanıcı Adı:', testBallotBox.ballot_number || memberTc);
    console.log('Şifre:', memberTc);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🌐 Giriş Sayfası: /chief-observer-login');
    console.log('✅ Script tamamlandı!');
    
  } catch (error) {
    console.error('❌ Hata:', error);
    console.error('Stack:', error.stack);
  }
}

// Script'i çalıştır
addTestChiefObserver();

