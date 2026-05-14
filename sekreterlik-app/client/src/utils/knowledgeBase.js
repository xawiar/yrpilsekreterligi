/**
 * Knowledge Base RAG (basit keyword tabanlı)
 *
 * Statik /knowledge-base.json dosyasını ilk istekte çeker, memo'lar.
 * Türkçe karakter normalize + stop-word filtre + heading/tag boost ile
 * skorlama yapıp en alakalı `topK` chunk'ı döner.
 *
 * Yeni içerik eklemek icin: knowledge-ingest/parse-and-chunk.js çalıştır,
 * chunks/knowledge-base.json'ı public/knowledge-base.json'a kopyala.
 */

const KB_URL = '/knowledge-base.json';

let _cache = null;
let _pending = null;

const TR_STOP = new Set([
  've','ile','bir','bu','şu','o','ki','de','da','mı','mi','mu','mü','için','gibi',
  'ama','fakat','lakin','çünkü','ya','ya da','veya','her','hiç','çok','az','daha',
  'en','ne','niçin','neden','nasıl','olarak','olan','olduğu','olduğunu','idi','dir',
  'tir','tır','tur','tür','olmak','etmek','yapmak','tüm','bütün','sonra','önce',
  // Türkçe sorularda sık geçen düşük-bilgi tokenleri (normalize sonrası)
  've','ile','icin','gibi','olarak','olan','daha','nasil','nicin','neden','sonra','once',
  'partimizin','partimiz','partimizdeki','tuzugune','tuzugu','tuzukteki','programimiza','programimizi'
]);

/**
 * Türk siyaset & parti terminolojisi için synonym genişletme.
 * Her token için, normalize edilmiş hâlinde, eşdeğer aramalı kelimelerin listesi.
 * Örn: "ihrac" geldiğinde tüzükte "cikarma" / "uyelikten cikarilma" geçen chunk'lar
 * da puan kazansın. Tek yönlü değil, simetrik olması için her gruba aynı bayrağı veriyoruz.
 */
const SYNONYM_GROUPS = [
  ['ihrac','ihraci','cikarma','cikarilma','uyelikten cikarilma','uyelikten cikarma','uyeliginin sona ermesi','uyelik sona ermesi','kaydi silme','kaydin silinmesi','disiplin','ceza'],
  ['uye','uyelik','aza','azalik','kaydolma','kayit','kayitli'],
  ['baskan','genel baskan','lider','reis'],
  ['baskanlik','baskanligi','liderlik','reislik'],
  ['kongre','genel kurul','toplanti','meclis'],
  ['secim','oylama','sandik','aday','adaylik','milletvekili','belediye'],
  ['program','politika','vizyon','gorus','goruslerimiz'],
  ['hukum','madde','fikra','bend','kanun','mevzuat','yonetmelik'],
  ['teskilat','organizasyon','yapilanma','sube','il','ilce','belde'],
  ['bütçe','butce','mali','finans','para','gelir','gider','aidat'],
  ['kadin','kadin kollari','genclik','genclik kollari','engelli','engelliler'],
  ['mahalli idareler','belediye','il genel meclisi','muhtarlik'],
  ['disisleri','dis politika','ab','nato','d8','islam dunyasi','turk dunyasi'],
  ['egitim','milli egitim','okul','universite','yuksekogretim','ogrenci'],
  ['saglik','tip','hastane','doktor'],
  ['adalet','hukuk','yargi','mahkeme'],
  ['ekonomi','ekonomik','sanayi','tarim','hayvancilik','enerji','madencilik'],
  ['guvenlik','milli savunma','ordu','asker','tsk','jandarma','polis'],
  ['gencler','genclik','yas','yasli','engelli'],
  ['kadin','aile','evlilik','bosanma','cocuk'],
];

// Hızlı erişim için: token → eşdeğer setlerinin Set'i
const SYN_INDEX = new Map();
for (const group of SYNONYM_GROUPS) {
  const set = new Set(group);
  for (const term of group) {
    if (!SYN_INDEX.has(term)) SYN_INDEX.set(term, new Set());
    for (const eq of set) SYN_INDEX.get(term).add(eq);
  }
}

/** Token + synonyms döner (kelime grubu eşleşirse o grubun tamamını dahil eder). */
const expandWithSynonyms = (tokens) => {
  const out = new Set(tokens);
  for (const t of tokens) {
    const eqs = SYN_INDEX.get(t);
    if (eqs) {
      for (const eq of eqs) {
        // Çok kelimeli synonyms (örn "uyelikten cikarma") tek tek tokenlara böl
        for (const w of eq.split(/\s+/)) if (w.length >= 2) out.add(w);
      }
    }
  }
  return [...out];
};

const normalizeTr = (s) => (s || '')
  .toLocaleLowerCase('tr-TR')
  .replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o')
  .replace(/ü/g, 'u').replace(/ç/g, 'c').replace(/ğ/g, 'g')
  .replace(/[^a-z0-9\s]+/g, ' ');

