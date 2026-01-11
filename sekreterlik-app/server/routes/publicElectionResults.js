const express = require('express');
const { createRateLimiter } = require('../middleware/rateLimit');
const { cache } = require('../middleware/cache');
const ElectionController = require('../controllers/ElectionController');
const ElectionResultController = require('../controllers/ElectionResultController');
const BallotBoxController = require('../controllers/BallotBoxController');
const DistrictController = require('../controllers/DistrictController');
const TownController = require('../controllers/TownController');
const NeighborhoodController = require('../controllers/NeighborhoodController');
const VillageController = require('../controllers/VillageController');
const BallotBoxObserverController = require('../controllers/BallotBoxObserverController');

const router = express.Router();

// Security: Rate limiting for public endpoints
// Increased for high traffic: 1000 requests per 15 minutes per IP
// This allows ~1 request per second per user, which is reasonable for viewing results
const publicRateLimit = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 1000 });

// Performance: Caching for public endpoints
// Cache election data for 30 seconds (results change frequently during election day)
// Cache static data (districts, towns, etc.) for 5 minutes
const electionCache = cache(30); // 30 seconds for election results
const staticCache = cache(300); // 5 minutes for static data

// Security: Only allow GET methods for public endpoints
router.use((req, res, next) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Only GET requests are permitted for public endpoints.' 
    });
  }
  next();
});

// Security: Apply rate limiting to all public endpoints
router.use(publicRateLimit);

// Performance: Add cache-control headers for CDN/browser caching
router.use((req, res, next) => {
  // Set cache headers for static data (districts, towns, etc.)
  if (req.path.includes('/districts') || 
      req.path.includes('/towns') || 
      req.path.includes('/neighborhoods') || 
      req.path.includes('/villages') ||
      req.path.includes('/ballot-boxes')) {
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
  } else {
    // Shorter cache for dynamic data (elections, results)
    res.setHeader('Cache-Control', 'public, max-age=30'); // 30 seconds
  }
  next();
});

// Security: Input validation middleware
const validateElectionId = (req, res, next) => {
  const { id } = req.params;
  if (id && (isNaN(parseInt(id)) || parseInt(id) <= 0)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid election ID. Must be a positive number.' 
    });
  }
  next();
};

const validateQueryParams = (req, res, next) => {
  const { election_id, ballot_box_id } = req.query;
  
  if (election_id && (isNaN(parseInt(election_id)) || parseInt(election_id) <= 0)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid election_id. Must be a positive number.' 
    });
  }
  
  if (ballot_box_id && (isNaN(parseInt(ballot_box_id)) || parseInt(ballot_box_id) <= 0)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid ballot_box_id. Must be a positive number.' 
    });
  }
  
  next();
};

// Public election results endpoints - NO AUTHENTICATION REQUIRED
// These endpoints are for public viewing of election results
// SECURITY: Only read-only data, no sensitive information exposed

// GET /api/public/election-results/elections - Get all elections (public)
// Cached for 30 seconds (elections don't change frequently)
router.get('/elections', electionCache, ElectionController.getAll);

// GET /api/public/election-results/elections/:id - Get election by ID (public)
// Cached for 30 seconds
router.get('/elections/:id', validateElectionId, electionCache, ElectionController.getById);

// GET /api/public/election-results/results - Get election results (public)
// Query params: election_id, ballot_box_id
// Cached for 30 seconds (results update frequently during election day)
router.get('/results', validateQueryParams, electionCache, ElectionResultController.getAll);

// GET /api/public/election-results/ballot-boxes - Get all ballot boxes (public)
// Cached for 5 minutes (static data)
router.get('/ballot-boxes', staticCache, BallotBoxController.getAll);

// GET /api/public/election-results/districts - Get all districts (public)
// Cached for 5 minutes (static data)
router.get('/districts', staticCache, DistrictController.getAll);

// GET /api/public/election-results/towns - Get all towns (public)
// Cached for 5 minutes (static data)
router.get('/towns', staticCache, TownController.getAll);

// GET /api/public/election-results/neighborhoods - Get all neighborhoods (public)
// Cached for 5 minutes (static data)
router.get('/neighborhoods', staticCache, NeighborhoodController.getAll);

// GET /api/public/election-results/villages - Get all villages (public)
// Cached for 5 minutes (static data)
router.get('/villages', staticCache, VillageController.getAll);

// GET /api/public/election-results/observers - Get all observers (public)
// SECURITY: Sensitive information (passwords, etc.) filtered in controller
router.get('/observers', (req, res, next) => {
  // Store original json method to filter sensitive data
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    if (Array.isArray(data)) {
      // Filter sensitive information from observers
      data = data.map(observer => {
        const { password, tc, phone, ...safeObserver } = observer;
        return safeObserver;
      });
    } else if (data && typeof data === 'object') {
      const { password, tc, phone, ...safeData } = data;
      data = safeData;
    }
    return originalJson(data);
  };
  next();
}, BallotBoxObserverController.getAll);

module.exports = router;

