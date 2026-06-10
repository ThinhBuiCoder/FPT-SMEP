require('dotenv').config();
const mongoose = require('mongoose');
const Class = require('../src/models/Class');
const { DAYS, SLOT_TIMES } = require('../src/services/schedule.service');

const run = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  let updatedCount = 0;
  const invalidSchedules = [];
  const classes = await Class.find({ 'schedule.slot': { $exists: true } });

  for (const cls of classes) {
    const slotTime = SLOT_TIMES[cls.schedule.slot];
    if (!slotTime || !DAYS.includes(cls.schedule.dayOfWeek)) {
      invalidSchedules.push(`${cls.classCode}: ${cls.schedule.dayOfWeek || 'NO_DAY'} / slot ${cls.schedule.slot}`);
      continue;
    }

    if (cls.schedule.startTime !== slotTime.startTime || cls.schedule.endTime !== slotTime.endTime) {
      cls.schedule.startTime = slotTime.startTime;
      cls.schedule.endTime = slotTime.endTime;
      await cls.save();
      updatedCount++;
    }
  }

  console.log(`Checked ${classes.length} class schedule(s).`);
  console.log(`Updated ${updatedCount} class schedule(s).`);
  console.log(`Invalid ${invalidSchedules.length} class schedule(s).`);
  if (invalidSchedules.length > 0) {
    console.log(invalidSchedules.join('\n'));
    process.exitCode = 1;
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
