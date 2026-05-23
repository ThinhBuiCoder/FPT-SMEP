const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Team = require('../src/models/Team');
const Class = require('../src/models/Class');
const ChatGroup = require('../src/models/ChatGroup');
const connectDB = require('../src/config/db');
const { createChatGroupForTeam } = require('../src/services/chatGroup.service');

/**
 * Build the new group name in format EXE201g_<classIndex>G<teamIndex>
 * e.g. subjectCode=EXE201, classIndex=5, teamCode=EXE201_5_TEAM_3 → exe201g_5G3
 */
const buildGroupName = (cls, team) => {
  try {
    const subject = (cls.subjectCode || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase(); // e.g. "EXE201"
    const classIdx = cls.classIndex || 1;
    const teamCodeStr = (team.teamCode || '').toUpperCase();
    const teamMatch = teamCodeStr.match(/_TEAM_(\d+)$/);
    const teamIdx = teamMatch ? parseInt(teamMatch[1], 10) : 1;
    return `${subject}g_${classIdx}G${teamIdx}`;
  } catch {
    return null;
  }
};

const run = async () => {
  try {
    // 1. Connect MongoDB
    await connectDB();

    console.log('Starting backfill for Team Chat Groups...');

    // 2. Fetch all teams (populate classId)
    const teams = await Team.find({});
    console.log(`Found ${teams.length} teams in database.`);

    let totalTeamsChecked = 0;
    let createdCount = 0;
    let renamedCount = 0;
    let attachedExistingCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const team of teams) {
      totalTeamsChecked++;
      try {
        // Load class info for name building
        const cls = await Class.findById(team.classId);

        // If team already has chatGroupId linked
        if (team.chatGroupId) {
          const chatGroupObj = await ChatGroup.findById(team.chatGroupId);
          if (chatGroupObj) {
            // Rename if using old format (ends with " Chat" or not matching new format)
            const expectedName = cls ? buildGroupName(cls, team) : null;
            if (expectedName && chatGroupObj.groupName !== expectedName) {
              const oldName = chatGroupObj.groupName;
              chatGroupObj.groupName = expectedName;
              await chatGroupObj.save();
              renamedCount++;
              console.log(`Renamed ChatGroup: "${oldName}" → "${expectedName}" (Team: ${team.teamCode})`);
            } else {
              skippedCount++;
            }
            continue;
          }
        }

        // If ChatGroup exists matching teamId but team not linked
        const existing = await ChatGroup.findOne({ teamId: team._id });
        if (existing) {
          team.chatGroupId = existing._id;
          await team.save();

          // Rename if needed
          const expectedName = cls ? buildGroupName(cls, team) : null;
          if (expectedName && existing.groupName !== expectedName) {
            const oldName = existing.groupName;
            existing.groupName = expectedName;
            await existing.save();
            renamedCount++;
            console.log(`Renamed & attached ChatGroup: "${oldName}" → "${expectedName}" (Team: ${team.teamCode})`);
          } else {
            attachedExistingCount++;
            console.log(`Attached existing ChatGroup for Team: ${team.teamName} (${team.teamCode})`);
          }
          continue;
        }

        // Otherwise create new chat group (service will use new naming logic)
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          const chatGroup = await createChatGroupForTeam(team._id, { session });
          team.chatGroupId = chatGroup._id;
          await team.save({ session });
          await session.commitTransaction();
          session.endSession();
          createdCount++;
          console.log(`Created new ChatGroup "${chatGroup.groupName}" for Team: ${team.teamName} (${team.teamCode})`);
        } catch (innerErr) {
          await session.abortTransaction();
          session.endSession();
          throw innerErr;
        }
      } catch (err) {
        failedCount++;
        errors.push({ teamId: team._id, teamCode: team.teamCode, error: err.message });
        console.error(`Failed to backfill team ${team.teamName || team._id}:`, err.message);
      }
    }

    console.log('\n======================================');
    console.log('BACKFILL COMPLETED SUMMARY');
    console.log('======================================');
    console.log(`Total Teams Checked:     ${totalTeamsChecked}`);
    console.log(`Created Count:           ${createdCount}`);
    console.log(`Renamed Count:           ${renamedCount}`);
    console.log(`Attached Existing Count: ${attachedExistingCount}`);
    console.log(`Skipped Count:           ${skippedCount}`);
    console.log(`Failed Count:            ${failedCount}`);
    if (errors.length > 0) {
      console.log('Errors:');
      console.log(JSON.stringify(errors, null, 2));
    }
    console.log('======================================');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('Fatal execution error:', error);
    process.exit(1);
  }
};

run();
