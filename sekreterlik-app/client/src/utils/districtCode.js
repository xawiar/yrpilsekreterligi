/**
 * Başmüşahit username için ilçe kodu oluşturucu.
 *
 * Farklı ilçeler aynı sandık numarasını kullanabildiği için (örn. 1001
 * hem Merkez hem Ağın'da var), müşahit username'inde ilçe prefix'i
 * kullanılır: MER1001, AGI1001 gibi.
 *
 * Kod üretimi:
 *  - Türkçe karakterleri ASCII karşılığına çevir
 *  - Büyük harfe dönüştür
 *  - Alfanumerik olmayanları at
 *  - İlk 3 harfi al
 */

const TR_TO_ASCII = [
  ['Ğ', 'G'], ['Ü', 'U'], ['Ş', 'S'], ['İ', 'I'], ['Ö', 'O'], ['Ç', 'C'],
  ['ğ', 'g'], ['ü', 'u'], ['ş', 's'], ['ı', 'i'], ['ö', 'o'], ['ç', 'c'],
];

function toAscii(s) {
  let out = String(s || '');
  for (const [tr, en] of TR_TO_ASCII) out = out.split(tr).join(en);
  return out;
}

export function districtCodeFromName(name) {
  const ascii = toAscii(name).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return ascii.slice(0, 3);
}

/**
 * Kullanıcı adını Firebase Auth email yerel kısmı için güvenli hale getirir.
 * Türkçe karakterleri ASCII'ye çevirir, alfanumerik olmayan her şeyi atar,
 * küçük harfe dönüştürür.
 * Örn: "AĞI1001" → "agi1001", "Müşahit 12" → "musahit12"
 */
export function toEmailSafeUsername(username) {
  const ascii = toAscii(username);
  return ascii.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Başmüşahit username üret: IlceKodu + SandıkNo
 * Örn: districtCode="MER", ballotNumber="1001" → "MER1001"
 */
export function observerUsername(districtName, ballotNumber) {
  const code = districtCodeFromName(districtName);
  const num = String(ballotNumber || '').trim();
  if (!code || !num) return num; // fallback
  return code + num;
}

/**
 * Mevcut districts listesinde id'ye göre ilçe adı döner.
 */
export function districtNameById(districts, id) {
  if (!id || !Array.isArray(districts)) return '';
  const d = districts.find(x => String(x.id) === String(id));
  return d?.name || '';
}
