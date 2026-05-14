#!/usr/bin/env node
/**
 * Firestore Backup — Firebase Admin SDK ile local JSON dump.
 *
 * gcloud yetkisi olmayan kullanıcılar için alternatif backup yöntemi.
 * Tüm koleksiyonları okur, ./backups/<tarih>/{koleksiyon}.json dosyalarına yazar.
 *
 * Kullanım:
 *   1. functions/ klasöründen çalıştır (firebase-admin orada yüklü)
 *      cd functions && node ../scripts/firestore-backup.js
 *
 *   2. Kimlik doğrulama:
 *      Default uygulama kimlik bilgisi (gcloud auth application-default login) gerekli
 *      VEYA
 *      GOOGLE_APPLICATION_CREDENTIALS env değişkenini service account key path'e set et
 *
 * Geri yükleme: scripts/firestore-restore.js (ihtiyaç olunca)
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "spilsekreterligi",
  });
}

const db = admin.firestore();
db.settings({databaseId: "yrpilsekreterligi"});

const TODAY = new Date().toISOString().slice(0, 10);
const BACKUP_DIR = path.join(__dirname, "..", "backups", TODAY);

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, {recursive: true});
}

// Yedeklenecek koleksiyonlar — kritik veriler önce
const COLLECTIONS = [
  // En kritik — seçim sonuçları
  "election_results",
  "elections",
  "ballot_boxes",
  "ballot_box_observers",
  "ballot_box_documents",
  // Sorumlu/yapı
  "election_coordinators",
  "election_regions",
  "districts",
  "neighborhoods",
  "villages",
  "towns",
  // Üye
  "members",
  "member_users",
  "voters",
  // Bildirim
  "user_notifications",
  "master_notifications",
  "push_tokens",
  // Diğer
  "polls",
  "training_materials",
  "training_completions",
  "app_settings",
  "gemini_api_config",
  "ai_provider_config",
  "elections_archive",
  "membership_applications",
];

async function backupCollection(name) {
  try {
    const start = Date.now();
    const snap = await db.collection(name).get();
    const docs = [];
    snap.forEach((d) => {
      docs.push({_id: d.id, ...d.data()});
    });
    const file = path.join(BACKUP_DIR, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(docs, null, 2), "utf-8");
    const size = (fs.statSync(file).size / 1024).toFixed(1);
    const ms = Date.now() - start;
    console.log(`  ✓ ${name.padEnd(35)} ${docs.length.toString().padStart(6)} doc · ${size.padStart(8)} KB · ${ms}ms`);
    return {name, count: docs.length, size, ms};
  } catch (err) {
    console.log(`  ✗ ${name.padEnd(35)} HATA: ${err.message}`);
    return {name, error: err.message};
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  FIRESTORE BACKUP — ${TODAY}`);
  console.log(`  Hedef: ${BACKUP_DIR}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  const results = [];
  for (const c of COLLECTIONS) {
    const r = await backupCollection(c);
    results.push(r);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  const ok = results.filter((r) => !r.error);
  const err = results.filter((r) => r.error);
  const totalDocs = ok.reduce((sum, r) => sum + r.count, 0);

  console.log(`  Başarılı: ${ok.length}/${results.length} koleksiyon, ${totalDocs.toLocaleString()} doc`);
  if (err.length > 0) {
    console.log(`  HATALAR (${err.length}):`);
    err.forEach((e) => console.log(`    - ${e.name}: ${e.error}`));
  }
  console.log(`  Klasör: ${BACKUP_DIR}`);
  console.log("═══════════════════════════════════════════════════════════════");

  // Geri yükleme talimatı
  console.log("\nGeri yükleme: scripts/firestore-restore.js <klasör>");

  process.exit(err.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(2);
});
