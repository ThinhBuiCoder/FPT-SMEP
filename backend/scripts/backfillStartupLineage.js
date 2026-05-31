const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Team = require('../src/models/Team');
const Class = require('../src/models/Class');
const StartupLineage = require('../src/models/StartupLineage');
const User = require('../src/models/User');
const Shortcut = require('../src/models/Shortcut');

const semesterText = (cls) => `${cls?.semester || ''}${cls?.year || ''}`;

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for StartupLineage backfill');

    const admin = await User.findOne({ role: 'ADMIN' }).select('_id');
    if (!admin) throw new Error('Admin user not found. Run the standard seed first.');

    const teams = await Team.find({ lineageId: null });
    let created = 0;

    for (const team of teams) {
      // eslint-disable-next-line no-await-in-loop
      const cls = await Class.findById(team.classId).select('subjectCode semester year');
      // eslint-disable-next-line no-await-in-loop
      const lineage = await StartupLineage.create({
        startupName: team.projectName || team.teamName,
        originalTeamId: team._id,
        teamIds: [team._id],
        currentTeamId: team._id,
        status: 'ACTIVE',
        createdBy: admin._id,
      });

      team.lineageId = lineage._id;
      team.courseCode = team.courseCode || cls?.subjectCode || null;
      team.semester = team.semester || semesterText(cls);
      // eslint-disable-next-line no-await-in-loop
      await team.save();
      // eslint-disable-next-line no-await-in-loop
      await Shortcut.updateMany({ teamId: team._id, lineageId: null }, { lineageId: lineage._id });
      created += 1;
    }

    console.log(`Backfilled ${created} team lineage records.`);
    console.log('Use POST /api/team-workspaces/link for known EXE101 -> EXE201 continuity pairs.');
  } catch (err) {
    console.error('StartupLineage backfill failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

run();
