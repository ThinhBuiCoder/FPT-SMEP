const Class = require('../models/Class');

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const SLOT_TIMES = {
  1: { startTime: '07:30', endTime: '09:00' },
  2: { startTime: '09:10', endTime: '10:40' },
  3: { startTime: '12:30', endTime: '14:00' },
  4: { startTime: '14:10', endTime: '15:40' }
};

/**
 * Validates if a specific time slot is already taken by the lecturer.
 */
exports.validateScheduleConflict = async (lectureId, semester, year, dayOfWeek, slot, excludeClassId = null) => {
  if (!lectureId || !dayOfWeek || !slot) return false; // No conflict if schedule info is incomplete

  const query = {
    lectureId,
    semester: semester.toUpperCase(),
    year: parseInt(year, 10),
    'schedule.dayOfWeek': dayOfWeek,
    'schedule.slot': parseInt(slot, 10)
  };

  if (excludeClassId) {
    query._id = { $ne: excludeClassId };
  }

  const existingClass = await Class.findOne(query);
  return !!existingClass;
};

/**
 * Auto-generates schedules for a list of classes.
 * Assumes classes all belong to the same semester and year.
 * Operates in-memory and then saves to DB.
 */
exports.autoGenerateSchedule = async (classes) => {
  if (!classes || classes.length === 0) return { scheduledCount: 0, warnings: [] };

  const semester = classes[0].semester;
  const year = classes[0].year;
  const warnings = [];
  let scheduledCount = 0;

  // Track assigned slots in-memory for this run to prevent assigning the same slot twice in the same batch
  const memoryAssigned = {}; // format: { 'lectureId_dayOfWeek_slot': true }

  for (const cls of classes) {
    if (!cls.lectureId) continue; // Skip classes without a lecturer

    // If already has a valid schedule, skip
    if (cls.schedule && cls.schedule.dayOfWeek && cls.schedule.slot) continue;

    const lectIdStr = cls.lectureId.toString();
    let assigned = false;

    // Search for the first available slot
    for (const day of DAYS) {
      for (let slot = 1; slot <= 4; slot++) {
        const memoryKey = `${lectIdStr}_${day}_${slot}`;

        // 1. Check in-memory batch assignments
        if (memoryAssigned[memoryKey]) continue;

        // 2. Check DB
        const hasConflict = await exports.validateScheduleConflict(cls.lectureId, semester, year, day, slot, cls._id);
        
        if (!hasConflict) {
          // Found an available slot!
          cls.schedule = {
            dayOfWeek: day,
            slot: slot,
            startTime: SLOT_TIMES[slot].startTime,
            endTime: SLOT_TIMES[slot].endTime,
            room: 'TBD'
          };
          
          memoryAssigned[memoryKey] = true;
          assigned = true;
          
          await cls.save();
          scheduledCount++;
          break; // Break slot loop
        }
      }
      if (assigned) break; // Break day loop
    }

    if (!assigned) {
      warnings.push({
        classCode: cls.classCode,
        reason: 'No available slot for assigned lecturer (Mon-Sat, 4 slots/day full)'
      });
    }
  }

  return { scheduledCount, warnings };
};
