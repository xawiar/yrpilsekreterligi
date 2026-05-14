#!/usr/bin/env node
/**
 * stamp-sw.js
 *
 * Build sonrası dist/sw.js içindeki CACHE_NAME değerini güncel build
 * timestamp ile değiştirir. Böylece her deploy'da hardcoded versiyonu
 * elle bumplamak gerekmez — istemcideki eski cache otomatik invalidate
 * olur.
 *
 * Notlar:
 *  - public/sw.js dosyası vite tarafından dümdüz dist/sw.js olarak
 *    kopyalanır (transform edilmez). O yüzden post-build replace yapıyoruz.
 *  - vite-plugin-pwa'nın kendi precache'i dist/sw.js'i overwrite ETMEZ
 *    (vite.config.js'te globIgnores ile sw.js precache dışında bırakıldı,
 *    workbox SW farklı bir dosyaya generate edilir).
 */

const fs = require('fs');
const path = require('path');

const SW_PATH = path.resolve(__dirname, '..', 'dist', 'sw.js');

if (!fs.existsSync(SW_PATH)) {
  console.warn('[stamp-sw] dist/sw.js bulunamadı, atlanıyor:', SW_PATH);
  process.exit(0);
}

// YYYYMMDDHHmm formatında timestamp (örn. 202604231345)
const ts = new Date()
  .toISOString()
  .replace(/[-:T]/g, '')
  .slice(0, 12);

const newCacheName = `sekreterlik-yrp-${ts}`;

const original = fs.readFileSync(SW_PATH, 'utf8');

// İlk satırdaki CACHE_NAME = '...' tanımını değiştir
const updated = original.replace(
  /^const\s+CACHE_NAME\s*=\s*['"][^'"]+['"]\s*;?/m,
  `const CACHE_NAME = '${newCacheName}';`
);

if (updated === original) {
  console.warn('[stamp-sw] CACHE_NAME satırı bulunamadı, dosya değişmedi');
  process.exit(0);
}

fs.writeFileSync(SW_PATH, updated);
console.log(`[stamp-sw] CACHE_NAME → ${newCacheName}`);
