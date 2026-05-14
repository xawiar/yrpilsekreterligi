/**
 * Sandık etiket helper'ları — UI'da tutarlı sandık gösterimi.
 *
 * Aynı sandık numarası farklı ilçelerde bulunabildiği için
 * (örn. MERKEZ 1001 ve AĞIN 1001), sandığı temsil eden her etiket
 * ilçe kısaltmasını mutlaka içermelidir.
 */

const TR_TO_ASCII = [
  ['Ğ', 'G'], ['Ü', 'U'], ['Ş', 'S'], ['İ', 'I'], ['Ö', 'O'], ['Ç', 'C'],
  ['ğ', 'g'], ['ü', 'u'], ['ş', 's'], ['ı', 'i'], ['ö', 'o'], ['ç', 'c'],
];

/**
 * Türkçe ilçe adından 3 harfli kısaltma üret.
 * Örn: "MERKEZ" → "MER", "AĞIN" → "AGI", "BASKİL" → "BAS"
 */
export function districtShortCode(districtName) {
  if (!districtName || typeof districtName !== 'string') return '';
  let s = String(districtName);
  for (const [tr, en] of TR_TO_ASCII) s = s.split(tr).join(en);
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
}

/**
 * Bir sandığın ait olduğu ilçeyi `districts` listesinden bul.
 */
export function findDistrictForBallotBox(ballotBox, districts = []) {
  if (!ballotBox || !ballotBox.district_id) return null;
  return (districts || []).find(d => String(d.id) === String(ballotBox.district_id)) || null;
}

/**
 * Sandık doc ID'sinin districts koleksiyonunda mevcut olup olmadığını kontrol et.
 * Olmayan district_id'li sandıklar "zombi"dir (ilçe silinmiş ama sandık kayıtta).
 */
export function isBallotBoxZombi(ballotBox, districts = []) {
  if (!ballotBox) return false;
  // district_id yoksa zombi sayma — konum bilgisi olmayan sandıklar olabilir
  if (!ballotBox.district_id) return false;
  return !districts.some(d => String(d.id) === String(ballotBox.district_id));
}

/**
 * Sandığı kompakt biçimde etiketle: "[MER] 1001"
 */
export function formatBallotBoxShort(ballotBox, districts = []) {
  if (!ballotBox) return '-';
  const district = findDistrictForBallotBox(ballotBox, districts);
  const code = district ? districtShortCode(district.name) : '???';
  const num = ballotBox.ballot_number || ballotBox.ballotNumber || '?';
  return `[${code}] ${num}`;
}

/**
 * Sandığı tam etiketle: "[MER] 1001 - CUMHURİYET ORTAOKULU"
 */
export function formatBallotBoxLabel(ballotBox, districts = []) {
  if (!ballotBox) return '-';
  const short = formatBallotBoxShort(ballotBox, districts);
  const inst = ballotBox.institution_name;
  return inst ? `${short} - ${inst}` : short;
}

/**
 * districts koleksiyonunda olmayan district_id taşıyan tüm sandıkları döndür.
 */
export function findZombiBallotBoxes(allBallotBoxes = [], districts = []) {
  return (allBallotBoxes || []).filter(bb => isBallotBoxZombi(bb, districts));
}
