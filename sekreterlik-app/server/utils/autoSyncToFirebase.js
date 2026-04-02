/**
 * Otomatik Firebase Sync Utility
 * Her SQLite işleminden sonra otomatik olarak Firebase'e de yazar
 * Firebase Admin SDK kullanarak server-side sync yapar
 */

const { getAdmin } = require('../config/firebaseAdmin');

const USE_FIREBASE = process.env.VITE_USE_FIREBASE !== 'false' && process.env.USE_FIREBASE !== 'false';

/**
 * Veriyi Firebase'e otomatik olarak sync et
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

  const admin = getAdmin();
  if (!admin) {
    return { success: false, reason: 'Firebase Admin SDK başlatılamadı' };
  }

  try {
    const db = admin.firestore();
    const docRef = db.collection(collectionName).doc(String(docId));

    switch (operation) {
      case 'create':
        await docRef.set({
          ...data,
          id: String(docId),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          _syncedFromServer: true
        }, { merge: true });
        break;

      case 'update':
        await docRef.set({
          ...data,
          id: String(docId),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          _syncedFromServer: true
        }, { merge: true });
        break;

      case 'delete':
        await docRef.delete();
        break;

      default:
        return { success: false, reason: `Bilinmeyen operation: ${operation}` };
    }

    return { success: true };
  } catch (error) {
    console.error(`Firebase sync hatası (${operation} ${collectionName}/${docId}):`, error.message);
    return { success: false, reason: error.message };
  }
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
    return { success: false, reason: 'Collection mapping bulunamadı' };
  }

  return await autoSyncToFirebase(collectionName, id, data, operation);
}

module.exports = {
  autoSyncToFirebase,
  syncAfterSqliteOperation
};
