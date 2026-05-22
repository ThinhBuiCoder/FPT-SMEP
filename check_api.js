const fs = require('fs');
const path = require('path');

const apiDir = path.join(__dirname, 'frontend/src/api');
const srcDir = path.join(__dirname, 'frontend/src');

// 1. Read all API files and extract exported keys
const apiFiles = fs.readdirSync(apiDir).filter(f => f.endsWith('Api.js'));
const apiExports = {};

for (const file of apiFiles) {
  const content = fs.readFileSync(path.join(apiDir, file), 'utf8');
  const apiNameMatch = content.match(/export const (\w+Api) = \{/);
  if (apiNameMatch) {
    const apiName = apiNameMatch[1];
    apiExports[apiName] = [];
    const blockMatch = content.match(/export const \w+Api = \{([\s\S]*?)\};/);
    if (blockMatch) {
      const methods = blockMatch[1].match(/(\w+):\s*(async\s*)?(?:function\s*)?\(/g);
      if (methods) {
        apiExports[apiName] = methods.map(m => m.split(':')[0].trim());
      }
    }
  }
}

// 2. Scan all files in src recursively for usage
function walkSync(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) {
      walkSync(dirPath, callback);
    } else if (f.endsWith('.js') || f.endsWith('.jsx')) {
      callback(dirPath);
    }
  });
}

const mismatches = [];

walkSync(srcDir, (filePath) => {
  if (filePath.includes('api\\') || filePath.includes('api/')) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const apiName in apiExports) {
    const regex = new RegExp(`${apiName}\\.(\\w+)`, 'g');
    let match;
    while ((match = regex.exec(content)) !== null) {
      const method = match[1];
      if (!apiExports[apiName].includes(method)) {
        mismatches.push({ file: filePath, api: apiName, method });
      }
    }
  }
});

console.log('Mismatches found:');
console.log(JSON.stringify(mismatches, null, 2));
