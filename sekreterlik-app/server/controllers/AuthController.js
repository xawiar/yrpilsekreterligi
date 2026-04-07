/**
 * AuthController — extracted handler functions from routes/auth.js
 * Keeps the large coordinator dashboard logic out of the route file.
 */
const db = require('../config/database');
const { parseElectionResultVotes } = require('../utils/electionUtils');

/**
 * GET /auth/coordinator-dashboard/:coordinatorId
 * Returns ballot boxes, region info, election results for a coordinator.
 */
async function coordinatorDashboard(req, res) {
  try {
    const { coordinatorId } = req.params;
    const ElectionCoordinator = require('../models/ElectionCoordinator');
    const ElectionRegion = require('../models/ElectionRegion');

    // Get coordinator
    const coordinator = await ElectionCoordinator.getById(coordinatorId);
    if (!coordinator) {
      return res.status(404).json({
        success: false,
        message: 'Sorumlu bulunamadı'
      });
    }

    let ballotBoxes = [];

    if (coordinator.role === 'provincial_coordinator') {
      // İl Genel Sorumlusu: Tüm sandıklar
      ballotBoxes = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM ballot_boxes ORDER BY ballot_number', [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    } else if (coordinator.role === 'district_supervisor') {
      // İlçe Sorumlusu: Bağlı bölge sorumlularının bölgelerindeki sandıklar
      const allCoordinators = await ElectionCoordinator.getAll();
      const regionSupervisors = allCoordinators.filter(c =>
        c.role === 'region_supervisor' &&
        String(c.parent_coordinator_id) === String(coordinator.id)
      );

      const allRegions = await ElectionRegion.getAll();
      const ballotBoxIds = new Set();

      for (const regionSupervisor of regionSupervisors) {
        const region = allRegions.find(r =>
          String(r.supervisor_id) === String(regionSupervisor.id)
        );
        if (region) {
          const neighborhoodIds = Array.isArray(region.neighborhood_ids)
            ? region.neighborhood_ids
            : (region.neighborhood_ids ? JSON.parse(region.neighborhood_ids) : []);
          const villageIds = Array.isArray(region.village_ids)
            ? region.village_ids
            : (region.village_ids ? JSON.parse(region.village_ids) : []);

          if (neighborhoodIds.length > 0 || villageIds.length > 0) {
            let query = 'SELECT * FROM ballot_boxes WHERE ';
            const conditions = [];
            const params = [];

            if (neighborhoodIds.length > 0) {
              conditions.push(`neighborhood_id IN (${neighborhoodIds.map(() => '?').join(',')})`);
              params.push(...neighborhoodIds);
            }
            if (villageIds.length > 0) {
              if (conditions.length > 0) conditions.push('OR');
              conditions.push(`village_id IN (${villageIds.map(() => '?').join(',')})`);
              params.push(...villageIds);
            }

            if (conditions.length > 0) {
              query += conditions.join(' ');
              const regionBallotBoxes = await new Promise((resolve, reject) => {
                db.all(query, params, (err, rows) => {
                  if (err) reject(err);
                  else resolve(rows || []);
                });
              });

              regionBallotBoxes.forEach(bb => ballotBoxIds.add(bb.id));
            }
          }
        }
      }

      if (ballotBoxIds.size > 0) {
        const idsArray = Array.from(ballotBoxIds);
        ballotBoxes = await new Promise((resolve, reject) => {
          db.all(`SELECT * FROM ballot_boxes WHERE id IN (${idsArray.map(() => '?').join(',')}) ORDER BY ballot_number`,
            idsArray, (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            });
        });
      }
    } else if (coordinator.role === 'region_supervisor') {
      // Bölge Sorumlusu: Kendi bölgesindeki sandıklar
      const allRegions = await ElectionRegion.getAll();
      const region = allRegions.find(r =>
        String(r.supervisor_id) === String(coordinator.id)
      );

      if (region) {
        const neighborhoodIds = Array.isArray(region.neighborhood_ids)
          ? region.neighborhood_ids
          : (region.neighborhood_ids ? JSON.parse(region.neighborhood_ids) : []);
        const villageIds = Array.isArray(region.village_ids)
          ? region.village_ids
          : (region.village_ids ? JSON.parse(region.village_ids) : []);

        let query = 'SELECT * FROM ballot_boxes WHERE ';
        const conditions = [];
        const params = [];

        if (neighborhoodIds.length > 0) {
          conditions.push(`neighborhood_id IN (${neighborhoodIds.map(() => '?').join(',')})`);
          params.push(...neighborhoodIds);
        }
        if (villageIds.length > 0) {
          if (conditions.length > 0) conditions.push('OR');
          conditions.push(`village_id IN (${villageIds.map(() => '?').join(',')})`);
          params.push(...villageIds);
        }

        if (conditions.length > 0) {
          query += conditions.join(' ') + ' ORDER BY ballot_number';
          ballotBoxes = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            });
          });
        }
      }
    } else if (coordinator.role === 'institution_supervisor' && coordinator.institution_name) {
      // Kurum Sorumlusu: Kendi kurumundaki sandıklar
      ballotBoxes = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM ballot_boxes WHERE institution_name = ? ORDER BY ballot_number',
          [coordinator.institution_name], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
      });
    }

    // Bölge, mahalle, köy bilgilerini topla
    let regionInfo = null;
    let neighborhoods = [];
    let villages = [];
    let parentCoordinators = [];

    if (coordinator.role === 'region_supervisor') {
      const allRegions = await ElectionRegion.getAll();
      const region = allRegions.find(r => String(r.supervisor_id) === String(coordinator.id));
      if (region) {
        regionInfo = {
          id: region.id,
          name: region.name
        };

        const neighborhoodIds = Array.isArray(region.neighborhood_ids)
          ? region.neighborhood_ids
          : (region.neighborhood_ids ? JSON.parse(region.neighborhood_ids) : []);
        const villageIds = Array.isArray(region.village_ids)
          ? region.village_ids
          : (region.village_ids ? JSON.parse(region.village_ids) : []);

        if (neighborhoodIds.length > 0) {
          const neighborhoodQuery = `SELECT * FROM neighborhoods WHERE id IN (${neighborhoodIds.map(() => '?').join(',')})`;
          neighborhoods = await new Promise((resolve, reject) => {
            db.all(neighborhoodQuery, neighborhoodIds, (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            });
          });
        }

        if (villageIds.length > 0) {
          const villageQuery = `SELECT * FROM villages WHERE id IN (${villageIds.map(() => '?').join(',')})`;
          villages = await new Promise((resolve, reject) => {
            db.all(villageQuery, villageIds, (err, rows) => {
              if (err) reject(err);
              else resolve(rows || []);
            });
          });
        }
      }
    } else if (coordinator.role === 'institution_supervisor' && ballotBoxes.length > 0) {
      const firstBox = ballotBoxes[0];
      if (firstBox.neighborhood_id) {
        const neighborhood = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM neighborhoods WHERE id = ?', [firstBox.neighborhood_id], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
          });
        });
        if (neighborhood) neighborhoods = [neighborhood];
      }
      if (firstBox.village_id) {
        const village = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM villages WHERE id = ?', [firstBox.village_id], (err, row) => {
            if (err) reject(err);
            else resolve(row || null);
          });
        });
        if (village) villages = [village];
      }
    }

    // Üst sorumluları bul
    if (coordinator.parent_coordinator_id) {
      const allCoordinators = await ElectionCoordinator.getAll();
      let currentParentId = coordinator.parent_coordinator_id;
      while (currentParentId) {
        const parent = allCoordinators.find(c => String(c.id) === String(currentParentId));
        if (parent) {
          parentCoordinators.push({
            id: parent.id,
            name: parent.name,
            role: parent.role
          });
          currentParentId = parent.parent_coordinator_id;
        } else {
          break;
        }
      }
    }

    // Seçim sonuçlarını al (sorumlu olduğu sandıklar için)
    const electionResults = [];
    if (ballotBoxes.length > 0) {
      const ballotBoxIds = ballotBoxes.map(bb => bb.id);
      const results = await new Promise((resolve, reject) => {
        db.all(`
          SELECT er.*, e.name as election_name, e.type as election_type, e.date as election_date
          FROM election_results er
          LEFT JOIN elections e ON er.election_id = e.id
          WHERE er.ballot_box_id IN (${ballotBoxIds.map(() => '?').join(',')})
          ORDER BY e.date DESC, er.ballot_box_id
        `, ballotBoxIds, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      // Parse JSON fields using utility
      electionResults.push(...results.map(parseElectionResultVotes));
    }

    res.json({
      success: true,
      coordinator: {
        id: coordinator.id,
        name: coordinator.name,
        role: coordinator.role,
        institutionName: coordinator.institution_name
      },
      ballotBoxes: ballotBoxes || [],
      regionInfo,
      neighborhoods,
      villages,
      parentCoordinators,
      electionResults
    });
  } catch (error) {
    console.error('Coordinator dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Dashboard verileri alınırken hata oluştu',
      error: error.message
    });
  }
}

module.exports = {
  coordinatorDashboard,
};
