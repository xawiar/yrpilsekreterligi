/**
 * Member Users Onarım + Temizlik Script'i
 *
 * Kullanım:
 *   node scripts/repair-member-users.js              # Dry-run (sadece rapor, değişiklik yok)
 *   node scripts/repair-member-users.js --apply      # Değişiklikleri uygula (onay ister)
 *   node scripts/repair-member-users.js --apply --yes  # Onaysız uygula
 *
 * Ne yapar:
 *   1. Orphan kayıtları tespit ve siler (members'ta karşılığı olmayan memberId)
 *   2. Duplicate kayıtları tespit ve siler (aynı username/memberId)
 *   3. Boş username'leri onarır (members'tan TC çeker, decrypt dener)
 *   4. Firebase Auth eksik olanları admin SDK ile oluşturur
 *   5. isActive / is_active iki alanını senkronize eder
 *
 * Not: Mevcut script pattern'i (delete-member-direct.js, list-all-members.js,
 * find-member-by-tc-phone.js) birebir takip edilmiştir: dotenv + getAdmin() +
 * CryptoJS + aynı ENCRYPTION_KEY default değeri.
 */

// dotenv yükle (eğer varsa)
try {
  require('dotenv').config();
} catch (e) {
  // dotenv yoksa devam et
}

const readline = require('readline');
const CryptoJS = require('crypto-js');

const { getAdmin } = require('../config/firebaseAdmin');
const firebaseAdmin = getAdmin();

if (!firebaseAdmin) {
  console.error('❌ Firebase Admin SDK initialize edilemedi.');
  console.error('   FIREBASE_SERVICE_ACCOUNT_KEY environment variable kontrol edin.');
  process.exit(1);
}

const firestore = firebaseAdmin.firestore();
const auth = firebaseAdmin.auth();

// ---- Flag parsing ----
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const AUTO_YES = args.includes('--yes');
const DRY_RUN = !APPLY;

// ---- Decrypt ----
// Mevcut script'lerdeki default değer ile birebir aynı (tutarlılık için).
// Kullanıcı isterse ENCRYPTION_KEY env variable ile override edebilir.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ||
  'ilsekreterlik-app-encryption-key-2024-secret-very-long-key-for-security';

function decryptData(encryptedData) {
  if (!encryptedData || !encryptedData.toString().startsWith('U2FsdGVkX1')) {
    return encryptedData;
  }
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData.toString(), ENCRYPTION_KEY);
    const plain = bytes.toString(CryptoJS.enc.Utf8);
    if (!plain) return null; // decrypt başarısız (yanlış key) — boş string döner
    return plain;
  } catch (error) {
    return null;
  }
}

// ---- Yardımcılar ----
function normalizeTc(raw) {
  if (!raw) return '';
  return String(raw).replace(/\D/g, '');
}

function isActiveFlag(mu) {
  // iki alandan herhangi biri true ise aktif kabul et
  if (mu.isActive === true || mu.is_active === true) return true;
  if (mu.isActive === false || mu.is_active === false) return false;
  return true; // default aktif
}

async function askConfirmation(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((resolve) => rl.question(question, resolve));
  rl.close();
  const a = (answer || '').trim().toLowerCase();
  return a === 'evet' || a === 'e' || a === 'yes' || a === 'y';
}

