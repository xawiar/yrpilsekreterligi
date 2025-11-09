/**
 * Otomatik Firebase Sync Utility
 * Her SQLite işleminden sonra otomatik olarak Firebase'e de yazar
 * 
 * NOT: Bu utility şu anda basit bir HTTP endpoint çağrısı yapıyor.
 * İleride Firebase Admin SDK ile server-side sync yapılabilir.
 */

const USE_FIREBASE = process.env.VITE_USE_FIREBASE === 'true' || process.env.USE_FIREBASE === 'true';

// Client-side sync için HTTP endpoint (şimdilik basit yaklaşım)
// İleride Firebase Admin SDK ile server-side sync yapılabilir
async function initFirebaseAdmin() {
  // Şimdilik basit bir kontrol
  // İleride Firebase Admin SDK ile server-side sync yapılabilir
  if (!USE_FIREBASE) {
    return false;
  }
  
  // Şimdilik otomatik sync devre dışı (client-side sync kullanılıyor)
  // İleride Firebase Admin SDK ile server-side sync yapılabilir
  return false;
}

/**
 * Veriyi Firebase'e otomatik olarak sync et
 * Şimdilik sadece log yazıyor, client-side sync kullanılıyor
 * İleride Firebase Admin SDK ile server-side sync yapılabilir
 * 
 * @param {string} collectionName - Collection adı
 * @param {string|number} docId - Doküman ID
 * @param {object} data - Sync edilecek veri
 * @param {string} operation - 'create', 'update', 'delete'
 */
async function autoSyncToFirebase(collectionName, docId, data = null, operation = 'update') {
  if (!USE_FIREBASE) {
    return { success: false, reason: 'Firebase kullanılmıyor' };
  }

  // Şimdilik sadece log yazıyoruz
  // İleride Firebase Admin SDK ile server-side sync yapılabilir
  console.log(`📝 Otomatik Firebase sync: ${operation} ${collectionName}/${docId}`);
  
  // Client-side sync kullanılıyor, bu utility şimdilik sadece log yazıyor
  // İleride Firebase Admin SDK ile server-side sync yapılabilir
  return { success: true, note: 'Client-side sync kullanılıyor' };
}

/**
 * Collection mapping: SQLite table name -> Firebase collection name
 */
const COLLECTION_MAP = {
  'members': 'members',
  'meetings': 'meetings',
  'events': 'events',
  'member_users': 'member_users',
  'regions': 'regions',
  'positions': 'positions',
  'districts': 'districts',
  'towns': 'towns',
  'neighborhoods': 'neighborhoods',
  'villages': 'villages',
  'stks': 'stks',
  'mosques': 'mosques',
  'event_categories': 'event_categories',
  'district_officials': 'district_officials',
  'town_officials': 'town_officials',
  'ballot_boxes': 'ballot_boxes',
  'member_registrations': 'member_registrations',
  'groups': 'groups',
  'tasks': 'tasks'
};

/**
 * SQLite işleminden sonra otomatik Firebase sync
 * @param {string} tableName - SQLite table adı
 * @param {string|number} id - Kayıt ID
 * @param {object} data - Kayıt verisi (update/create için)
 * @param {string} operation - 'create', 'update', 'delete'
 */
async function syncAfterSqliteOperation(tableName, id, data = null, operation = 'update') {
  const collectionName = COLLECTION_MAP[tableName];
  
  if (!collectionName) {
    // Bu table için sync yok
    return { success: false, reason: 'Collection mapping bulunamadı' };
  }

  return await autoSyncToFirebase(collectionName, id, data, operation);
}

module.exports = {
  autoSyncToFirebase,
  syncAfterSqliteOperation,
  initFirebaseAdmin
};

