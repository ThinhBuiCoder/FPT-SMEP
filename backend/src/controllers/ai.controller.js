// src/controllers/ai.controller.js
const AiAnalysis = require('../models/AiAnalysis');
const StartupIdea = require('../models/StartupIdea');
const Team = require('../models/Team');
const { analyzeStartupIdea } = require('../services/ai.service');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// POST /api/ai/analyze-startup/:startupIdeaId
const analyzeStartup = async (req, res) => {
  try {
    const idea = await StartupIdea.findById(req.params.startupIdeaId).populate('teamId');
    if (!idea) return errorResponse(res, 'Không tìm thấy startup idea.', 404);

    if (req.user.role === 'STUDENT') {
      const isMember = idea.teamId.members.some(m => m.userId.toString() === req.user._id.toString());
      if (!isMember) return errorResponse(res, 'Không có quyền phân tích idea này.', 403);
    }

    console.log(`🤖 AI analyzing: ${idea.startupName} [${idea._id}]`);
    const result = await analyzeStartupIdea(idea);

    const saved = await AiAnalysis.create({
      startupIdeaId: idea._id,
      strengths: result.strengths,
      weaknesses: result.weaknesses,
      feasibilityAnalysis: result.feasibilityAnalysis,
      marketPotential: result.marketPotential,
      risks: result.risks,
      similarIdeas: result.similarIdeas,
      suggestions: result.suggestions,
      aiScore: result.aiScore,
      model: result.model || 'mock',
    });

    return successResponse(res, { analysis: saved }, `Phân tích AI xong! Score: ${saved.aiScore}/100`, 201);
  } catch (err) {
    console.error('AI analyze error:', err);
    return errorResponse(res, 'Lỗi khi phân tích AI.', 500);
  }
};

// GET /api/ai/startup/:startupIdeaId
const getAiAnalyses = async (req, res) => {
  try {
    const analyses = await AiAnalysis.find({ startupIdeaId: req.params.startupIdeaId })
      .sort({ createdAt: -1 });
    return successResponse(res, { analyses });
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

// GET /api/ai/analysis/:id
const getAiAnalysisById = async (req, res) => {
  try {
    const analysis = await AiAnalysis.findById(req.params.id)
      .populate('startupIdeaId', 'startupName teamId');
    if (!analysis) return errorResponse(res, 'Không tìm thấy analysis.', 404);
    return successResponse(res, { analysis });
  } catch (err) {
    return errorResponse(res, 'Lỗi server.', 500);
  }
};

module.exports = { analyzeStartup, getAiAnalyses, getAiAnalysisById };
