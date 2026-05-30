#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = parseArgs(process.argv.slice(2));
const rootDir = path.resolve(__dirname, '..');
const project = required(args.project, '--project');
const projectDir = path.resolve(rootDir, project);
const target = args.target || '.';
const reportPath = path.resolve(rootDir, args.report || `reports/${project}-lint-report.json`);
const baselinePath = path.resolve(rootDir, args.baseline || `quality-gates/baselines/${project}-lint-baseline.json`);
const baseRef = args.base || process.env.LINT_BASE_REF || process.env.GITHUB_BASE_REF || 'HEAD~1';
const compareAll = args['compare-all'] === 'true' || args['compare-all'] === true;

ensureDir(path.dirname(reportPath));

const eslintResult = spawnSync(
  commandForPlatform('npx'),
  ['eslint', target, '--format', 'json'],
  {
    cwd: projectDir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  }
);

if (!eslintResult.stdout || eslintResult.status === 2) {
  const failureReport = {
    project,
    generatedAt: new Date().toISOString(),
    status: 'lint_execution_failed',
    eslintExitCode: eslintResult.status,
    stderr: eslintResult.stderr,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(failureReport, null, 2)}\n`);
  console.error(JSON.stringify(failureReport, null, 2));
  process.exit(1);
}

let eslintOutput;
try {
  eslintOutput = JSON.parse(eslintResult.stdout);
} catch (error) {
  const failureReport = {
    project,
    generatedAt: new Date().toISOString(),
    status: 'lint_output_parse_failed',
    error: error.message,
    rawOutput: eslintResult.stdout,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(failureReport, null, 2)}\n`);
  console.error(JSON.stringify(failureReport, null, 2));
  process.exit(1);
}

const currentFindings = flattenFindings(eslintOutput, rootDir);
const baseline = readBaseline(baselinePath);
const baselineKeys = new Set((baseline.findings || []).map((finding) => finding.key));
const changedFiles = compareAll ? null : getChangedFiles(rootDir, baseRef, project);
const scopedFindings = changedFiles
  ? currentFindings.filter((finding) => changedFiles.has(finding.filePath))
  : currentFindings;
const newFindings = scopedFindings.filter((finding) => !baselineKeys.has(finding.key));
const newErrors = newFindings.filter((finding) => finding.severity === 2);
const totalErrors = currentFindings.filter((finding) => finding.severity === 2).length;
const totalWarnings = currentFindings.filter((finding) => finding.severity === 1).length;

const report = {
  project,
  generatedAt: new Date().toISOString(),
  status: newFindings.length > 0 ? 'failed' : 'passed',
  gateMode: changedFiles ? 'changed_files_against_baseline' : 'all_files_against_baseline',
  baseRef,
  changedFiles: changedFiles ? Array.from(changedFiles).sort() : null,
  baselinePath: path.relative(rootDir, baselinePath).replace(/\\/g, '/'),
  totals: {
    errors: totalErrors,
    warnings: totalWarnings,
    findings: currentFindings.length,
    scopedFindings: scopedFindings.length,
    newViolations: newFindings.length,
    newErrors: newErrors.length,
  },
  newFindings,
  findings: currentFindings,
};

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
process.exit(newFindings.length > 0 ? 1 : 0);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function required(value, flag) {
  if (!value) {
    console.error(`Missing required argument ${flag}`);
    process.exit(2);
  }
  return value;
}

function commandForPlatform(command) {
  return process.platform === 'win32' ? `${command}.cmd` : command;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readBaseline(filePath) {
  if (!fs.existsSync(filePath)) {
    return { findings: [] };
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    return { findings: parsed };
  }
  return parsed;
}

function flattenFindings(results, root) {
  return results.flatMap((fileResult) => {
    const relativePath = path.relative(root, fileResult.filePath).replace(/\\/g, '/');
    return fileResult.messages.map((message) => {
      const normalized = {
        filePath: relativePath,
        line: message.line || 0,
        column: message.column || 0,
        ruleId: message.ruleId || 'fatal',
        severity: message.severity,
        message: message.message,
      };
      return {
        ...normalized,
        key: fingerprint(normalized),
      };
    });
  });
}

function fingerprint(finding) {
  return [
    finding.filePath,
    finding.ruleId,
    finding.line,
    finding.column,
    finding.message,
  ].join('|');
}

function getChangedFiles(root, base, projectName) {
  const candidates = [
    ['diff', '--name-only', `${base}...HEAD`],
    ['diff', '--name-only', base],
  ];

  for (const candidate of candidates) {
    const result = spawnSync(commandForPlatform('git'), candidate, {
      cwd: root,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });

    if (result.status === 0) {
      const files = result.stdout
        .split(/\r?\n/)
        .map((file) => file.trim().replace(/\\/g, '/'))
        .filter((file) => file.startsWith(`${projectName}/`));
      return new Set(files);
    }
  }

  return null;
}
