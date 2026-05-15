// src/services/ai.service.js
// AI Analysis Service
// ─────────────────────────────────────────────────────────────
// Supports two modes:
//   1. MOCK mode (default): Generates realistic analysis from startup idea data
//   2. REAL mode: Uses OpenAI GPT-4o API when OPENAI_API_KEY is set
//
// To switch to real AI: just add OPENAI_API_KEY to your .env file
// ─────────────────────────────────────────────────────────────

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Analyze a startup idea using AI (Mock or Real OpenAI)
 * @param {Object} startupIdea - The startup idea object from DB
 * @returns {Object} AI analysis result
 */
const analyzeStartupIdea = async (startupIdea) => {
  if (OPENAI_API_KEY) {
    return await analyzeWithOpenAI(startupIdea);
  }
  return await analyzeWithMock(startupIdea);
};

// ─── REAL OpenAI Integration ──────────────────────────────
const analyzeWithOpenAI = async (idea) => {
  try {
    const OpenAI = require('openai');
    const client = new OpenAI({ apiKey: OPENAI_API_KEY });

    const prompt = buildPrompt(idea);

    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert startup advisor and VC analyst. Analyze startup ideas from university students in Vietnam. 
          Always respond in Vietnamese. Return ONLY valid JSON without markdown code blocks.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(completion.choices[0].message.content);
    return { ...result, model: 'gpt-4o' };
  } catch (error) {
    console.error('OpenAI error, falling back to mock:', error.message);
    return await analyzeWithMock(idea);
  }
};

// ─── MOCK AI Analysis (Intelligent, Content-Aware) ────────
const analyzeWithMock = async (idea) => {
  // Simulate AI processing delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Score calculation based on content completeness and quality
  const contentScore = calculateContentScore(idea);
  const marketScore = calculateMarketScore(idea.marketAnalysis);
  const techScore = calculateTechScore(idea.technology);
  const aiScore = Math.min(95, Math.max(30, Math.round((contentScore + marketScore + techScore) / 3)));

  // Generate context-aware analysis
  const analysis = generateContextAwareAnalysis(idea, aiScore);

  return { ...analysis, model: 'mock', aiScore };
};

const calculateContentScore = (idea) => {
  let score = 50;
  if (idea.problem?.length > 100) score += 10;
  if (idea.solution?.length > 150) score += 10;
  if (idea.targetCustomer?.length > 80) score += 8;
  if (idea.businessModel?.length > 100) score += 8;
  if (idea.competitors?.length > 50) score += 7;
  if (idea.stage === 'MVP' || idea.stage === 'Growth') score += 7;
  return Math.min(100, score);
};

const calculateMarketScore = (marketAnalysis) => {
  if (!marketAnalysis) return 40;
  let score = 50;
  if (/\d+[MB]/.test(marketAnalysis)) score += 15; // Has market size numbers
  if (/TAM|SAM|SOM/i.test(marketAnalysis)) score += 15; // Has TAM/SAM/SOM
  if (marketAnalysis.length > 200) score += 10;
  if (/%/.test(marketAnalysis)) score += 10; // Has percentages
  return Math.min(100, score);
};

const calculateTechScore = (technology) => {
  if (!technology) return 40;
  const techKeywords = ['React', 'Node', 'Python', 'AWS', 'AI', 'ML', 'blockchain', 'cloud', 'API', 'microservice'];
  const count = techKeywords.filter((kw) => technology.toLowerCase().includes(kw.toLowerCase())).length;
  return Math.min(100, 50 + count * 8);
};

