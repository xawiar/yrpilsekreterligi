/**
 * VoterCacheService
 * 450K seçmen verisini IndexedDB'de cache'ler, ilk yüklemeden sonra hızlı
 * fuzzy search yapar.
 *
 * Şema (IndexedDB):
 *   db: "voter_cache" (version 1)
 *     store: "voters"    — key=tc, value={tc, firstName, lastName, birthDate, address, ballotNumber, district, town}
 *     store: "meta"      — {id:"status", lastSync, count}
 *
 * Fuzzy match skoru:
 *   - name   (0-100): ad+soyad Levenshtein + token set
 *   - tc     (0-100): 100 - editDistance*10
 *   - birth  (0-100): tam eşleşme=100, yıl eşleşme=50
 *   Toplam skor: name*0.4 + tc*0.4 + birth*0.2
 */

const DB_NAME = 'voter_cache';
const DB_VERSION = 1;
const STORE_VOTERS = 'voters';
const STORE_META = 'meta';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 gün

const TR_MAP = [
  ['Ğ', 'G'], ['Ü', 'U'], ['Ş', 'S'], ['İ', 'I'], ['Ö', 'O'], ['Ç', 'C'],
  ['ğ', 'g'], ['ü', 'u'], ['ş', 's'], ['ı', 'i'], ['ö', 'o'], ['ç', 'c']
];

function normalizeText(s) {
  let out = String(s || '').trim();
  for (const [tr, en] of TR_MAP) out = out.split(tr).join(en);
  return out.toUpperCase().replace(/\s+/g, ' ');
}

function normalizeTC(s) {
  return String(s || '').replace(/\D/g, '');
}

function normalizeDate(s) {
  if (!s) return '';
  const raw = String(s).replace(/\D/g, ' ').trim().replace(/\s+/g, ' ');
  const parts = raw.split(' ').filter(Boolean);
  if (parts.length >= 3) {
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    let y = parts[2];
    if (y.length === 2) y = (parseInt(y, 10) > 30 ? '19' : '20') + y;
    return `${d}.${m}.${y}`;
  }
  return raw;
}

function extractYear(s) {
  const n = normalizeDate(s);
  const m = n.match(/(\d{4})/);
  return m ? m[1] : '';
}

