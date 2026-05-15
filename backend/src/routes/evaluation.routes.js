// src/routes/evaluation.routes.js
const express = require('express');
const {
  createEvaluation, getEvaluationsByStartup,
  getEvaluationsByLecturer, updateEvaluation,
} = require('../controllers/evaluation.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

const router = express.Router();
router.use(protect);

router.post('/', authorize('LECTURER', 'ADMIN'), createEvaluation);
router.get('/startup/:startupIdeaId', getEvaluationsByStartup);
router.get('/lecturer/:lecturerId', authorize('LECTURER', 'ADMIN'), getEvaluationsByLecturer);
router.put('/:id', authorize('LECTURER', 'ADMIN'), updateEvaluation);

module.exports = router;
