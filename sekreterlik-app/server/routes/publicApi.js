const express = require('express');
const { apiKeyAuth, requirePermission } = require('../middleware/apiKeyAuth');
const MemberController = require('../controllers/MemberController');
const MeetingController = require('../controllers/MeetingController');
const EventController = require('../controllers/EventController');
const DistrictController = require('../controllers/DistrictController');
const TownController = require('../controllers/TownController');
const NeighborhoodController = require('../controllers/NeighborhoodController');
const VillageController = require('../controllers/VillageController');
const STKController = require('../controllers/STKController');
const PublicInstitutionController = require('../controllers/PublicInstitutionController');
const MosqueController = require('../controllers/MosqueController');

const router = express.Router();

// All public API routes require API key authentication
router.use(apiKeyAuth);

// Read-only endpoints (require 'read' permission)
const readOnly = requirePermission('read');

// Members
router.get('/members', readOnly, MemberController.getAll);
router.get('/members/:id', readOnly, MemberController.getById);

// Meetings
router.get('/meetings', readOnly, MeetingController.getAll);
router.get('/meetings/:id', readOnly, MeetingController.getById);

// Events
router.get('/events', readOnly, EventController.getAll);
router.get('/events/:id', readOnly, EventController.getById);

// Districts
router.get('/districts', readOnly, DistrictController.getAll);
router.get('/districts/:id', readOnly, DistrictController.getById);

// Towns
router.get('/towns', readOnly, TownController.getAll);
router.get('/towns/:id', readOnly, TownController.getById);

// Neighborhoods
router.get('/neighborhoods', readOnly, NeighborhoodController.getAll);
router.get('/neighborhoods/:id', readOnly, NeighborhoodController.getById);

// Villages
router.get('/villages', readOnly, VillageController.getAll);
router.get('/villages/:id', readOnly, VillageController.getById);

// STKs
router.get('/stks', readOnly, STKController.getAll);
router.get('/stks/:id', readOnly, STKController.getById);

// Public Institutions
router.get('/public-institutions', readOnly, PublicInstitutionController.getAll);
router.get('/public-institutions/:id', readOnly, PublicInstitutionController.getById);

// Mosques
router.get('/mosques', readOnly, MosqueController.getAll);
router.get('/mosques/:id', readOnly, MosqueController.getById);

module.exports = router;