/** Levenshtein distance (iteratif, O(m*n)) */
function editDistance(a, b) {
  a = a || '';
  b = b || '';
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_VOTERS)) {
        db.createObjectStore(STORE_VOTERS, { keyPath: 'tc' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(storeName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbBulkPut(storeName, items) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const it of items) store.put(it);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGetAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function idbClear(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

class VoterCacheService {
  static _cache = null; // in-memory kopyası (arama hızı için)
  static _loading = null; // concurrent call koruması

  static async getStatus() {
    const meta = await idbGet(STORE_META, 'status');
    return meta || { lastSync: null, count: 0 };
  }

  /** Cache geçerli mi? (TTL içinde ve kayıt var mı) */
  static async isCacheValid() {
    const meta = await this.getStatus();
    if (!meta.lastSync || !meta.count) return false;
    const age = Date.now() - new Date(meta.lastSync).getTime();
    return age < CACHE_TTL_MS;
  }

  /**
   * Seçmen listesini Firestore'dan çek (pagination ile) ve IndexedDB'ye yaz.
   * @param {(progress:{done:number, total:number|null})=>void} onProgress
   */
  static async syncFromFirestore(onProgress) {
    const { collection, query, orderBy, limit, startAfter, getDocs } =
      await import('firebase/firestore');
    const { db } = await import('../config/firebase');

    // Önce toplam sayıyı bilmek için getCountFromServer
    let total = null;
    try {
      const { getCountFromServer } = await import('firebase/firestore');
      const snap = await getCountFromServer(collection(db, 'voters'));
      total = snap.data().count;
    } catch (_) { /* count olmasa da olur */ }

    await idbClear(STORE_VOTERS);

    const BATCH = 1000;
    let last = null;
    let done = 0;
    const buf = [];

    while (true) {
      let q;
      if (last) {
        q = query(collection(db, 'voters'), orderBy('tc'), startAfter(last), limit(BATCH));
      } else {
        q = query(collection(db, 'voters'), orderBy('tc'), limit(BATCH));
      }
      const snap = await getDocs(q);
      if (snap.empty) break;

      for (const d of snap.docs) {
        const v = d.data();
        buf.push({
          tc: v.tc || d.id,
          firstName: v.firstName || '',
          lastName: v.lastName || '',
          birthDate: v.birthDate || '',
          address: v.address || '',
          ballotNumber: v.ballotNumber || '',
          district: v.district || '',
          town: v.town || ''
        });
      }
      last = snap.docs[snap.docs.length - 1];
      done += snap.docs.length;

      // 5000'lik chunk'larda IndexedDB'ye yaz (RAM'i zorlama)
      if (buf.length >= 5000) {
        await idbBulkPut(STORE_VOTERS, buf.splice(0, buf.length));
      }
      if (onProgress) onProgress({ done, total });

      if (snap.docs.length < BATCH) break;
    }

    if (buf.length) await idbBulkPut(STORE_VOTERS, buf);

    await idbPut(STORE_META, {
      id: 'status',
      lastSync: new Date().toISOString(),
      count: done
    });

    this._cache = null; // invalidate in-memory
    return done;
  }

  /** In-memory cache yükle (ilk aramada) */
  static async ensureLoaded(onProgress) {
    if (this._cache) return this._cache;
    if (this._loading) return this._loading;

    this._loading = (async () => {
      const valid = await this.isCacheValid();
      if (!valid) {
        await this.syncFromFirestore(onProgress);
      }
      const all = await idbGetAll(STORE_VOTERS);
      // Normalize'leri precompute et (arama hızı)
      this._cache = all.map((v) => ({
        ...v,
        _n: normalizeText(v.firstName + ' ' + v.lastName),
        _tc: normalizeTC(v.tc),
        _by: extractYear(v.birthDate),
        _bd: normalizeDate(v.birthDate)
      }));
      return this._cache;
    })();

    try {
      return await this._loading;
    } finally {
      this._loading = null;
    }
  }

  /**
   * Fuzzy match: kullanıcı tanımlı skor sistemine göre top N aday.
   *
   * Skor kuralları (max ~125):
   *   Ad tam     20    Soyad tam    20
   *   D.yıl      10    D.ay          5    D.gün       5
   *   TC prefix: 3h=5, 4h=10, 5h=15, 6h=20, 7-10h=+1 her ek hane
   *   TC tam     +30 bonus
   *   TC suffix (son 4 hane aynı)  +5
   *   Ad+Soyad ikisi de tam        +10 bonus
   */
  static async search(query, topN = 10) {
    const cache = this._cache || (await this.ensureLoaded());
    const qAd = normalizeText(query.ad || '');
    const qSoyad = normalizeText(query.soyad || '');
    const qTC = normalizeTC(query.tc);
    const qBD = normalizeDate(query.dogum_tarihi);
    const qYear = extractYear(query.dogum_tarihi);
    // qBD'den gün/ay parçalarını çıkar
    let qDay = '', qMonth = '';
    const bdMatch = qBD.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (bdMatch) { qDay = bdMatch[1]; qMonth = bdMatch[2]; }

    if (!qAd && !qSoyad && !qTC) return [];

    const results = [];
    const MAX_SCORE = 125;

    for (const v of cache) {
      let score = 0;
      let nameScore = 0, tcScore = 0, birthScore = 0;
      const vAd = normalizeText(v.firstName || '');
      const vSoyad = normalizeText(v.lastName || '');

      // --- AD
      if (qAd && vAd) {
        if (qAd === vAd) {
          nameScore += 20;
        } else {
          // Yakın ad (1-2 harf fark, örn Mehmet/Mehmed)
          const dist = editDistance(qAd, vAd);
          if (dist === 1) nameScore += 15;
          else if (dist === 2) nameScore += 8;
        }
      }

      // --- SOYAD
      if (qSoyad && vSoyad) {
        if (qSoyad === vSoyad) {
          nameScore += 20;
        } else {
          const dist = editDistance(qSoyad, vSoyad);
          if (dist === 1) nameScore += 15;
          else if (dist === 2) nameScore += 8;
        }
      }

      // Ad+Soyad ikisi de tam eşleşme bonusu
      if (qAd && qSoyad && qAd === vAd && qSoyad === vSoyad) {
        nameScore += 10;
      }

      // --- DOĞUM TARİHİ (parçalı)
      const vBD = v._bd;
      if (vBD) {
        const vMatch = vBD.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        const vDay = vMatch ? vMatch[1] : '';
        const vMonth = vMatch ? vMatch[2] : '';
        const vYear = v._by;
        if (qYear && vYear && qYear === vYear) birthScore += 10;
        if (qMonth && vMonth && qMonth === vMonth) birthScore += 5;
        if (qDay && vDay && qDay === vDay) birthScore += 5;
      }

      // --- TC (prefix bazlı)
      const vTC = v._tc;
      if (qTC && vTC) {
        if (qTC === vTC) {
          tcScore += 30 + 20; // prefix max + tam bonus
        } else {
          // Ortak prefix uzunluğu
          let prefix = 0;
          const minLen = Math.min(qTC.length, vTC.length);
          for (let i = 0; i < minLen; i++) {
            if (qTC[i] === vTC[i]) prefix++;
            else break;
          }
          if (prefix >= 3 && prefix < 4) tcScore += 5;
          else if (prefix === 4) tcScore += 10;
          else if (prefix === 5) tcScore += 15;
          else if (prefix === 6) tcScore += 20;
          else if (prefix >= 7) tcScore += 20 + (prefix - 6); // 7h=21, 8h=22, ...

          // Suffix bonus: son 4 hane aynıysa (OCR baştan yanlış okumuş olabilir)
          if (qTC.length >= 4 && vTC.length >= 4) {
            const qSuf = qTC.slice(-4);
            const vSuf = vTC.slice(-4);
            if (qSuf === vSuf) tcScore += 5;
          }
        }
      }

      score = nameScore + tcScore + birthScore;

      // En az 15 puan olmalı aksi halde gürültü
      if (score < 15) continue;

      results.push({
        voter: v,
        score,
        scorePercent: Math.round((score / MAX_SCORE) * 100),
        nameScore,
        tcScore,
        birthScore,
        breakdown: {
          adMatch: qAd && qAd === vAd,
          soyadMatch: qSoyad && qSoyad === vSoyad,
          tcPrefix: qTC && vTC ? (
            qTC === vTC ? 'tam' : (() => {
              let p = 0;
              for (let i = 0; i < Math.min(qTC.length, vTC.length); i++) {
                if (qTC[i] === vTC[i]) p++; else break;
              }
              return p > 0 ? `${p} hane` : 'yok';
            })()
          ) : 'yok',
          birthYear: qYear && v._by === qYear
        }
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topN);
  }

  static async clearCache() {
    await idbClear(STORE_VOTERS);
    await idbClear(STORE_META);
    this._cache = null;
  }
}

export default VoterCacheService;
