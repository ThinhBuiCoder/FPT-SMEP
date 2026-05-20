const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Team = require('../src/models/Team');
const ChatGroup = require('../src/models/ChatGroup');
const connectDB = require('../src/config/db');
const { createChatGroupForTeam } = require('../src/services/chatGroup.service');

const run = async () => {
  try {
    // 1. Connect MongoDB
    await connectDB();

    console.log('Starting backfill for Team Chat Groups...');

    // 2. Fetch all teams
    const teams = await Team.find({});
    console.log(`Found ${teams.length} teams in database.`);

    let totalTeamsChecked = 0;
    let createdCount = 0;
    let attachedExistingCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errors = [];

    for (const team of teams) {
      totalTeamsChecked++;
      try {
        // If team already has chatGroupId linked
        if (team.chatGroupId) {
          const chatGroupObj = await ChatGroup.findById(team.chatGroupId);
          if (chatGroupObj) {
            skippedCount++;
            continue;
          }
        }

        // If ChatGroup exists matching teamId but team not linked
        const existing = await ChatGroup.findOne({ teamId: team._id });
        if (existing) {
          team.chatGroupId = existing._id;
          await team.save();
          attachedExistingCount++;
          console.log(`Attached existing ChatGroup for Team: ${team.teamName} (${team.teamCode})`);
          continue;
        }

        // Otherwise create new chat group
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          const chatGroup = await createChatGroupForTeam(team._id, { session });
          team.chatGroupId = chatGroup._id;
          await team.save({ session });
          await session.commitTransaction();
          session.endSession();
          createdCount++;
          console.log(`Created new ChatGroup for Team: ${team.teamName} (${team.teamCode})`);
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
