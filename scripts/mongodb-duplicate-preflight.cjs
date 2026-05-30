#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const mongoose = require('../backend/node_modules/mongoose');
const { normalizeUrl } = require('../backend/src/utils/shortcutUrl');

const rootDir = path.resolve(__dirname, '..');
const args = parseArgs(process.argv.slice(2));
const reportPath = path.resolve(rootDir, args.report || 'reports/mongodb-duplicate-report.json');
const collectionName = args.collection || process.env.MONGODB_DUPLICATE_COLLECTION || 'shortcuts';
const teamField = args['team-field'] || process.env.MONGODB_TEAM_FIELD || 'teamId';
const urlField = args['url-field'] || process.env.MONGODB_URL_FIELD || 'url';
const normalizedUrlField = args['normalized-url-field'] || process.env.MONGODB_NORMALIZED_URL_FIELD || 'normalizedUrl';
const createIndex = args['create-index'] === true || args['create-index'] === 'true';

main().catch(async (error) => {
  const report = buildReport({
    status: 'failed',
    indexReadinessStatus: 'unknown',
    error: error.message,
  });
  writeReport(report);
  console.error(JSON.stringify(report, null, 2));
  await disconnect();
  process.exit(1);
});

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required.');
  }

  ensureDir(path.dirname(reportPath));
  await mongoose.connect(uri);

  const schema = new mongoose.Schema({}, { strict: false, collection: collectionName });
  const DuplicateTarget = mongoose.models.DuplicateTarget
    || mongoose.model('DuplicateTarget', schema);

  const projection = {
    [teamField]: 1,
    [urlField]: 1,
    [normalizedUrlField]: 1,
    createdAt: 1,
    updatedAt: 1,
  };

  const documents = await DuplicateTarget.find({}, projection).lean();
  const groups = new Map();
  const invalidDocuments = [];

  for (const document of documents) {
    const teamValue = document[teamField];
    const rawUrl = document[normalizedUrlField] || document[urlField];

    if (!teamValue || !rawUrl) {
      continue;
    }

    let normalizedUrl;
    try {
      normalizedUrl = document[normalizedUrlField] || normalizeUrl(rawUrl);
    } catch (error) {
      invalidDocuments.push({
        _id: String(document._id),
        teamId: String(teamValue),
        url: document[urlField] || null,
        reason: error.message,
      });
      continue;
    }

    const teamId = String(teamValue);
    const key = `${teamId}::${normalizedUrl}`;
    const existing = groups.get(key) || {
      teamId,
      normalizedUrl,
      documents: [],
    };

    existing.documents.push({
      _id: String(document._id),
      url: document[urlField] || null,
      normalizedUrl,
      createdAt: document.createdAt || null,
      updatedAt: document.updatedAt || null,
    });
    groups.set(key, existing);
  }

  const duplicateGroups = Array.from(groups.values())
    .filter((group) => group.documents.length > 1)
    .sort((a, b) => b.documents.length - a.documents.length);

  const duplicateDocumentsFound = duplicateGroups.reduce(
    (sum, group) => sum + group.documents.length,
    0
  );

  let indexCreationResult = null;
  if (createIndex && duplicateGroups.length === 0 && invalidDocuments.length === 0) {
    indexCreationResult = await DuplicateTarget.collection.createIndex(
      { [teamField]: 1, [normalizedUrlField]: 1 },
      { unique: true, name: `${teamField}_1_${normalizedUrlField}_1_unique` }
    );
  }

  const hasBlockingFindings = duplicateGroups.length > 0 || invalidDocuments.length > 0;
  const report = buildReport({
    status: hasBlockingFindings ? 'failed' : 'passed',
    indexReadinessStatus: hasBlockingFindings ? 'not_ready' : 'ready',
    totalDocumentsScanned: documents.length,
    duplicateGroupsFound: duplicateGroups.length,
    duplicateDocumentsFound,
    invalidDocumentsFound: invalidDocuments.length,
    duplicateGroups,
    invalidDocuments,
    indexCreationResult,
  });

  writeReport(report);
  console.log(JSON.stringify(report, null, 2));
  await disconnect();
  process.exit(hasBlockingFindings ? 1 : 0);
}

function buildReport(overrides) {
  return {
    generatedAt: new Date().toISOString(),
    collection: collectionName,
    uniquenessRule: {
      [teamField]: 1,
      [normalizedUrlField]: 1,
    },
    status: 'unknown',
    indexReadinessStatus: 'unknown',
    totalDocumentsScanned: 0,
    duplicateGroupsFound: 0,
    duplicateDocumentsFound: 0,
    invalidDocumentsFound: 0,
    duplicateGroups: [],
    invalidDocuments: [],
    ...overrides,
  };
}

function writeReport(report) {
  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

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
