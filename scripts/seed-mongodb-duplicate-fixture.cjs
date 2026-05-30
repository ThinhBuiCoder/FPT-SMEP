#!/usr/bin/env node

const mongoose = require('../backend/node_modules/mongoose');

const args = parseArgs(process.argv.slice(2));
const collectionName = args.collection || 'shortcuts';
const teamId = args.teamId || 'T001';

if (!args['confirm-test-db']) {
  console.error('Refusing to insert duplicate data without --confirm-test-db.');
  console.error('Use only with a disposable research/test database.');
  process.exit(2);
}

main().catch(async (error) => {
  console.error(error.message);
  await disconnect();
  process.exit(1);
});

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required.');
  }

  await mongoose.connect(uri);
  const schema = new mongoose.Schema({}, { strict: false, collection: collectionName });
  const Target = mongoose.models.DuplicateFixtureTarget
    || mongoose.model('DuplicateFixtureTarget', schema);

  const docs = await Target.insertMany([
    {
      teamId,
      name: 'Duplicate fixture A',
      url: 'Github.com/Test',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      teamId,
      name: 'Duplicate fixture B',
      url: 'github.com/test',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]);

  console.log(JSON.stringify({
    inserted: docs.map((doc) => String(doc._id)),
    collection: collectionName,
    teamId,
  }, null, 2));

  await disconnect();
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
