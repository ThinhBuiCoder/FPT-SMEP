// src/utils/aiPromptBuilder.js

const buildAnalysisPrompt = (data) => {
  return `Bạn là một chuyên gia đánh giá startup với 10 năm kinh nghiệm. Bạn am hiểu hệ sinh thái khởi nghiệp Việt Nam và quốc tế.
  
Vui lòng phân tích ý tưởng startup sau:
Tên: ${data.startup_name || data.startupName}
Vấn đề: ${data.problem}
Giải pháp: ${data.solution}
Khách hàng mục tiêu: ${data.target_customer || data.targetCustomer}
Mô hình kinh doanh: ${data.business_model || data.businessModel}
Công nghệ: ${data.technology}
Thị trường: ${data.market}

YÊU CẦU:
1. Chấm điểm nghiêm túc, không chấm quá cao.
2. Trả lời chuyên nghiệp nhưng dễ hiểu.
3. Đưa ra điểm mạnh, điểm yếu, cơ hội, rủi ro cụ thể, actionable.
4. Trả về đúng định dạng JSON, KHÔNG dùng markdown \`\`\`json, KHÔNG có text bên ngoài. 
5. KHÔNG xuống dòng bên trong giá trị chuỗi (string values). Escape newline thành \\n nếu cần.
6. KHÔNG dùng ký tự Tab hay các ký tự điều khiển (control characters) trong chuỗi.
7. Đảm bảo toàn bộ phản hồi là một Object JSON hợp lệ duy nhất.

Định dạng JSON cần trả về:
{
  "innovation_score": int (0-100),
  "feasibility_score": int (0-100),
  "market_potential_score": int (0-100),
  "technical_readiness_score": int (0-100),
  "overall_score": int (0-100),
  "risk_level": "Low" | "Medium" | "High",
  "strengths": ["điểm mạnh 1", ...],
  "weaknesses": ["điểm yếu 1", ...],
  "opportunities": ["cơ hội 1", ...],
  "threats": ["thách thức 1", ...],
  "ai_feedback": "Nhận xét tổng quan...",
  "recommendation": "Khuyến nghị cụ thể..."
}`;
};

const buildSuggestionPrompt = (data) => {
  const weaknesses = data.analysis_result?.weaknesses || data.analysisResult?.weaknesses || [];
  return `Bạn là một Mentor startup trong môi trường đại học. Vui lòng gợi ý cải thiện ý tưởng startup cho sinh viên.
Tên: ${data.startup_name || data.startupName}
Đề xuất hiện tại: ${data.current_proposal || data.currentProposal}
Điểm yếu phân tích được: ${weaknesses.join(', ')}
Giai đoạn: ${data.stage}
Lĩnh vực tập trung: ${data.focus_area || data.focusArea}

YÊU CẦU:
1. Gợi ý thực tế, phù hợp sinh viên đại học.
2. Không yêu cầu nguồn vốn quá lớn.
3. Có next steps rõ ràng và câu hỏi mentor nên hỏi sinh viên.
4. Gợi ý cụ thể, actionable, không chung chung.
5. Trả về đúng định dạng JSON, KHÔNG dùng markdown \`\`\`json, KHÔNG có text bên ngoài.
6. KHÔNG xuống dòng hoặc dùng ký tự điều khiển trong giá trị JSON.

Định dạng JSON cần trả về:
{
  "suggestions": [
    {
      "area": "Tên lĩnh vực",
      "priority": "High" | "Medium" | "Low",
      "current_issue": "Mô tả vấn đề",
      "suggestion": "Gợi ý cải thiện",
      "example": "Ví dụ thực tế"
    }
  ],
  "mvp_recommendation": "Gợi ý MVP...",
  "next_steps": ["bước 1", "bước 2"],
  "mentor_questions": ["câu hỏi 1?", "câu hỏi 2?"]
}`;
};

