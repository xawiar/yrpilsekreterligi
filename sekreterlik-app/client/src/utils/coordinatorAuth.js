/**
 * Koordinatör yetki helper'ı.
 *
 * election_coordinators koleksiyonundaki bir koordinatörün, ballot_boxes
 * koleksiyonundaki bir sandığa erişip erişemeyeceğini hesaplar.
 *
 * Roller:
 *  - provincial_coordinator   : İl Genel Sorumlusu — tüm sandıklar
 *  - district_supervisor      : İlçe Sorumlusu — kendi district_id'si
 *  - region_supervisor        : Bölge Sorumlusu — region.neighborhood_ids / village_ids
 *  - institution_supervisor   : Kurum Sorumlusu — institution_name eşleşmesi
 *
 * ID karşılaştırmaları her zaman String() ile yapılır (Firestore doc id string).
 */

/**
 * neighborhood_ids / village_ids alanları ya array ya da JSON string olabilir.
 * Bu helper güvenli şekilde array'e çevirir.
 */
function toIdArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

/**
 * Bir koordinatör verilen sandığa erişebilir mi?
 * @param {Object} coordinator - { id, role, district_id, region_id, institution_name, ... }
 * @param {Object} ballotBox - { id, district_id, town_id, neighborhood_id, village_id, institution_name }
 * @param {Object[]} regions - election_regions listesi (region_supervisor için)
 * @returns {boolean}
 */
export function canCoordinatorAccessBallotBox(coordinator, ballotBox, regions = []) {
  if (!coordinator || !ballotBox) return false;

  const role = coordinator.role || coordinator.userType || null;
  if (!role) return false;

  switch (role) {
    case 'provincial_coordinator':
      // İl Genel Sorumlusu — tüm sandıklar
      return true;

    case 'district_supervisor': {
      // İlçe Sorumlusu — sandık aynı ilçede mi?
      if (!coordinator.district_id || !ballotBox.district_id) return false;
      return String(ballotBox.district_id) === String(coordinator.district_id);
    }

    case 'region_supervisor': {
      // Bölge Sorumlusu — region.neighborhood_ids / village_ids içinde mi?
      if (!coordinator.region_id || !Array.isArray(regions)) return false;
      const region = regions.find(r => r && String(r.id) === String(coordinator.region_id));
      if (!region) return false;

      const neighborhoodIds = toIdArray(region.neighborhood_ids);
      const villageIds = toIdArray(region.village_ids);

      if (ballotBox.neighborhood_id &&
          neighborhoodIds.includes(String(ballotBox.neighborhood_id))) {
        return true;
      }
      if (ballotBox.village_id &&
          villageIds.includes(String(ballotBox.village_id))) {
        return true;
      }
      return false;
    }

    case 'institution_supervisor': {
      // Kurum Sorumlusu — institution_name eşleşmesi
      if (!coordinator.institution_name || !ballotBox.institution_name) return false;
      return String(ballotBox.institution_name).trim() ===
             String(coordinator.institution_name).trim();
    }

    default:
      return false;
  }
}

/**
 * Bir koordinatörün sorumlu olduğu sandık ID'lerini döndür.
 * @param {Object} coordinator
 * @param {Object[]} allBallotBoxes
 * @param {Object[]} regions
 * @returns {string[]} ballot_box id'leri
 */
export function getCoordinatorBallotBoxIds(coordinator, allBallotBoxes, regions = []) {
  if (!coordinator || !Array.isArray(allBallotBoxes)) return [];

  return allBallotBoxes
    .filter(bb => canCoordinatorAccessBallotBox(coordinator, bb, regions))
    .map(bb => String(bb.id));
}

export default {
  canCoordinatorAccessBallotBox,
  getCoordinatorBallotBoxIds,
};
