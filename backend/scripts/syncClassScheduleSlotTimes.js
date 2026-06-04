require('dotenv').config();
const mongoose = require('mongoose');
const Class = require('../src/models/Class');
const { SLOT_TIMES } = require('../src/services/schedule.service');

const run = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  let updatedCount = 0;
  const classes = await Class.find({ 'schedule.slot': { $in: [1, 2, 3, 4] } });

  for (const cls of classes) {
    const slotTime = SLOT_TIMES[cls.schedule.slot];
    if (!slotTime) continue;

    if (cls.schedule.startTime !== slotTime.startTime || cls.schedule.endTime !== slotTime.endTime) {
      cls.schedule.startTime = slotTime.startTime;
      cls.schedule.endTime = slotTime.endTime;
      await cls.save();
      updatedCount++;
    }
  }

  console.log(`Updated ${updatedCount} class schedule(s).`);
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
