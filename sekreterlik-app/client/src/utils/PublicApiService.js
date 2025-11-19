/**
 * Public API Service
 * Authentication gerektirmeyen, sadece okuma (read-only) endpoint'leri için
 * Güvenlik: Rate limiting, input validation, sadece GET metodları
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sekreterlik-backend.onrender.com/api';

class PublicApiService {
  /**
   * Get all elections (public)
   * @returns {Promise<Array>}
   */
  static async getElections() {
    const response = await fetch(`${API_BASE_URL}/public/election-results/elections`);
    if (!response.ok) {
      throw new Error(`Failed to fetch elections: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get election by ID (public)
   * @param {string|number} id
   * @returns {Promise<Object>}
   */
  static async getElectionById(id) {
    const response = await fetch(`${API_BASE_URL}/public/election-results/elections/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch election: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get election results (public)
   * @param {string|number} electionId
   * @param {string|number|null} ballotBoxId
   * @returns {Promise<Array>}
   */
  static async getElectionResults(electionId, ballotBoxId = null) {
    const params = new URLSearchParams();
    if (electionId) params.append('election_id', electionId);
    if (ballotBoxId) params.append('ballot_box_id', ballotBoxId);
    
    const response = await fetch(`${API_BASE_URL}/public/election-results/results?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch election results: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get all ballot boxes (public)
   * @returns {Promise<Array>}
   */
  static async getBallotBoxes() {
    const response = await fetch(`${API_BASE_URL}/public/election-results/ballot-boxes`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ballot boxes: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get all districts (public)
   * @returns {Promise<Array>}
   */
  static async getDistricts() {
    const response = await fetch(`${API_BASE_URL}/public/election-results/districts`);
    if (!response.ok) {
      throw new Error(`Failed to fetch districts: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get all towns (public)
   * @returns {Promise<Array>}
   */
  static async getTowns() {
    const response = await fetch(`${API_BASE_URL}/public/election-results/towns`);
    if (!response.ok) {
      throw new Error(`Failed to fetch towns: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get all neighborhoods (public)
   * @returns {Promise<Array>}
   */
  static async getNeighborhoods() {
    const response = await fetch(`${API_BASE_URL}/public/election-results/neighborhoods`);
    if (!response.ok) {
      throw new Error(`Failed to fetch neighborhoods: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get all villages (public)
   * @returns {Promise<Array>}
   */
  static async getVillages() {
    const response = await fetch(`${API_BASE_URL}/public/election-results/villages`);
    if (!response.ok) {
      throw new Error(`Failed to fetch villages: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get all observers (public)
   * Note: Sensitive information (password, tc, phone) is filtered on the backend
   * @returns {Promise<Array>}
   */
  static async getBallotBoxObservers() {
    const response = await fetch(`${API_BASE_URL}/public/election-results/observers`);
    if (!response.ok) {
      throw new Error(`Failed to fetch observers: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
}

export default PublicApiService;