const buildSimilarPrompt = (data) => {
  return `Bạn là chuyên gia phân tích thị trường khởi nghiệp. Hãy tìm các ý tưởng tương tự hoặc đối thủ cạnh tranh cho startup sau. Ưu tiên thị trường Việt Nam trước.

Tên: ${data.startup_name || data.startupName}
Vấn đề: ${data.problem}
Giải pháp: ${data.solution}
Khách hàng mục tiêu: ${data.target_customer || data.targetCustomer}
Thị trường: ${data.market}

YÊU CẦU:
1. Không bịa đặt đối thủ nếu không chắc chắn (nếu không chắc, ghi rõ dựa trên phân tích chung).
2. Đưa ra hướng khác biệt hóa rõ ràng.
3. Trả về đúng định dạng JSON, KHÔNG dùng markdown \`\`\`json, KHÔNG có text ngoài JSON.
4. KHÔNG dùng ký tự điều khiển hoặc xuống dòng trong string values.

Định dạng JSON cần trả về:
{
  "similarity_risk": "Low" | "Medium" | "High",
  "known_competitors": [
    {
      "name": "Tên công ty",
      "similarity_percent": int (0-100),
      "description": "Mô tả",
      "market": "Thị trường",
      "how_to_differentiate": "Cách khác biệt"
    }
  ],
  "differentiation_strategy": "Chiến lược tổng thể...",
  "unique_angle": "Góc độ độc đáo...",
  "market_gap": "Khoảng trống thị trường..."
}`;
};

const buildSentimentPrompt = (data) => {
  const textsJson = JSON.stringify(data.texts || []);
  return `Bạn là chuyên gia phân tích cảm xúc ngôn ngữ tự nhiên. Hãy phân tích các feedback sau của hệ thống startup mentoring (gồm tiếng Anh và tiếng Việt).

Danh sách feedback:
${textsJson}
Startup ID: ${data.startup_id || data.startupId}

YÊU CẦU:
1. Nhận dạng được Mixed sentiment.
2. Xác định có vấn đề khẩn cấp cần hành động (action_required) không.
3. Trả về đúng định dạng JSON, KHÔNG dùng markdown \`\`\`json, KHÔNG có text ngoài JSON.
4. Đảm bảo JSON hợp lệ, không có ký tự điều khiển lỗi.

Định dạng JSON cần trả về:
{
  "startup_id": "${data.startup_id || data.startupId}",
  "overall_sentiment": "Positive" | "Negative" | "Neutral" | "Mixed",
  "sentiment_score": float (-1.0 đến 1.0),
  "results": [
    {
      "id": "feedback_id_tương_ứng",
      "sentiment": "Positive" | "Negative" | "Neutral" | "Mixed",
      "confidence": float (0.0 đến 1.0),
      "key_phrases": ["từ khóa 1", "từ khóa 2"],
      "concerns": ["vấn đề 1", "vấn đề 2"]
    }
  ],
  "summary": "Tóm tắt cảm xúc...",
  "action_required": boolean,
  "urgent_issues": ["vấn đề khẩn cấp"]
}`;
};

const buildRubricPrompt = (data) => {
  const focusAreas = data.focus_areas || data.focusAreas || [];
  return `Bạn là chuyên gia xây dựng tiêu chí đánh giá startup tại môi trường học thuật đại học. Hãy sinh các câu hỏi Rubric cho hội đồng mentor/lecturer.

Tên startup: ${data.startup_name || data.startupName}
Giai đoạn: ${data.stage}
Mô hình kinh doanh: ${data.business_model || data.businessModel}
Lĩnh vực tập trung: ${focusAreas.join(', ')}

YÊU CẦU:
1. Sinh 8-12 câu hỏi cụ thể theo stage và focus_areas.
2. Có hướng dẫn chấm điểm 5/3/1 rõ ràng.
3. Trả về JSON hợp lệ, KHÔNG dùng markdown \`\`\`json, KHÔNG có text bên ngoài JSON.
4. Tuyệt đối không để ký tự xuống dòng (raw newline) hoặc Tab trong string values.

Định dạng JSON cần trả về:
{
  "rubric_questions": [
    {
      "category": "Tên category",
      "question": "Nội dung câu hỏi",
      "scoring_guide": {
        "5": "Mô tả điểm 5",
        "3": "Mô tả điểm 3",
        "1": "Mô tả điểm 1"
      },
      "follow_up": "Câu hỏi đào sâu"
    }
  ],
  "evaluation_tips": "Gợi ý chung cho hội đồng..."
}`;
};

module.exports = {
  buildAnalysisPrompt,
  buildSuggestionPrompt,
  buildSimilarPrompt,
  buildSentimentPrompt,
  buildRubricPrompt
};
