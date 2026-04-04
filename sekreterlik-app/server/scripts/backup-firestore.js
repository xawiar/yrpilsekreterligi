/**
 * Firestore Yedekleme Script'i
 *
 * Tum Firestore koleksiyonlarini JSON dosyalarina yedekler.
 *
 * Kullanim:
 *   node scripts/backup-firestore.js
 *
 * Gereksinimler:
 *   - FIREBASE_SERVICE_ACCOUNT_KEY env variable tanimli olmali
 *   - USE_FIREBASE=true olmali
 *
 * Alternatif: Firebase Console uzerinden otomatik yedekleme
 *   1. Firebase Console > Firestore > Import/Export sayfasina gidin
 *   2. Google Cloud Console > Firestore > Schedules kismindan
 *      otomatik export schedule olusturun
 *   3. GCS bucket secin ve cron zamanlamasini ayarlayin
 *      Ornek: Her gun gece 03:00 -> 0 3 * * *
 *   4. gcloud komutu ile de yapilabilir:
 *      gcloud firestore export gs://YOUR_BUCKET --collection-ids=members,meetings,events
 */

const path = require('path');
const fs = require('fs');

// .env dosyasini yukle
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {
  // dotenv yoksa devam et
}

const { initFirebaseAdmin, getAdmin } = require('../config/firebaseAdmin');

const BACKUPS_DIR = path.join(__dirname, '..', 'backups', 'firestore');

// Yedeklenecek koleksiyonlar
const COLLECTIONS = [
  'members',
  'meetings',
  'events',
  'member_registrations',
  'notifications',
  'users',
  'districts',
  'towns',
  'neighborhoods',
  'villages',
  'stk_organizations',
  'public_institutions',
  'ballot_boxes',
  'observers',
  'neighborhood_representatives',
  'village_representatives',
  'groups',
  'performance_score_config',
  'polls',
  'poll_votes',
  'personal_documents'
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

async function backupCollection(db, collectionName) {
  try {
    const snapshot = await db.collection(collectionName).get();

    if (snapshot.empty) {
      console.log(`  [SKIP] ${collectionName}: bos koleksiyon`);
      return { name: collectionName, count: 0, data: [] };
    }

    const docs = [];
    snapshot.forEach(doc => {
      docs.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`  [OK]   ${collectionName}: ${docs.length} belge`);
    return { name: collectionName, count: docs.length, data: docs };
  } catch (error) {
    console.error(`  [FAIL] ${collectionName}: ${error.message}`);
    return { name: collectionName, count: 0, data: [], error: error.message };
  }
}

async function main() {
  console.log('Firestore Yedekleme Basliyor...\n');

  // Firebase Admin SDK'yi baslat
  const admin = initFirebaseAdmin();
  if (!admin) {
    console.error('Firebase Admin SDK baslatilamadi.');
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY env variable tanimli oldugundan emin olun.');
    process.exit(1);
  }

  const db = admin.firestore();
  const ts = timestamp();
  const backupDir = path.join(BACKUPS_DIR, ts);
  ensureDir(backupDir);

  console.log(`Yedekleme dizini: ${backupDir}\n`);

  let totalDocs = 0;
  const summary = [];

  for (const collectionName of COLLECTIONS) {
    const result = await backupCollection(db, collectionName);
    totalDocs += result.count;
    summary.push({ name: result.name, count: result.count, error: result.error });

    if (result.data.length > 0) {
      const filePath = path.join(backupDir, `${collectionName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(result.data, null, 2), 'utf-8');
    }
  }

  // Ozet dosyasi yaz
  const summaryData = {
    timestamp: new Date().toISOString(),
    totalCollections: COLLECTIONS.length,
    totalDocuments: totalDocs,
    collections: summary
  };
  fs.writeFileSync(
    path.join(backupDir, '_summary.json'),
    JSON.stringify(summaryData, null, 2),
    'utf-8'
  );

  console.log(`\nYedekleme Tamamlandi!`);
  console.log(`Toplam: ${totalDocs} belge, ${COLLECTIONS.length} koleksiyon`);
  console.log(`Konum: ${backupDir}`);

  // Eski yedekleri temizle (son 30 yedek kalsin)
  cleanupOldBackups(30);

  process.exit(0);
}

function cleanupOldBackups(keepCount) {
  if (!fs.existsSync(BACKUPS_DIR)) return;

  const dirs = fs.readdirSync(BACKUPS_DIR)
    .filter(d => fs.statSync(path.join(BACKUPS_DIR, d)).isDirectory())
    .sort()
    .reverse();

  if (dirs.length <= keepCount) return;

  const toDelete = dirs.slice(keepCount);
  for (const dir of toDelete) {
    const fullPath = path.join(BACKUPS_DIR, dir);
    fs.rmSync(fullPath, { recursive: true, force: true });
    console.log(`Eski yedek silindi: ${dir}`);
  }
}

main().catch(err => {
  console.error('Yedekleme hatasi:', err);
  process.exit(1);
});