// ---- Ana akış ----
async function main() {
  console.log('');
  console.log(DRY_RUN
    ? '🔍 DRY-RUN MODU — değişiklik YAPILMAYACAK (sadece rapor)'
    : '⚡ APPLY MODU — değişiklikler UYGULANACAK');
  console.log('');

  // 1) Veriyi oku
  console.log('📥 Veriler çekiliyor (member_users + members)...');
  const [memberUsersSnap, membersSnap] = await Promise.all([
    firestore.collection('member_users').get(),
    firestore.collection('members').get(),
  ]);

  const memberUsers = memberUsersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const members = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const membersById = new Map(members.map((m) => [m.id, m]));

  // members → TC map (decrypt edilmiş, normalize edilmiş)
  const membersByTc = new Map();
  for (const m of members) {
    let tc = m.tc || m.tcNo;
    if (tc && typeof tc === 'string' && tc.startsWith('U2FsdGVkX1')) {
      tc = decryptData(tc);
    }
    const norm = normalizeTc(tc);
    if (norm && norm.length === 11) membersByTc.set(norm, m);
  }

  console.log(`📊 Toplam: ${memberUsers.length} member_users, ${members.length} members`);
  console.log(`   ✓ members'ta decrypt edilmiş TC map: ${membersByTc.size} kayıt`);

  // 2) Analiz
  const orphans = [];         // members'ta karşılığı olmayan memberId
  const emptyUsername = [];   // username boş
  const emptyMemberId = [];   // userType=member ama memberId yok
  const duplicates = [];      // aynı username (birden fazla)
  const missingAuth = [];     // authUid yok (geçerli kayıtlar için)
  const statusMismatch = [];  // isActive !== is_active

  // username sayaç — duplicate tespiti için
  const usernameCounts = new Map();
  for (const mu of memberUsers) {
    const uname = (mu.username || '').toString().trim();
    if (uname) {
      usernameCounts.set(uname, (usernameCounts.get(uname) || 0) + 1);
    }
  }

  for (const mu of memberUsers) {
    const mid = mu.memberId || mu.member_id;
    const uname = (mu.username || '').toString().trim();
    const userType = mu.userType || mu.user_type || 'member';

    // Member tipi kayıtlara özgü kontroller
    if (userType === 'member') {
      if (mid && !membersById.has(mid)) {
        orphans.push(mu);
      }
      if (!mid) {
        emptyMemberId.push(mu);
      }
      if (!uname) {
        emptyUsername.push(mu);
      }
      if (uname && (usernameCounts.get(uname) || 0) > 1) {
        duplicates.push(mu);
      }
    }

    if (!mu.authUid) {
      missingAuth.push(mu);
    }

    if (
      mu.isActive !== undefined &&
      mu.is_active !== undefined &&
      mu.isActive !== mu.is_active
    ) {
      statusMismatch.push(mu);
    }
  }

  // 3) Teşhis raporu
  console.log('');
  console.log('──────────── TEŞHİS RAPORU ────────────');
  console.log(`🗑️  Orphan (memberId var ama members'ta yok) : ${orphans.length}`);
  console.log(`❓  Username boş                               : ${emptyUsername.length}`);
  console.log(`🆔  memberId boş (userType=member)             : ${emptyMemberId.length}`);
  console.log(`🔁  Duplicate username (aynı TC)               : ${duplicates.length}`);
  console.log(`🔐  Firebase Auth eksik (authUid yok)          : ${missingAuth.length}`);
  console.log(`⚠️   isActive / is_active farkı                 : ${statusMismatch.length}`);
  console.log('────────────────────────────────────────');

  // Detaylı örnek listeleme (ilk 5)
  if (orphans.length) {
    console.log('\n🗑️  Orphan örnekleri (ilk 5):');
    orphans.slice(0, 5).forEach((mu) => {
      console.log(`   - doc=${mu.id}  memberId=${mu.memberId || mu.member_id}  username=${mu.username || '(boş)'}`);
    });
  }
  if (emptyUsername.length) {
    console.log('\n❓  Username boş örnekleri (ilk 5):');
    emptyUsername.slice(0, 5).forEach((mu) => {
      console.log(`   - doc=${mu.id}  memberId=${mu.memberId || mu.member_id || '(yok)'}`);
    });
  }
  if (duplicates.length) {
    console.log('\n🔁  Duplicate username örnekleri (ilk 5):');
    const dupSample = new Set();
    duplicates.forEach((mu) => {
      if (mu.username) dupSample.add(mu.username);
    });
    [...dupSample].slice(0, 5).forEach((u) => {
      const list = memberUsers.filter((x) => (x.username || '').trim() === u);
      console.log(`   - username=${u}  (${list.length} kayıt): ${list.map((x) => x.id).join(', ')}`);
    });
  }

  if (DRY_RUN) {
    console.log('');
    console.log('💡 Gerçek onarım için:  node scripts/repair-member-users.js --apply');
    console.log('💡 Onaysız uygulamak için ekstra:  --yes');
    console.log('');
    return;
  }

  // 4) Onay
  if (!AUTO_YES) {
    console.log('');
    console.log('⚠️  DİKKAT: Aşağıdaki değişiklikler Firestore + Firebase Auth üzerinde UYGULANACAK:');
    console.log(`   - ${orphans.length} orphan member_user silinecek`);
    console.log(`   - Duplicate username grupları için fazlalıklar silinecek`);
    console.log(`   - ${emptyUsername.length} boş username, members'tan TC çekilerek onarılacak (decrypt başarılıysa)`);
    console.log(`   - authUid eksik kayıtlar için Firebase Auth kullanıcısı oluşturulacak`);
    console.log(`   - ${statusMismatch.length} kayıtta isActive / is_active senkronize edilecek`);
    console.log('');
    const ok = await askConfirmation('⚠️  UYGULANSIN MI? (evet/hayır): ');
    if (!ok) {
      console.log('❌ İptal edildi, hiçbir değişiklik yapılmadı.');
      return;
    }
  }

  console.log('');
  console.log('🔧 Onarım başlıyor...');
  console.log('');

  // ---- 5a) Orphan sil ----
  let deletedOrphans = 0;
  for (const mu of orphans) {
    try {
      if (mu.authUid) {
        try {
          await auth.deleteUser(mu.authUid);
        } catch (authErr) {
          if (authErr.code !== 'auth/user-not-found') {
            console.warn(`   ⚠️ Auth silme uyarısı ${mu.id}: ${authErr.message}`);
          }
        }
      }
      await firestore.collection('member_users').doc(mu.id).delete();
      deletedOrphans++;
    } catch (e) {
      console.error(`   ❌ Orphan silme hatası ${mu.id}: ${e.message}`);
    }
  }
  console.log(`✅ Orphan silindi: ${deletedOrphans}/${orphans.length}`);

  // ---- 5b) Duplicate temizle ----
  // Aynı username'e sahip grupları oluştur, en uygun olanı sakla
  const dupGroups = new Map();
  for (const mu of duplicates) {
    // Yukarıda silinen orphan'lar arasında olmadığından emin ol
    if (orphans.some((o) => o.id === mu.id)) continue;
    const key = (mu.username || '').trim();
    if (!key) continue;
    if (!dupGroups.has(key)) dupGroups.set(key, []);
    dupGroups.get(key).push(mu);
  }

  let deletedDups = 0;
  for (const [uname, group] of dupGroups) {
    if (group.length < 2) continue;
    // Öncelik sırası: (1) aktif, (2) memberId dolu, (3) authUid dolu, (4) en eski (createdAt)
    group.sort((a, b) => {
      const aActive = isActiveFlag(a) ? 1 : 0;
      const bActive = isActiveFlag(b) ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;

      const aHasMid = (a.memberId || a.member_id) ? 1 : 0;
      const bHasMid = (b.memberId || b.member_id) ? 1 : 0;
      if (aHasMid !== bHasMid) return bHasMid - aHasMid;

      const aHasAuth = a.authUid ? 1 : 0;
      const bHasAuth = b.authUid ? 1 : 0;
      if (aHasAuth !== bHasAuth) return bHasAuth - aHasAuth;

      // createdAt (Timestamp veya number) — en eskiyi ilk sıraya
      const aTs = (a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0));
      const bTs = (b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0));
      return aTs - bTs;
    });

    const keep = group[0];
    for (let i = 1; i < group.length; i++) {
      const toDel = group[i];
      try {
        if (toDel.authUid && toDel.authUid !== keep.authUid) {
          try {
            await auth.deleteUser(toDel.authUid);
          } catch (authErr) {
            if (authErr.code !== 'auth/user-not-found') {
              console.warn(`   ⚠️ Dup auth silme uyarısı ${toDel.id}: ${authErr.message}`);
            }
          }
        }
        await firestore.collection('member_users').doc(toDel.id).delete();
        deletedDups++;
      } catch (e) {
        console.error(`   ❌ Duplicate silme hatası ${toDel.id}: ${e.message}`);
      }
    }
    console.log(`   🔁 username=${uname}: ${group.length - 1} fazlalık silindi (keep=${keep.id})`);
  }
  console.log(`✅ Duplicate silindi: ${deletedDups}`);

  // ---- 5c) Boş username onar ----
  // memberId varsa: members'tan TC çek, decrypt et, username'e yaz
  let repairedUsername = 0;
  let skippedUsername = 0;
  for (const mu of emptyUsername) {
    // Silinen orphan/duplicate'ler arasında olmadığından emin ol
    if (orphans.some((o) => o.id === mu.id)) continue;

    const mid = mu.memberId || mu.member_id;
    if (!mid || !membersById.has(mid)) {
      skippedUsername++;
      continue;
    }
    const member = membersById.get(mid);
    let tc = member.tc || member.tcNo;
    if (tc && typeof tc === 'string' && tc.startsWith('U2FsdGVkX1')) {
      tc = decryptData(tc);
    }
    const normalizedTc = normalizeTc(tc);
    if (!normalizedTc || normalizedTc.length !== 11) {
      skippedUsername++;
      continue;
    }
    try {
      await firestore.collection('member_users').doc(mu.id).update({ username: normalizedTc });
      repairedUsername++;
    } catch (e) {
      console.error(`   ❌ Username onarım hatası ${mu.id}: ${e.message}`);
    }
  }
  console.log(`✅ Username onarıldı: ${repairedUsername} (atlanan: ${skippedUsername})`);

  // ---- 5c-bis) memberId boş olanları username (TC) üzerinden eşle ----
  let repairedMemberId = 0;
  let skippedMemberId = 0;
  for (const mu of emptyMemberId) {
    if (orphans.some((o) => o.id === mu.id)) continue;
    const uname = normalizeTc(mu.username);
    if (!uname || uname.length !== 11) {
      skippedMemberId++;
      continue;
    }
    const member = membersByTc.get(uname);
    if (!member) {
      skippedMemberId++;
      continue;
    }
    try {
      await firestore.collection('member_users').doc(mu.id).update({
        memberId: member.id,
        member_id: member.id,
      });
      repairedMemberId++;
    } catch (e) {
      console.error(`   ❌ memberId onarım hatası ${mu.id}: ${e.message}`);
    }
  }
  console.log(`✅ memberId onarıldı: ${repairedMemberId} (atlanan: ${skippedMemberId})`);

  // ---- 5d) Firebase Auth eksik olanları oluştur ----
  // Orphan + duplicate temizliğinden sonra fresh okumak doğru olur.
  console.log('');
  console.log('🔐 Firebase Auth eksik olanlar taranıyor (fresh read)...');
  const freshSnap = await firestore.collection('member_users').get();
  const freshMemberUsers = freshSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  let createdAuth = 0;
  let skippedAuth = 0;
  for (const mu of freshMemberUsers) {
    if (mu.authUid) continue;
    const uname = (mu.username || '').toString().trim();
    if (!uname || uname.length < 11) {
      skippedAuth++;
      continue;
    }

    // Şifre: mu.password varsa decrypt dene; yoksa TC'yi şifre olarak kullanma — atla
    let pwd = mu.password || '';
    if (pwd && typeof pwd === 'string' && pwd.startsWith('U2FsdGVkX1')) {
      const decPwd = decryptData(pwd);
      pwd = decPwd || '';
    }
    pwd = String(pwd).trim();
    // Sadece rakam filtrele (telefon numarası formatı varsayımıyla)
    const digitPwd = pwd.replace(/\D/g, '');
    // En az 6 karakter şart — Firebase Auth zorunluluğu
    if (!digitPwd || digitPwd.length < 6) {
      skippedAuth++;
      continue;
    }

    try {
      const email = `${uname}@ilsekreterlik.local`;
      let authUser;
      try {
        authUser = await auth.createUser({
          email,
          password: digitPwd,
          emailVerified: true,
          disabled: false,
        });
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-exists') {
          authUser = await auth.getUserByEmail(email);
          await auth.updateUser(authUser.uid, { password: digitPwd });
        } else {
          throw authErr;
        }
      }
      await firestore.collection('member_users').doc(mu.id).update({ authUid: authUser.uid });
      createdAuth++;
    } catch (e) {
      console.error(`   ❌ Auth oluşturma hatası ${mu.id} (username=${uname}): ${e.message}`);
      skippedAuth++;
    }
  }
  console.log(`✅ Firebase Auth oluşturuldu/güncellendi: ${createdAuth} (atlanan: ${skippedAuth})`);

  // ---- 5e) isActive / is_active senkronize ----
  let synced = 0;
  // Orphan/duplicate silinenleri ayıkla
  const remainingMismatch = statusMismatch.filter(
    (mu) => !orphans.some((o) => o.id === mu.id),
  );
  for (const mu of remainingMismatch) {
    try {
      // isActive öncelikli — undefined ise is_active kullan
      const active = mu.isActive !== undefined ? mu.isActive : mu.is_active;
      await firestore.collection('member_users').doc(mu.id).update({
        isActive: active,
        is_active: active,
      });
      synced++;
    } catch (e) {
      console.error(`   ❌ Status senkronizasyon hatası ${mu.id}: ${e.message}`);
    }
  }
  console.log(`✅ Status (isActive/is_active) senkronize: ${synced}`);

  // ---- ÖZET ----
  console.log('');
  console.log('──────────── ÖZET ────────────');
  console.log(`🗑️  Silinen orphan          : ${deletedOrphans}`);
  console.log(`🔁  Silinen duplicate        : ${deletedDups}`);
  console.log(`📝  Onarılan username        : ${repairedUsername}`);
  console.log(`🆔  Onarılan memberId        : ${repairedMemberId}`);
  console.log(`🔐  Oluşan/güncellenen Auth  : ${createdAuth}`);
  console.log(`⚙️   Senkronize edilen status : ${synced}`);
  console.log('──────────────────────────────');
  console.log('');
  console.log('🎉 Onarım tamamlandı.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('');
    console.error('❌ FATAL:', e);
    process.exit(1);
  });
