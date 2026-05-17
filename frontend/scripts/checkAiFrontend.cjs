const fs = require('fs');
const path = require('path');

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  cyan: "\x1b[36m"
};

console.log(`${colors.cyan}==========================================`);
console.log(`FPT-SMEP Frontend AI Module Static Audit`);
console.log(`==========================================${colors.reset}\n`);

const checkFileExists = (filePath) => {
  const exists = fs.existsSync(path.join(__dirname, '..', filePath));
  if (exists) {
    console.log(`${colors.green}✔ File exists: ${filePath}${colors.reset}`);
  } else {
    console.log(`${colors.red}✖ File missing: ${filePath}${colors.reset}`);
  }
  return exists;
};

// 1. Check aiApi.js functions
const apiPath = path.join(__dirname, '..', 'src/api/aiApi.js');
if (fs.existsSync(apiPath)) {
  const content = fs.readFileSync(apiPath, 'utf8');
  const functions = [
    'analyzeStartup',
    'suggestStartup',
    'detectSimilarIdea',
    'generateRubric',
    'analyzeSentiment'
  ];
  
  functions.forEach(fn => {
    if (content.includes(fn)) {
      console.log(`${colors.green}✔ aiApi.js has function: ${fn}${colors.reset}`);
    } else {
      console.log(`${colors.red}✖ aiApi.js missing function: ${fn}${colors.reset}`);
    }
  });
}

// 2. Check Components
const components = [
  'src/pages/common/AIAnalysis.jsx',
  'src/components/ai/SimilarIdeasTab.jsx',
  'src/components/ai/RubricGeneratorTab.jsx',
  'src/components/ai/SentimentAnalysisTab.jsx'
];
components.forEach(checkFileExists);

// 3. Check Security (Simple grep)
const searchDir = (dir, forbidden) => {
    let files = fs.readdirSync(dir);
    for (let file of files) {
        let fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== 'dist') searchDir(fullPath, forbidden);
        } else {
            let content = fs.readFileSync(fullPath, 'utf8');
            forbidden.forEach(word => {
                if (content.includes(word)) {
                    console.log(`${colors.red}✖ SECURITY ALERT: Found ${word} in ${fullPath}${colors.reset}`);
                }
            });
        }
    }
};

console.log('\nChecking for leaked secrets and direct SDK usage...');
searchDir(path.join(__dirname, '..', 'src'), ['GEMINI_API_KEY', '@google/genai', 'GoogleGenAI']);

console.log(`\n${colors.cyan}==========================================`);
console.log(`Audit Finished.`);
console.log(`==========================================${colors.reset}\n`);