const generateContextAwareAnalysis = (idea, aiScore) => {
  const isHighScore = aiScore >= 70;
  const isMidScore = aiScore >= 50 && aiScore < 70;

  return {
    strengths: [
      `Ý tưởng "${idea.startupName}" đã xác định rõ vấn đề: ${idea.problem?.substring(0, 80)}...`,
      idea.businessModel?.length > 50
        ? 'Business model được mô tả rõ ràng với nhiều revenue stream tiềm năng'
        : 'Có định hướng business model ban đầu',
      idea.targetCustomer?.length > 50
        ? 'Target customer được định nghĩa cụ thể, dễ validate'
        : 'Đã xác định được đối tượng khách hàng mục tiêu',
      isHighScore
        ? 'Market analysis thể hiện hiểu biết sâu về thị trường với số liệu cụ thể'
        : 'Có nhận thức về landscape cạnh tranh',
      `Stage hiện tại (${idea.stage || 'Idea'}) phù hợp với level đầu tư và nguồn lực hiện có`,
    ],
    weaknesses: [
      isMidScore || !isHighScore
        ? 'Business model cần được chi tiết hóa hơn về unit economics (CAC, LTV, break-even)'
        : 'Cần có kế hoạch scale-up rõ ràng hơn sau giai đoạn MVP',
      'Phân tích cạnh tranh cần deeper insight về competitive advantage bền vững',
      'Chưa có evidence từ customer interviews hoặc validation experiments',
      'Risk mitigation plan chưa được đề cập đầy đủ',
      idea.technology?.length < 50
        ? 'Technology stack cần được define rõ hơn để assess feasibility'
        : 'Cần clarify technical team capability để execute tech roadmap',
    ],
    feasibilityAnalysis: isHighScore
      ? `"${idea.startupName}" có tính khả thi cao với tech stack hiện đại và market timing tốt. Team cần focus vào: (1) MVP development trong 2-3 tháng, (2) Launch pilot với 50-100 early adopters, (3) Iterate dựa trên feedback. Budget estimate cho MVP: 50-100 triệu VNĐ.`
      : `"${idea.startupName}" có tiềm năng nhưng cần validation thêm. Recommend: (1) Thực hiện 20-30 customer interviews để validate problem-solution fit, (2) Build landing page để test demand, (3) Tìm co-founder kỹ thuật nếu chưa có. Timeline realistic: 4-6 tháng cho working prototype.`,
    marketPotential: `Thị trường mục tiêu của "${idea.startupName}" ${
      idea.marketAnalysis?.includes('tỷ') || idea.marketAnalysis?.includes('billion')
        ? 'có quy mô lớn với tiềm năng tăng trưởng mạnh. Nếu capture được 1% market share, revenue tiềm năng rất đáng kể.'
        : 'cần được research sâu hơn về TAM/SAM/SOM. Recommend thực hiện market sizing exercise dựa trên bottom-up approach.'
    } Vietnam's digital economy đang tăng trưởng 25%/năm, tạo nhiều cơ hội cho startups trong lĩnh vực này.`,
    risks: [
      'Market risk: Cạnh tranh từ players lớn hơn có thể copy idea nếu traction tốt',
      'Execution risk: Team size nhỏ khó execute nhiều feature cùng lúc',
      'Funding risk: Cần tìm nguồn vốn sớm để sustain operations trong 12-18 tháng đầu',
      'Technology risk: Dependency vào third-party APIs có thể gây gián đoạn',
      'Regulatory risk: Cần check các quy định pháp lý liên quan đến ngành',
    ],
    similarIdeas: [
      {
        name: 'Tiki / Shopee',
        similarity: 25,
        notes: 'Similar ecommerce mechanics nhưng different vertical',
      },
      {
        name: 'Startup Việt tương tự trong lĩnh vực này',
        similarity: 40,
        notes: 'Cần research thêm về local competitors',
      },
      {
        name: 'Global equivalent',
        similarity: 55,
        notes: 'International version exists — opportunity to localize for VN market',
      },
    ],
    suggestions: [
      '🎯 Ngắn hạn (1-2 tháng): Thực hiện 20 customer interviews, build landing page, test willingness to pay',
      '🚀 Trung hạn (3-6 tháng): Build MVP với core features only, launch với 50 beta users',
      '📈 Dài hạn (6-12 tháng): Iterate based on data, tìm lead investor, scale marketing',
      '💡 Quick win: Apply vào các startup accelerator như FPT Ventures, Shark Tank Vietnam',
      '🤝 Partnership: Kết nối với các hiệp hội ngành, university networks để get early traction',
      '📊 Metrics: Define và track North Star Metric ngay từ đầu (DAU, revenue, retention)',
    ],
  };
};

const buildPrompt = (idea) => {
  return `
Phân tích startup idea sau và trả về JSON với format chính xác:

Startup: ${idea.startupName}
Vấn đề: ${idea.problem}
Khách hàng mục tiêu: ${idea.targetCustomer}
Giải pháp: ${idea.solution}
Business Model: ${idea.businessModel}
Công nghệ: ${idea.technology}
Phân tích thị trường: ${idea.marketAnalysis}
Đối thủ: ${idea.competitors}
Stage: ${idea.stage}

Trả về JSON format sau (tiếng Việt):
{
  "strengths": ["string array - 4-6 điểm mạnh"],
  "weaknesses": ["string array - 4-5 điểm yếu"],
  "feasibilityAnalysis": "string - phân tích tính khả thi chi tiết",
  "marketPotential": "string - đánh giá tiềm năng thị trường",
  "risks": ["string array - 4-6 rủi ro"],
  "similarIdeas": [{"name": "string", "similarity": number_0-100, "notes": "string"}],
  "suggestions": ["string array - 5-7 gợi ý cụ thể"],
  "aiScore": number_0-100
}
`;
};

module.exports = { analyzeStartupIdea };
