// src/routes/ai.routes.js
const express = require('express');
const { analyzeStartup, getAiAnalyses, getAiAnalysisById } = require('../controllers/ai.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(protect);

router.post('/analyze-startup/:startupIdeaId', analyzeStartup);
router.get('/startup/:startupIdeaId', getAiAnalyses);
router.get('/analysis/:id', getAiAnalysisById);

module.exports = router;
