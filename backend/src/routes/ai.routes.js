// src/routes/ai.routes.js
const express = require('express');
const { analyzeStartup, getAiAnalyses, getAiAnalysisById } = require('../controllers/ai.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

// --- Debug Routes (Public but restricted to development) ---
const geminiAi = require('../controllers/geminiAi.controller');

const checkDevMode = (req, res, next) => {
  const env = process.env.NODE_ENV || process.env.APP_ENV || 'development';
  if (env === 'production') {
    return res.status(403).json({ message: "Debug endpoint disabled in production" });
  }
  next();
};

router.get('/health', geminiAi.healthEndpoint);
router.get('/debug/config', checkDevMode, geminiAi.debugConfigEndpoint);
router.get('/debug/gemini', checkDevMode, geminiAi.debugGeminiEndpoint);
// ----------------------------------------------------------

router.use(protect);

// --- Protected Gemini Direct AI Endpoints ---
router.post('/analyze', geminiAi.analyzeEndpoint);
router.post('/suggest', geminiAi.suggestEndpoint);
router.post('/similar', geminiAi.similarEndpoint);
router.post('/sentiment', geminiAi.sentimentEndpoint);
router.post('/rubric', geminiAi.rubricEndpoint);
// --------------------------------------------

router.post('/analyze-startup/:startupIdeaId', analyzeStartup);
router.get('/startup/:startupIdeaId', getAiAnalyses);
router.get('/analysis/:id', getAiAnalysisById);

module.exports = router;
