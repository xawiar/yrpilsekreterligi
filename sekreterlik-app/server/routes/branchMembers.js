const express = require('express');
const BranchMemberController = require('../controllers/BranchMemberController');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/branch-members?branch_type=kadin|genclik
router.get('/', BranchMemberController.getAll);

// GET /api/branch-members/:id
router.get('/:id', BranchMemberController.getById);

// POST /api/branch-members
router.post('/', requireAdmin, BranchMemberController.create);

// PUT /api/branch-members/:id
router.put('/:id', requireAdmin, BranchMemberController.update);

// DELETE /api/branch-members/:id
router.delete('/:id', requireAdmin, BranchMemberController.delete);

module.exports = router;
