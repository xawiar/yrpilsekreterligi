/**
 * Public API Service
 * Authentication gerektirmeyen, sadece okuma (read-only) endpoint'leri icin
 * Firebase modunda: Firestore'dan dogrudan okur
 * Backend modunda: REST API kullanir
 */

import { collection, getDocs, query, where, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const USE_FIREBASE = import.meta.env.VITE_USE_FIREBASE === 'true' ||
                     import.meta.env.VITE_USE_FIREBASE === true ||
                     String(import.meta.env.VITE_USE_FIREBASE).toLowerCase() === 'true';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sekreterlik-backend.onrender.com/api';

async function firestoreGetAll(collectionName) {
  if (!db) return [];
  try {
    var snapshot = await getDocs(collection(db, collectionName));
    return snapshot.docs.map(function(d) { return { id: d.id, ...d.data() }; });
  } catch (e) {
    console.warn('Firestore read error (' + collectionName + '):', e.message);
    return [];
  }
}

class PublicApiService {
  static async getElections() {
    if (USE_FIREBASE) {
      return firestoreGetAll('elections');
    }
    var response = await fetch(API_BASE_URL + '/public/election-results/elections');
    if (!response.ok) throw new Error('Failed to fetch elections');
    return response.json();
  }

  static async getElectionById(id) {
    if (USE_FIREBASE && db) {
      // Firestore'da ID ile veya id alanı ile ara
      var docRef = doc(db, 'elections', String(id));
      var docSnap = await getDoc(docRef);
      if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() };
      // ID alani ile ara
      var allElections = await firestoreGetAll('elections');
      return allElections.find(function(e) { return String(e.id) === String(id); }) || null;
    }
    var response = await fetch(API_BASE_URL + '/public/election-results/elections/' + id);
    if (!response.ok) throw new Error('Failed to fetch election');
    return response.json();
  }

  static async getElectionResults(electionId, ballotBoxId) {
    if (USE_FIREBASE) {
      var results = await firestoreGetAll('election_results');
      var filtered = results;
      if (electionId) {
        filtered = filtered.filter(function(r) {
          return String(r.election_id) === String(electionId);
        });
      }
      if (ballotBoxId) {
        filtered = filtered.filter(function(r) {
          return String(r.ballot_box_id) === String(ballotBoxId);
        });
      }
      // Public: sadece onaylanmis sonuclar
      return filtered.filter(function(r) {
        return r.approval_status === 'approved' || r.approval_status == null;
      });
    }
    var params = new URLSearchParams();
    if (electionId) params.append('election_id', electionId);
    if (ballotBoxId) params.append('ballot_box_id', ballotBoxId);
    var response = await fetch(API_BASE_URL + '/public/election-results/results?' + params);
    if (!response.ok) throw new Error('Failed to fetch results');
    var data = await response.json();
    if (Array.isArray(data)) {
      return data.filter(function(r) { return r.approval_status === 'approved' || r.approval_status == null; });
    }
    return data;
  }

  static async getBallotBoxes() {
    if (USE_FIREBASE) return firestoreGetAll('ballot_boxes');
    var response = await fetch(API_BASE_URL + '/public/election-results/ballot-boxes');
    if (!response.ok) throw new Error('Failed to fetch ballot boxes');
    return response.json();
  }

  static async getDistricts() {
    if (USE_FIREBASE) return firestoreGetAll('districts');
    var response = await fetch(API_BASE_URL + '/public/election-results/districts');
    if (!response.ok) throw new Error('Failed to fetch districts');
    return response.json();
  }

  static async getTowns() {
    if (USE_FIREBASE) return firestoreGetAll('towns');
    var response = await fetch(API_BASE_URL + '/public/election-results/towns');
    if (!response.ok) throw new Error('Failed to fetch towns');
    return response.json();
  }

  static async getNeighborhoods() {
    if (USE_FIREBASE) return firestoreGetAll('neighborhoods');
    var response = await fetch(API_BASE_URL + '/public/election-results/neighborhoods');
    if (!response.ok) throw new Error('Failed to fetch neighborhoods');
    return response.json();
  }

  static async getVillages() {
    if (USE_FIREBASE) return firestoreGetAll('villages');
    var response = await fetch(API_BASE_URL + '/public/election-results/villages');
    if (!response.ok) throw new Error('Failed to fetch villages');
    return response.json();
  }

  static async getBallotBoxObservers() {
    if (USE_FIREBASE) {
      var observers = await firestoreGetAll('ballot_box_observers');
      // Hassas verileri filtrele (public)
      return observers.map(function(o) {
        return { id: o.id, name: o.name, ballot_box_id: o.ballot_box_id, is_chief_observer: o.is_chief_observer };
      });
    }
    var response = await fetch(API_BASE_URL + '/public/election-results/observers');
    if (!response.ok) throw new Error('Failed to fetch observers');
    return response.json();
  }
}

export default PublicApiService;
