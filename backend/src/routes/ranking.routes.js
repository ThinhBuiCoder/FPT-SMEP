// src/routes/ranking.routes.js
const express = require('express');
const {
  getGlobalRankings,
  getClassRankings,
  getMyClassRankings,
  getMyTeamRankings,
} = require('../controllers/ranking.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

const router = express.Router();

router.use(protect);

router.get('/', authorize('ADMIN'), getGlobalRankings);
router.get('/class/:classId', authorize('ADMIN', 'LECTURER', 'MENTOR'), getClassRankings);
router.get('/my-class', authorize('STUDENT', 'ADMIN'), getMyClassRankings);
router.get('/my-teams', authorize('LECTURER', 'MENTOR', 'ADMIN'), getMyTeamRankings);

module.exports = router;
