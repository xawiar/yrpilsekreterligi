const express = require('express');
const ArchiveController = require('../controllers/ArchiveController');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Document routes
router.get('/documents', ArchiveController.getDocuments);
router.post('/documents', ArchiveController.uploadDocument, ArchiveController.uploadDocumentHandler);
router.get('/documents/:id/download', ArchiveController.downloadDocument);
router.delete('/documents/:id', requireAdmin, ArchiveController.deleteDocument);

// Clear archived data routes (place BEFORE dynamic :id routes to avoid matching issues)
// Admin only - toplu silme işlemleri
router.delete('/members/clear', requireAdmin, ArchiveController.clearArchivedMembers);
router.delete('/meetings/clear', requireAdmin, ArchiveController.clearArchivedMeetings);
router.delete('/documents/clear', requireAdmin, ArchiveController.clearDocuments);
router.delete('/events/clear', requireAdmin, ArchiveController.clearArchivedEvents);

// Individual archived item deletion routes - Admin only
router.delete('/members/:id', requireAdmin, ArchiveController.deleteArchivedMember);
router.delete('/meetings/:id', requireAdmin, ArchiveController.deleteArchivedMeeting);

module.exports = router;