const tokenize = (s) => normalizeTr(s)
  .split(/\s+/)
  // 2-3 harfli alfanumerik kısaltmalara izin ver (D8, AB, ABD, NATO vb.)
  // ama 2 harfli pür-alfabetik stop-word'leri at (ve, bu, şu, vs.)
  .filter(t => {
    if (t.length < 2) return false;
    if (TR_STOP.has(t)) return false;
    if (t.length === 2 && !/\d/.test(t)) return false;
    return true;
  });

export async function loadKnowledgeBase() {
  if (_cache) return _cache;
  if (_pending) return _pending;
  _pending = fetch(KB_URL, { cache: 'force-cache' })
    .then(r => r.ok ? r.json() : [])
    .then(json => {
      const arr = Array.isArray(json) ? json : [];
      // Pre-tokenize her chunk için (search hızı için)
      _cache = arr.map(c => ({
        ...c,
        _tokens: new Set(tokenize(`${c.h || ''} ${c.t || ''}`)),
        _headingTokens: new Set(tokenize(c.h || '')),
        _tagTokens: new Set((c.tags || []).flatMap(tg => tokenize(tg))),
      }));
      _pending = null;
      return _cache;
    })
    .catch((err) => {
      console.warn('Knowledge base load failed:', err?.message);
      _cache = [];
      _pending = null;
      return _cache;
    });
  return _pending;
}

/**
 * Soruya en alakalı chunk'ları döndürür.
 * @param {string} query Kullanıcı sorgusu
 * @param {number} topK Kaç chunk
 * @param {number} minScore Minimum skor (eşleşme yoksa boş döner)
 *
 * Algoritma:
 *  1) Sorguyu tokenize et
 *  2) Synonym sözlüğüyle genişlet (orijinal token'lar 2x ağırlık, synonym 1x)
 *  3) Her chunk için skoru hesapla:
 *     - body match: 1
 *     - heading match: 3 (orijinal token) / 2 (synonym)
 *     - tag match: 2
 *  4) topK'ya kadar al
 */
export async function searchKnowledgeBase(query, topK = 12, minScore = 1) {
  const kb = await loadKnowledgeBase();
  if (!kb.length) return [];
  const baseTokens = tokenize(query);
  if (!baseTokens.length) return [];
  const baseSet = new Set(baseTokens);
  const expanded = expandWithSynonyms(baseTokens);

  const scored = kb.map(c => {
    let score = 0;
    for (const tok of expanded) {
      const isOriginal = baseSet.has(tok);
      if (c._tokens.has(tok)) score += isOriginal ? 1 : 0.6;
      if (c._headingTokens.has(tok)) score += isOriginal ? 3 : 1.8;
      if (c._tagTokens.has(tok)) score += isOriginal ? 2 : 1.2;
    }
    return { c, score };
  })
  .filter(x => x.score >= minScore)
  .sort((a, b) => b.score - a.score)
  .slice(0, topK);

  return scored.map(x => ({
    id: x.c.id,
    source: x.c.src,
    heading: x.c.h,
    text: x.c.t,
    score: x.score,
  }));
}

/**
 * Chatbot context array'ine eklenecek formatlanmış metin döner.
 * Boş array dönerse hiçbir şey ekleme.
 *
 * Default 12 chunk getirir; alakasız olanları Gemini'nin filtrelemesi
 * için yönerge eklenir (recall artırılır, precision Gemini'ye bırakılır).
 */
export async function getKnowledgeContext(query, topK = 12) {
  const hits = await searchKnowledgeBase(query, topK);
  if (!hits.length) return [];
  const lines = ['\n=== BİLGİ TABANI (RAG) ==='];
  lines.push(`Kullanıcı sorgusuna ("${query.slice(0, 80)}") en yakın ${hits.length} parça bulundu (skor sırasıyla):`);
  lines.push('YÖNERGE:');
  lines.push('1. Aşağıdaki kaynak parçalarından sadece soruyla DOĞRUDAN alakalı olanları kullan; alakasız olanları görmezden gel.');
  lines.push('2. Cevabı Türkçe ver ve hangi kaynaktan/başlıktan alındığını mutlaka belirt (örn: "Parti Tüzüğü > ÜYELİĞİN SONA ERMESİ").');
  lines.push('3. Kaynaklarda olmayan bilgi uydurma; bilmiyorsan açıkça "Verilen kaynaklarda bu konuda bilgi bulunmadı" de.');
  lines.push('4. Soru "ihraç/üyelikten çıkarma/disiplin" gibi terimler içeriyorsa "üyeliğin sona ermesi" / "disiplin cezaları" başlıklarına bak.');
  hits.forEach((h, i) => {
    lines.push(`\n--- [${i + 1}] (skor=${h.score.toFixed(1)}) Kaynak: ${h.source}${h.heading && h.heading !== h.source ? ` › ${h.heading}` : ''} ---`);
    lines.push(h.text);
  });
  return lines;
}
