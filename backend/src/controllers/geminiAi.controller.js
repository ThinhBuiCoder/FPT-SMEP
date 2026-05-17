// src/controllers/geminiAi.controller.js
const { generateJson } = require('../services/geminiService');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const {
  buildAnalysisPrompt,
  buildSuggestionPrompt,
  buildSimilarPrompt,
  buildSentimentPrompt,
  buildRubricPrompt
} = require('../utils/aiPromptBuilder');

const FALLBACK_ANALYSIS = {
  innovation_score: 50,
  feasibility_score: 50,
  market_potential_score: 50,
  technical_readiness_score: 50,
  overall_score: 50,
  risk_level: "Medium",
  strengths: ["Ý tưởng có tiềm năng nhưng cần thêm dữ liệu để đánh giá chính xác."],
  weaknesses: ["Thông tin phân tích hiện chưa đầy đủ hoặc AI service đang gặp lỗi."],
  opportunities: ["Có thể tiếp tục hoàn thiện proposal và kiểm chứng thị trường."],
  threats: ["Cần kiểm tra đối thủ, nhu cầu thực tế và khả năng triển khai."],
  ai_feedback: "Hệ thống AI chưa thể phân tích đầy đủ vào lúc này. Đây là phản hồi dự phòng.",
  recommendation: "Hãy bổ sung thêm dữ liệu về khách hàng mục tiêu, mô hình doanh thu và kế hoạch MVP."
};

const FALLBACK_SUGGESTION = {
  suggestions: [
    {
      area: "General",
      priority: "Medium",
      current_issue: "Chưa đủ dữ liệu hoặc AI service đang tạm thời gặp lỗi.",
      suggestion: "Hãy làm rõ vấn đề khách hàng, giải pháp cốt lõi và cách kiểm chứng nhu cầu thị trường.",
      example: "Có thể phỏng vấn 10-20 người dùng mục tiêu trước khi xây MVP."
    }
  ],
  mvp_recommendation: "Tạo MVP đơn giản tập trung vào một tính năng cốt lõi nhất.",
  next_steps: [
    "Xác định nhóm khách hàng mục tiêu rõ hơn.",
    "Phỏng vấn người dùng thật.",
    "Tạo prototype hoặc landing page để kiểm chứng nhu cầu."
  ],
  mentor_questions: [
    "Khách hàng đau ở điểm nào nhất?",
    "Vì sao họ chọn giải pháp của bạn thay vì cách hiện tại?",
    "Bạn sẽ kiểm chứng ý tưởng này trong 2 tuần như thế nào?"
  ]
};

const FALLBACK_SIMILAR = {
  similarity_risk: "Medium",
  known_competitors: [],
  differentiation_strategy: "Cần nghiên cứu thêm các đối thủ trực tiếp và gián tiếp trong thị trường mục tiêu.",
  unique_angle: "Tập trung vào một nhóm khách hàng hẹp hơn để tạo lợi thế ban đầu.",
  market_gap: "Có thể còn khoảng trống ở phân khúc sinh viên hoặc người dùng mới bắt đầu nếu giải pháp đủ đơn giản và dễ tiếp cận."
};

const getFallbackSentiment = (startupId) => ({
  startup_id: startupId || "",
  overall_sentiment: "Neutral",
  sentiment_score: 0,
  results: [],
  summary: "Chưa thể phân tích cảm xúc do AI service đang gặp lỗi hoặc dữ liệu chưa đủ.",
  action_required: false,
  urgent_issues: []
});

const FALLBACK_RUBRIC = {
  rubric_questions: [
    {
      category: "Problem Validation",
      question: "Sinh viên đã chứng minh vấn đề của khách hàng mục tiêu bằng dữ liệu hoặc phỏng vấn thực tế chưa?",
      scoring_guide: {
        "5": "Có dữ liệu/phỏng vấn rõ ràng, xác định đúng pain point và mức độ nghiêm trọng.",
        "3": "Có mô tả vấn đề nhưng bằng chứng còn hạn chế.",
        "1": "Vấn đề còn mơ hồ, chưa có bằng chứng từ người dùng."
      },
      follow_up: "Bạn đã phỏng vấn bao nhiêu người dùng và phát hiện insight nào quan trọng nhất?"
    }
  ],
  evaluation_tips: "Tập trung đánh giá bằng chứng thực tế, mức độ rõ ràng của khách hàng mục tiêu và khả năng triển khai MVP."
};

const healthEndpoint = (req, res) => {
  res.json({ status: "ok", service: "FPT-SMEP AI Service (Node.js)", version: "1.0.0" });
};

