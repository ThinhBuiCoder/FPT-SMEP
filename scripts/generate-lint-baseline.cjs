#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const reportPath = path.resolve(process.argv[2]);
const baselinePath = path.resolve(process.argv[3]);

if (!reportPath || !baselinePath) {
  console.error('Usage: node scripts/generate-lint-baseline.cjs <lint-report.json> <baseline.json>');
  process.exit(2);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const baseline = {
  generatedAt: new Date().toISOString(),
  sourceReport: path.basename(reportPath),
  findings: (report.findings || []).map((finding) => ({
    key: finding.key,
    filePath: finding.filePath,
    ruleId: finding.ruleId,
    line: finding.line,
    column: finding.column,
    severity: finding.severity,
    message: finding.message,
  })),
};

fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(JSON.stringify({
  baselinePath,
  findings: baseline.findings.length,
}, null, 2));
