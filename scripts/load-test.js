#!/usr/bin/env node
/**
 * Seçim Günü Yük Testi
 *
 * Public endpoint'lere 50 paralel kullanıcı simüle eder.
 * Hedef: 2000 sandık × 200 sorumlu pikinde Cloud Function'lar dayanıyor mu?
 *
 * Kullanım:
 *   node scripts/load-test.js                  # default 50 concurrent, 60sn
 *   node scripts/load-test.js 100 30           # 100 concurrent, 30sn
 *   node scripts/load-test.js 50 60 PROD       # canlı sisteme (default)
 *   node scripts/load-test.js 50 60 LOCAL      # localhost:5000'e
 *
 * Test ettiği endpoint'ler:
 *   1. /manifest.json (PWA manifest — her sayfa yüklemesinde çağrılır)
 *   2. /api/election-results (public seçim sonuçları — public sayfa)
 *
 * Metrikler: RPS, p50/p95/p99 latency, hata oranı, status code dağılımı.
 */

const CONCURRENT = parseInt(process.argv[2] || '50', 10);
const DURATION_SEC = parseInt(process.argv[3] || '60', 10);
const TARGET = (process.argv[4] || 'PROD').toUpperCase();

const BASES = {
  PROD: 'https://spilsekreterligi.web.app',
  LOCAL: 'http://localhost:5000',
};
const BASE = BASES[TARGET] || BASES.PROD;

const ENDPOINTS = [
  { path: '/manifest.json', name: 'Manifest', weight: 0.6 },
  { path: '/api/election-results', name: 'Public Election Results', weight: 0.4 },
];

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  YRP Sekreterlik — Yük Testi');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Hedef:    ${BASE}`);
console.log(`Paralel:  ${CONCURRENT} kullanıcı`);
console.log(`Süre:     ${DURATION_SEC} saniye`);
console.log(`Endpoint: ${ENDPOINTS.map((e) => e.path).join(', ')}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const stats = {
  total: 0,
  ok: 0,
  errors: 0,
  byStatus: {},
  latencies: [],
  byEndpoint: {},
  startedAt: Date.now(),
  endsAt: Date.now() + DURATION_SEC * 1000,
};

ENDPOINTS.forEach((e) => {
  stats.byEndpoint[e.name] = { count: 0, ok: 0, errors: 0, latencies: [] };
});

function pickEndpoint() {
  const r = Math.random();
  let acc = 0;
  for (const e of ENDPOINTS) {
    acc += e.weight;
    if (r <= acc) return e;
  }
  return ENDPOINTS[0];
}

async function singleRequest() {
  const ep = pickEndpoint();
  const start = Date.now();
  let status = 0;
  let ok = false;
  try {
    const r = await fetch(`${BASE}${ep.path}`, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
    });
    status = r.status;
    ok = r.ok;
    // Gövdeyi tüket — connection close olsun
    await r.text().catch(() => '');
  } catch (err) {
    status = -1;
  }
  const ms = Date.now() - start;

  stats.total++;
  stats.latencies.push(ms);
  stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
  if (ok) stats.ok++; else stats.errors++;

  const epStat = stats.byEndpoint[ep.name];
  epStat.count++;
  epStat.latencies.push(ms);
  if (ok) epStat.ok++; else epStat.errors++;
}

async function workerLoop() {
  while (Date.now() < stats.endsAt) {
    await singleRequest();
  }
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100));
  return sorted[idx];
}

function formatNumber(n) {
  return new Intl.NumberFormat('tr-TR').format(n);
}

function progressTick() {
  const elapsed = Math.floor((Date.now() - stats.startedAt) / 1000);
  const remaining = Math.max(0, DURATION_SEC - elapsed);
  const rps = stats.total / Math.max(1, elapsed);
  process.stdout.write(
    `\r⏱  ${elapsed}sn / ${DURATION_SEC}sn · ${formatNumber(stats.total)} req · ${rps.toFixed(1)} req/sn · ${stats.errors} hata · ${remaining}sn kaldı   `
  );
}

async function main() {
  const interval = setInterval(progressTick, 250);

  const workers = [];
  for (let i = 0; i < CONCURRENT; i++) workers.push(workerLoop());
  await Promise.all(workers);

  clearInterval(interval);
  process.stdout.write('\n\n');

  // Rapor
  const elapsed = (Date.now() - stats.startedAt) / 1000;
  const rps = stats.total / elapsed;
  const errPct = (stats.errors / Math.max(1, stats.total)) * 100;
  const p50 = percentile(stats.latencies, 50);
  const p95 = percentile(stats.latencies, 95);
  const p99 = percentile(stats.latencies, 99);
  const max = stats.latencies.length ? Math.max(...stats.latencies) : 0;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  GENEL RAPOR');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Toplam istek:    ${formatNumber(stats.total)}`);
  console.log(`Başarılı (2xx):  ${formatNumber(stats.ok)} (${(100 - errPct).toFixed(2)}%)`);
  console.log(`Hatalı:          ${formatNumber(stats.errors)} (${errPct.toFixed(2)}%)`);
  console.log(`RPS:             ${rps.toFixed(1)} req/sn`);
  console.log(`Süre:            ${elapsed.toFixed(1)} sn`);
  console.log('');
  console.log('Latency:');
  console.log(`  p50: ${p50} ms`);
  console.log(`  p95: ${p95} ms`);
  console.log(`  p99: ${p99} ms`);
  console.log(`  max: ${max} ms`);
  console.log('');
  console.log('Status code dağılımı:');
  Object.entries(stats.byStatus)
    .sort((a, b) => b[1] - a[1])
    .forEach(([s, c]) => {
      const label = s === '-1' ? 'NETWORK_ERR' : s;
      console.log(`  ${label}: ${formatNumber(c)}`);
    });
  console.log('');
  console.log('Endpoint başına:');
  Object.entries(stats.byEndpoint).forEach(([name, s]) => {
    const epP95 = percentile(s.latencies, 95);
    const epErr = (s.errors / Math.max(1, s.count)) * 100;
    console.log(`  ${name}:`);
    console.log(`    İstek:  ${formatNumber(s.count)} · Hata: ${epErr.toFixed(2)}% · p95: ${epP95}ms`);
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Karar
  console.log('\nDEĞERLENDİRME:');
  if (errPct > 5) {
    console.log(`❌ Hata oranı %${errPct.toFixed(2)} — KABUL EDİLEMEZ. Üst sınır %1.`);
  } else if (errPct > 1) {
    console.log(`⚠️  Hata oranı %${errPct.toFixed(2)} — Eşikte. Pikin altında ama tetikte ol.`);
  } else {
    console.log(`✅ Hata oranı %${errPct.toFixed(2)} — Çok iyi.`);
  }

  if (p95 > 2000) {
    console.log(`❌ p95 ${p95}ms — KÖTÜ. Sayfa yavaş açılır.`);
  } else if (p95 > 800) {
    console.log(`⚠️  p95 ${p95}ms — Orta. minInstances yardımcı olabilir.`);
  } else {
    console.log(`✅ p95 ${p95}ms — İyi.`);
  }

  if (rps < CONCURRENT * 0.5) {
    console.log(`⚠️  ${rps.toFixed(1)} req/sn / ${CONCURRENT} concurrent — Throughput düşük (avg latency yüksek olabilir).`);
  } else {
    console.log(`✅ ${rps.toFixed(1)} req/sn / ${CONCURRENT} concurrent — Throughput normal.`);
  }

  process.exit(errPct > 5 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test patladı:', err);
  process.exit(2);
});