const debugConfigEndpoint = (req, res) => {
  res.json({
    gemini_api_key_loaded: !!process.env.GEMINI_API_KEY,
    gemini_model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    env_loaded: true
  });
};

const debugGeminiEndpoint = async (req, res) => {
  const prompt = 'Return only this JSON: {"ok": true, "message": "Gemini connected"}';
  const fallback = { ok: false, message: "Gemini fallback used" };
  const result = await generateJson(prompt, fallback);
  res.json(result);
};

const analyzeEndpoint = async (req, res) => {
  try {
    const { startup_name, startupName, problem, solution, target_customer, targetCustomer } = req.body;
    if (!startup_name && !startupName) return res.status(400).json({ error: "Missing startup_name" });
    if (!problem) return res.status(400).json({ error: "Missing problem" });
    if (!solution) return res.status(400).json({ error: "Missing solution" });
    if (!target_customer && !targetCustomer) return res.status(400).json({ error: "Missing target_customer" });

    const prompt = buildAnalysisPrompt(req.body);
    const result = await generateJson(prompt, FALLBACK_ANALYSIS);
    return res.status(200).json(result);
  } catch (error) {
    console.error("AI Analyze Error:", error);
    return res.status(200).json(FALLBACK_ANALYSIS);
  }
};

const suggestEndpoint = async (req, res) => {
  try {
    const { startup_name, startupName, current_proposal, currentProposal, stage, focus_area, focusArea } = req.body;
    if (!startup_name && !startupName) return res.status(400).json({ error: "Missing startup_name" });
    if (!current_proposal && !currentProposal) return res.status(400).json({ error: "Missing current_proposal" });
    if (!stage) return res.status(400).json({ error: "Missing stage" });
    if (!focus_area && !focusArea) return res.status(400).json({ error: "Missing focus_area" });

    const prompt = buildSuggestionPrompt(req.body);
    const result = await generateJson(prompt, FALLBACK_SUGGESTION);
    return res.status(200).json(result);
  } catch (error) {
    console.error("AI Suggest Error:", error);
    return res.status(200).json(FALLBACK_SUGGESTION);
  }
};

const similarEndpoint = async (req, res) => {
  try {
    const { startup_name, startupName, problem, solution, market } = req.body;
    if (!startup_name && !startupName) return res.status(400).json({ error: "Missing startup_name" });
    if (!problem) return res.status(400).json({ error: "Missing problem" });
    if (!solution) return res.status(400).json({ error: "Missing solution" });
    if (!market) return res.status(400).json({ error: "Missing market" });

    const prompt = buildSimilarPrompt(req.body);
    const result = await generateJson(prompt, FALLBACK_SIMILAR);
    return res.status(200).json(result);
  } catch (error) {
    console.error("AI Similar Error:", error);
    return res.status(200).json(FALLBACK_SIMILAR);
  }
};

const sentimentEndpoint = async (req, res) => {
  const startupId = req.body.startup_id || req.body.startupId;
  if (!startupId) return res.status(400).json({ error: "Missing startup_id" });
  if (!req.body.texts || !Array.isArray(req.body.texts)) return res.status(400).json({ error: "Missing or invalid texts array" });

  const fallback = getFallbackSentiment(startupId);
  try {
    const prompt = buildSentimentPrompt(req.body);
    const result = await generateJson(prompt, fallback);
    result.startup_id = startupId; // Ensure it's preserved
    return res.status(200).json(result);
  } catch (error) {
    console.error("AI Sentiment Error:", error);
    return res.status(200).json(fallback);
  }
};

const rubricEndpoint = async (req, res) => {
  try {
    const { startup_name, startupName, stage, focus_areas, focusAreas } = req.body;
    if (!startup_name && !startupName) return res.status(400).json({ error: "Missing startup_name" });
    if (!stage) return res.status(400).json({ error: "Missing stage" });
    if (!focus_areas && !focusAreas) return res.status(400).json({ error: "Missing focus_areas" });

    const prompt = buildRubricPrompt(req.body);
    const result = await generateJson(prompt, FALLBACK_RUBRIC);
    return res.status(200).json(result);
  } catch (error) {
    console.error("AI Rubric Error:", error);
    return res.status(200).json(FALLBACK_RUBRIC);
  }
};

module.exports = {
  healthEndpoint,
  debugConfigEndpoint,
  debugGeminiEndpoint,
  analyzeEndpoint,
  suggestEndpoint,
  similarEndpoint,
  sentimentEndpoint,
  rubricEndpoint
};
