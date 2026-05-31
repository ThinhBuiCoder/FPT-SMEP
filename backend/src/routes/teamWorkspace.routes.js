const express = require('express');
const ctrl = require('../controllers/teamWorkspace.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(protect);

router.get('/current', ctrl.getCurrentWorkspace);
router.get('/team/:teamId/context', ctrl.getWorkspaceContext);
router.get('/lineage/:lineageId', ctrl.getLineageWorkspaces);
router.post('/link', ctrl.linkWorkspaces);
router.post('/pivot', ctrl.pivotWorkspace);

module.exports = router;
