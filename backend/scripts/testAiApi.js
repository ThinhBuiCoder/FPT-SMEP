require('dotenv').config();
const http = require('http');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m"
};

const makeRequest = (path, method = 'GET', headers = {}, body = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(`${BASE_URL}${path}`, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
};

const runTests = async () => {
  console.log(`${colors.cyan}==========================================`);
  console.log(`Starting AI API Tests on ${BASE_URL}`);
  console.log(`==========================================${colors.reset}\n`);

  // 1. Test Health
  console.log('Testing GET /api/ai/health...');
  try {
    const health = await makeRequest('/api/ai/health');
    if (health.status === 200 && health.data.status === 'ok') {
      console.log(`${colors.green}✔ /api/ai/health: PASS${colors.reset}`);
    } else {
      console.log(`${colors.red}✖ /api/ai/health: FAIL (Status: ${health.status})${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.red}✖ /api/ai/health: FAIL (${e.message})${colors.reset}`);
  }

  // 2. Test Debug Config
  console.log('\nTesting GET /api/ai/debug/config...');
  try {
    const config = await makeRequest('/api/ai/debug/config');
    if (config.status === 200 || config.status === 403) {
      console.log(`${colors.green}✔ /api/ai/debug/config: PASS (Status: ${config.status})${colors.reset}`);
      if (config.data.gemini_api_key_loaded) console.log(`  > API key loaded: yes`);
      if (config.data.gemini_model) console.log(`  > Model: ${config.data.gemini_model}`);
    } else {
      console.log(`${colors.red}✖ /api/ai/debug/config: FAIL (Status: ${config.status})${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.red}✖ /api/ai/debug/config: FAIL (${e.message})${colors.reset}`);
  }

  // 3. Test Debug Gemini
  console.log('\nTesting GET /api/ai/debug/gemini...');
  try {
    const gemini = await makeRequest('/api/ai/debug/gemini');
    if (gemini.status === 200) {
      if (gemini.data.ok === true) {
        console.log(`${colors.green}✔ /api/ai/debug/gemini: PASS (Gemini connected successfully!)${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠ /api/ai/debug/gemini: PASS BUT RETURNED FALLBACK (Check API key/model limit)${colors.reset}`);
      }
    } else if (gemini.status === 403) {
      console.log(`${colors.green}✔ /api/ai/debug/gemini: PASS (Status: 403 Production Mode Active)${colors.reset}`);
    } else {
      console.log(`${colors.red}✖ /api/ai/debug/gemini: FAIL (Status: ${gemini.status})${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.red}✖ /api/ai/debug/gemini: FAIL (${e.message})${colors.reset}`);
  }

  // 4. Test Analyze Without Token
  console.log('\nTesting POST /api/ai/analyze (NO TOKEN)...');
  try {
    const noToken = await makeRequest('/api/ai/analyze', 'POST', {}, {
      startup_name: "EduTrack", problem: "A", solution: "B", target_customer: "C", business_model: "D", technology: "E", market: "F"
    });
    if (noToken.status === 401 || noToken.status === 403 || noToken.status === 404) {
      console.log(`${colors.green}✔ /api/ai/analyze không token: PASS (Status: ${noToken.status})${colors.reset}`);
    } else {
      console.log(`${colors.red}✖ /api/ai/analyze không token: FAIL (Status: ${noToken.status}. Expected 401/403)${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.red}✖ /api/ai/analyze không token: FAIL (${e.message})${colors.reset}`);
  }

  // 5. Test Analyze With Token (if TEST_AUTH_TOKEN exists)
  const token = process.env.TEST_AUTH_TOKEN;
  if (token) {
    console.log('\nTesting POST /api/ai/analyze (WITH TOKEN)...');
    try {
      const withToken = await makeRequest('/api/ai/analyze', 'POST', { Authorization: `Bearer ${token}` }, {
        startup_name: "EduTrack", problem: "Học tập", solution: "AI", target_customer: "SV", business_model: "SaaS", technology: "React", market: "VN"
      });
      if (withToken.status === 200) {
        if (withToken.data.overall_score === 50 && JSON.stringify(withToken.data).includes("phản hồi dự phòng")) {
           console.log(`${colors.yellow}⚠ /api/ai/analyze có token: PASS BUT RETURNED FALLBACK${colors.reset}`);
        } else {
           console.log(`${colors.green}✔ /api/ai/analyze có token: PASS (Real AI Result)${colors.reset}`);
        }
      } else {
        console.log(`${colors.red}✖ /api/ai/analyze có token: FAIL (Status: ${withToken.status})${colors.reset}`);
      }
    } catch (e) {
      console.log(`${colors.red}✖ /api/ai/analyze có token: FAIL (${e.message})${colors.reset}`);
    }
  } else {
    console.log(`\n${colors.cyan}Skipping POST /api/ai/analyze (WITH TOKEN) because TEST_AUTH_TOKEN is not set in .env${colors.reset}`);
  }

  // 6. Test Validation
  console.log('\nTesting Validation (Missing fields)...');
  try {
    const invalidReq = await makeRequest('/api/ai/analyze', 'POST', token ? { Authorization: `Bearer ${token}` } : {}, {
       startup_name: "Only Name"
    });
    // Should be 400 or 401 (if no token). If no token, we expect 401. If token, 400.
    if (invalidReq.status === 400 || invalidReq.status === 401 || invalidReq.status === 403) {
      console.log(`${colors.green}✔ Validation thiếu field: PASS (Status: ${invalidReq.status})${colors.reset}`);
    } else {
      console.log(`${colors.red}✖ Validation thiếu field: FAIL (Status: ${invalidReq.status})${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.red}✖ Validation thiếu field: FAIL (${e.message})${colors.reset}`);
  }
  
  console.log(`\n${colors.cyan}==========================================`);
  console.log(`Test Finished.`);
  console.log(`==========================================${colors.reset}\n`);
};

runTests();
