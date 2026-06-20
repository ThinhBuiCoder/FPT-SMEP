require('dotenv').config();
const mongoose = require('mongoose');
const Class = require('../src/models/Class');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  await mongoose.connect(uri);

  const duplicates = await Class.aggregate([
    {
      $group: {
        _id: {
          classCode: '$classCode',
          semester: '$semester',
          year: '$year',
        },
        count: { $sum: 1 },
        classes: {
          $push: {
            _id: '$_id',
            classCode: '$classCode',
            subjectCode: '$subjectCode',
            semester: '$semester',
            year: '$year',
            lectureId: '$lectureId',
          },
        },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { '_id.year': 1, '_id.semester': 1, '_id.classCode': 1 } },
  ]);

  if (duplicates.length === 0) {
    console.log('No duplicate class codes found within the same semester/year.');
    return;
  }

  console.log(`Found ${duplicates.length} duplicate class code group(s) within the same semester/year:`);
  for (const group of duplicates) {
    console.log(`\n${group._id.classCode} | ${group._id.semester} ${group._id.year} (${group.count})`);
    for (const cls of group.classes) {
      console.log(`- ${cls._id} | ${cls.subjectCode} | ${cls.semester} ${cls.year} | lecturer: ${cls.lectureId || 'none'}`);
    }
  }

  process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
