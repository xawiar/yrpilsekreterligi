/**
 * Public API Service — Cloud Function endpoint uzerinden veri okur
 * Rules ile ugrasma yok — Admin SDK her zaman erisir
 * CDN cache ile hizli (60sn)
 */

const ELECTION_API = '/api/election-results';

class PublicApiService {

  // Tek secimin detayli sonuclari (aggregate + sandik bazli)
  static async getElectionDetail(electionId) {
    try {
      var response = await fetch(ELECTION_API + '?id=' + encodeURIComponent(electionId));
      if (!response.ok) return null;
      var json = await response.json();
      if (json.success && json.data) {
        this._lastDetail = json.data;
        return json.data;
      }
      return null;
    } catch (e) {
      console.warn('getElectionDetail error:', e.message);
      return null;
    }
  }

  // Secim listesi
  static async getElections() {
    try {
      var response = await fetch(ELECTION_API);
      if (!response.ok) return [];
      var json = await response.json();
      return json.success ? json.data : [];
    } catch (e) {
      console.warn('getElections error:', e.message);
      return [];
    }
  }

  // Uyumluluk — ElectionResultsPage bu metodu cagiriyor
  static async getElectionResults(electionId, ballotBoxId) {
    var detail = this._lastDetail && String(this._lastDetail.election?.id) === String(electionId)
      ? this._lastDetail
      : await this.getElectionDetail(electionId);
    if (!detail || !detail.ballotBoxResults) return [];
    // election_results formatina cevir (uyumluluk)
    return detail.ballotBoxResults.map(function(bbr) {
      return {
        id: bbr.resultId || bbr.ballotBoxId,
        election_id: electionId,
        ballot_box_id: bbr.ballotBoxId,
        ballot_number: bbr.ballotNumber,
        district_name: bbr.districtName,
        town_name: bbr.townName,
        neighborhood_name: bbr.neighborhoodName,
        village_name: bbr.villageName,
        total_voters: bbr.totalVoters,
        used_votes: bbr.usedVotes,
        valid_votes: bbr.validVotes,
        invalid_votes: bbr.invalidVotes,
        cb_votes: bbr.cbVotes || {},
        mv_votes: bbr.mvVotes || {},
        mayor_votes: bbr.mayorVotes || {},
        approval_status: 'approved',
      };
    });
  }

  static async getElectionById(id) {
    var detail = await this.getElectionDetail(id);
    return detail ? detail.election : null;
  }

  static async getBallotBoxes() {
    // API'den gelen son detaydan sandik listesi olustur
    if (this._lastDetail && this._lastDetail.ballotBoxResults) {
      var seen = {};
      return this._lastDetail.ballotBoxResults.map(function(bbr) {
        if (!bbr.ballotBoxId || seen[bbr.ballotBoxId]) return null;
        seen[bbr.ballotBoxId] = true;
        return {
          id: bbr.ballotBoxId,
          ballot_number: bbr.ballotNumber,
          number: bbr.ballotNumber,
          district_id: bbr.districtName,
          district_name: bbr.districtName,
          town_id: bbr.townName,
          town_name: bbr.townName,
          neighborhood_id: bbr.neighborhoodName,
          neighborhood_name: bbr.neighborhoodName,
          village_id: bbr.villageName,
          village_name: bbr.villageName,
          voter_count: bbr.totalVoters,
        };
      }).filter(Boolean);
    }
    return [];
  }

  static async getDistricts() {
    if (this._lastDetail && this._lastDetail.ballotBoxResults) {
      var seen = {};
      return this._lastDetail.ballotBoxResults.map(function(bbr) {
        if (!bbr.districtName || seen[bbr.districtName]) return null;
        seen[bbr.districtName] = true;
        return { id: bbr.districtName, name: bbr.districtName };
      }).filter(Boolean);
    }
    return [];
  }

  static async getTowns() {
    if (this._lastDetail && this._lastDetail.ballotBoxResults) {
      var seen = {};
      return this._lastDetail.ballotBoxResults.map(function(bbr) {
        if (!bbr.townName || seen[bbr.townName]) return null;
        seen[bbr.townName] = true;
        return { id: bbr.townName, name: bbr.townName };
      }).filter(Boolean);
    }
    return [];
  }

  static async getNeighborhoods() {
    if (this._lastDetail && this._lastDetail.ballotBoxResults) {
      var seen = {};
      return this._lastDetail.ballotBoxResults.map(function(bbr) {
        if (!bbr.neighborhoodName || seen[bbr.neighborhoodName]) return null;
        seen[bbr.neighborhoodName] = true;
        return { id: bbr.neighborhoodName, name: bbr.neighborhoodName };
      }).filter(Boolean);
    }
    return [];
  }

  static async getVillages() {
    if (this._lastDetail && this._lastDetail.ballotBoxResults) {
      var seen = {};
      return this._lastDetail.ballotBoxResults.map(function(bbr) {
        if (!bbr.villageName || seen[bbr.villageName]) return null;
        seen[bbr.villageName] = true;
        return { id: bbr.villageName, name: bbr.villageName };
      }).filter(Boolean);
    }
    return [];
  }

  static async getBallotBoxObservers() { return []; }

  // Landing sayfasi icin — getCachedElectionResult uyumluluk
  static async getCachedElectionResult(electionId) {
    return await this.getElectionDetail(electionId);
  }

  static async getAllCachedElections() {
    var elections = await this.getElections();
    return elections || [];
  }
}

export default PublicApiService;
