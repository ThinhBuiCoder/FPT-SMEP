require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

async function testModel() {
  console.log("==================================================");
  console.log("GEMINI MODEL DIRECT TEST");
  console.log("==================================================");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("✖ FAILED: GEMINI_API_KEY is not set in .env");
    process.exit(1);
  }
  console.log("✔ API Key loaded:", true);

  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  console.log(`✔ Target Model: ${modelName}`);

  const ai = new GoogleGenAI({ apiKey });
  const prompt = 'Return only valid JSON: {"ok": true, "message": "Gemini connected"}';

  console.log("Calling Gemini API...");
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
    });

    const rawText = response.text;
    console.log("\n--- Raw Response ---");
    console.log(rawText);
    console.log("--------------------\n");

    let cleaned = rawText.trim();
    cleaned = cleaned.replace(/^```(?:json|JSON)?\s*/, '');
    cleaned = cleaned.replace(/\s*```$/, '');

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("No JSON object found in response");
    }

    const json = JSON.parse(cleaned.substring(start, end + 1));
    console.log("✔ Parsed JSON:", json);

    if (json.ok) {
      console.log("\n==================================================");
      console.log("SUCCESS: GEMINI CONNECTED PROPERLY");
      console.log("==================================================");
    } else {
      console.log("⚠ Parsed JSON did not contain { ok: true }");
    }

  } catch (error) {
    console.error("\n✖ ERROR CALLING GEMINI API:");
    console.error(error.message || error);
    
    const errStr = String(error.message || error).toLowerCase();
    if (errStr.includes("404") || errStr.includes("not found")) {
      console.log("\n==================================================");
      console.log("RECOMMENDATION:");
      console.log("Model not found. Try GEMINI_MODEL=gemini-2.5-flash or check available models in Google AI Studio.");
      console.log("==================================================");
    }
  }
}

testModel();
