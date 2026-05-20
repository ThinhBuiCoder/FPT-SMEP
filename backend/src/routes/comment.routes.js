// src/routes/comment.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/comment.controller');
const { protect } = require('../middlewares/auth.middleware');

// Protect all comment routes
router.use(protect);

router.get('/proposal/:proposalId', ctrl.getProposalComments);
router.post('/proposal/:proposalId', ctrl.createProposalComment);
router.put('/:commentId/resolve', ctrl.resolveComment);

module.exports = router;
