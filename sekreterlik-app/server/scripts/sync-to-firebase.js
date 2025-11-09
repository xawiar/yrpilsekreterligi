const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const admin = require('firebase-admin');
const CryptoJS = require('crypto-js');

// Firebase Admin SDK initialization
// Service account key dosyası gerekli - şimdilik environment variable kullanacağız
// Alternatif: Firebase Admin SDK'yı initialize etmek için service account key gerekli
// Ancak şimdilik client tarafından sync yapacağız

// SQLite database path
const dbPath = path.join(__dirname, '../database.sqlite');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

// Encryption key (client tarafındaki ile aynı olmalı)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 
  'ilsekreterlik-app-encryption-key-2024-secret-very-long-key-for-security';

// Sensitive fields to encrypt
const SENSITIVE_FIELDS = ['tc', 'phone', 'email', 'password'];

// Helper function to encrypt data
function encryptData(data) {
  if (data === null || data === undefined) return null;
  try {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return CryptoJS.AES.encrypt(dataString, ENCRYPTION_KEY).toString();
  } catch (error) {
    console.error('Encryption error:', error);
    return data;
  }
}

// Helper function to encrypt object
function encryptObject(obj, fieldsToEncrypt = []) {
  if (!obj || typeof obj !== 'object') return obj;
  const encrypted = { ...obj };
  fieldsToEncrypt.forEach(field => {
    if (encrypted[field] !== undefined && encrypted[field] !== null) {
      encrypted[field] = encryptData(encrypted[field]);
    }
  });
  return encrypted;
}

// Collection mapping: SQLite table -> Firestore collection
const COLLECTION_MAP = {
  'members': 'members',
  'meetings': 'meetings',
  'events': 'events',
  'regions': 'regions',
  'positions': 'positions',
  'districts': 'districts',
  'towns': 'towns',
  'neighborhoods': 'neighborhoods',
  'villages': 'villages',
  'stks': 'stks',
  'mosques': 'mosques',
  'event_categories': 'event_categories',
  'neighborhood_representatives': 'neighborhood_representatives',
  'village_representatives': 'village_representatives',
  'neighborhood_supervisors': 'neighborhood_supervisors',
  'village_supervisors': 'village_supervisors',
  'district_officials': 'district_officials',
  'town_officials': 'town_officials',
  'district_management_members': 'district_management_members',
  'town_management_members': 'town_management_members',
  'ballot_boxes': 'ballot_boxes',
  'ballot_box_observers': 'ballot_box_observers',
  'member_users': 'member_users',
  'member_registrations': 'member_registrations',
  'messages': 'messages',
  'message_groups': 'message_groups',
  'personal_documents': 'personal_documents',
  'archive': 'archive',
  'groups': 'groups',
  'position_permissions': 'position_permissions',
  'tasks': 'tasks'
};

// Sync a single table to Firestore
function syncTable(tableName, collectionName) {
  return new Promise((resolve, reject) => {
    console.log(`\n📤 Syncing ${tableName} to ${collectionName}...`);
    
    db.all(`SELECT * FROM ${tableName}`, [], async (err, rows) => {
      if (err) {
        console.error(`❌ Error reading ${tableName}:`, err.message);
        return resolve({ table: tableName, count: 0, errors: [err.message] });
      }

      if (rows.length === 0) {
        console.log(`⚠️  No data in ${tableName}`);
        return resolve({ table: tableName, count: 0, errors: [] });
      }

      console.log(`📊 Found ${rows.length} records in ${tableName}`);

      // Note: Bu script server tarafında çalışacak
      // Firebase Admin SDK için service account key gerekli
      // Alternatif: Client tarafında bir sync sayfası oluşturup API üzerinden sync yapabiliriz
      
      // Şimdilik verileri hazırlayıp JSON olarak export edelim
      // Client tarafında bir sync sayfası oluşturacağız
      
      const results = {
        table: tableName,
        collection: collectionName,
        count: rows.length,
        data: rows.map(row => {
          // Convert SQLite row to object
          const obj = { ...row };
          
          // Encrypt sensitive fields
          if (SENSITIVE_FIELDS.some(field => obj[field] !== undefined)) {
            return encryptObject(obj, SENSITIVE_FIELDS);
          }
          
          return obj;
        }),
        errors: []
      };

      console.log(`✅ Prepared ${results.count} records from ${tableName}`);
      resolve(results);
    });
  });
}

// Main sync function
async function main() {
  console.log('\n🚀 SQLite to Firebase Sync Started...\n');
  console.log('📦 Database:', dbPath);
  
  const results = [];
  
  // Sync all tables
  for (const [tableName, collectionName] of Object.entries(COLLECTION_MAP)) {
    try {
      const result = await syncTable(tableName, collectionName);
      results.push(result);
    } catch (error) {
      console.error(`❌ Error syncing ${tableName}:`, error);
      results.push({
        table: tableName,
        collection: collectionName,
        count: 0,
        errors: [error.message]
      });
    }
  }
  
  // Summary
  console.log('\n📊 Sync Summary:');
  console.log('='.repeat(50));
  let totalCount = 0;
  let totalErrors = 0;
  
  results.forEach(result => {
    console.log(`${result.table.padEnd(30)} → ${result.collection.padEnd(30)} : ${result.count} records`);
    totalCount += result.count;
    totalErrors += result.errors.length;
  });
  
  console.log('='.repeat(50));
  console.log(`Total: ${totalCount} records prepared`);
  if (totalErrors > 0) {
    console.log(`Errors: ${totalErrors}`);
  }
  
  console.log('\n⚠️  Note: This script prepares data for sync.');
  console.log('To actually sync to Firebase, use the client-side sync page.');
  console.log('Or configure Firebase Admin SDK with service account key.');
  
  // Close database
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
      process.exit(1);
    } else {
      console.log('\n✅ Database closed');
      process.exit(0);
    }
  });
}

// Run sync
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

