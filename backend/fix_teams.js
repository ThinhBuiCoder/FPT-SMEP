const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require('dotenv').config();
const mongoose = require('mongoose');
const Team = require('./src/models/Team');
const Class = require('./src/models/Class');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const teams = await Team.find().populate('classId');
    for (const team of teams) {
      if (!team.classId) continue;
      
      const cls = team.classId;
      
      // Parse teamIndex from teamCode
      // teamCode e.g., "EXE201_1_TEAM_1"
      let teamIndex = 1;
      const match = team.teamCode.match(/_TEAM_(\d+)$/);
      if (match) {
        teamIndex = parseInt(match[1], 10);
      }

      const groupName = cls.classCode; // e.g. EXE201_11
      const groupExe201 = `${cls.subjectCode}g_${cls.classIndex}G${teamIndex}`;

      team.groupName = groupName;
      team.groupExe201 = groupExe201;
      await team.save();
      console.log(`Updated team ${team.teamName}: groupName=${groupName}, groupExe201=${groupExe201}`);
    }

    console.log('Finished updating existing teams.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    mongoose.disconnect();
  }
};

run();
