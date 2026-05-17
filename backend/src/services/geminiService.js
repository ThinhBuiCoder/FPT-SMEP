const { GoogleGenAI } = require('@google/genai');

function extractJsonFromText(text) {
  if (!text || !text.trim()) {
    throw new Error("Empty Gemini response");
  }

  let cleaned = text.trim();
  // Remove markdown code fences if present
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*/, '');
  cleaned = cleaned.replace(/\s*```$/, '');

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in Gemini response");
  }

  const jsonStr = cleaned.substring(start, end + 1);
  
  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    console.log(`[GeminiService] JSON.parse failed first attempt: ${error.message}`);
    
    // Sanitize: replace control characters (0-31) with space, but keep valid whitespace if possible
    // Standard JSON.parse fails on raw newlines/tabs inside string literals.
    const sanitized = jsonStr.replace(/[\u0000-\u001F]/g, (match) => {
      if (match === '\n') return '\\n';
      if (match === '\r') return '';
      if (match === '\t') return '  ';
      return ' ';
    });

    try {
      return JSON.parse(sanitized);
    } catch (secondError) {
      console.error(`[GeminiService] JSON.parse failed after sanitize: ${secondError.message}`);
      throw new Error(`JSON decode error: ${secondError.message}`);
    }
  }
}

async function generateJson(prompt, fallback) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("[GeminiService] Missing GEMINI_API_KEY");
    return fallback;
  }

  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    console.log(`[GeminiService] Calling Gemini model: ${modelName}`);
    console.log(`[GeminiService] API key loaded: ${Boolean(apiKey)}`);
    
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const rawText = response.text;

    if (!rawText || !rawText.trim()) {
      console.log("[GeminiService] Empty response text from Gemini");
      return fallback;
    }

    try {
      return extractJsonFromText(rawText);
    } catch (parseError) {
      console.log(`[GeminiService] JSON parse error: ${parseError.message}`);
      // Log more of the response if it failed to parse
      console.log(`[GeminiService] Raw response preview (1000 chars): ${rawText.substring(0, 1000)}`);
      return fallback;
    }
  } catch (apiError) {
    console.error(`[GeminiService] Gemini API error:`, apiError);
    return fallback;
  }
}

module.exports = {
  generateJson,
  extractJsonFromText
};
