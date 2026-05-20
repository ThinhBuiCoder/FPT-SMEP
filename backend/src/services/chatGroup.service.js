// src/services/chatGroup.service.js
// Creates a chat group automatically after a team is formed.
// Must be called inside a Mongoose transaction session.

const ChatGroup = require('../models/ChatGroup');
const Student = require('../models/Student');
const Team = require('../models/Team');
const Class = require('../models/Class');
const User = require('../models/User');

/**
 * Create a chat group for a newly created team.
 *
 * @param {ObjectId} teamId   - The newly created team's _id
 * @param {object}   options  - options.session (Mongoose session), options.createdBy (User who triggered creation)
 * @returns {ChatGroup}
 */
const createChatGroupForTeam = async (teamId, options = {}) => {
  const session = options.session;
  const createdBy = options.createdBy;

  // Load team
  const team = await Team.findById(teamId).session(session);
  if (!team) throw new Error('Team not found');

  // If team.chatGroupId exists, return existing chat group
  if (team.chatGroupId) {
    const existing = await ChatGroup.findById(team.chatGroupId).session(session);
    if (existing) return existing;
  }

  // Check ChatGroup.findOne({ teamId }). If exists, update team.chatGroupId and return it.
  const existingByTeam = await ChatGroup.findOne({ teamId }).session(session);
  if (existingByTeam) {
    team.chatGroupId = existingByTeam._id;
    await team.save({ session });
    return existingByTeam;
  }

  // Load class
  const cls = await Class.findById(team.classId).session(session);
  if (!cls) throw new Error('Class not found');

  // Build member list
  const members = [];
  const addedUserIds = new Set();
  const addedStudentIds = new Set();
  const addedEmails = new Set();

  const addMemberSafely = (userId, studentId, role, email) => {
    if (userId) {
      if (addedUserIds.has(userId.toString())) return;
      addedUserIds.add(userId.toString());
    }
    if (studentId) {
      if (addedStudentIds.has(studentId.toString())) return;
      addedStudentIds.add(studentId.toString());
    }
    if (email) {
      const e = email.toLowerCase().trim();
      if (addedEmails.has(e)) return;
      addedEmails.add(e);
    }
    members.push({ userId, studentId, role });
  };

  // 1. Add lecturer
  const lectId = team.lectureId || cls.lectureId;
  if (lectId) {
    addMemberSafely(lectId, null, 'lecture');
  }

  // 2. Add creator
  if (createdBy) {
    addMemberSafely(createdBy, null, 'admin');
  }

  // 3. Add team mentor or fallback to class mentors
  if (team.mentorId) {
    addMemberSafely(team.mentorId, null, 'mentor');
  } else if (cls.mentorIds && cls.mentorIds.length > 0) {
    for (const mId of cls.mentorIds) {
      addMemberSafely(mId, null, 'mentor');
    }
  }

  // 4. Add team students (handle unlinked or linked user accounts)
  for (const member of team.members) {
    const student = await Student.findById(member.studentId).session(session);
    if (!student) continue;

    let targetUserId = student.userId;

    // Fallback: If not linked, try to find user by email
    if (!targetUserId && student.email) {
      const userObj = await User.findOne({ email: student.email.toLowerCase() }).session(session);
      if (userObj) {
        targetUserId = userObj._id;
        student.userId = userObj._id;
        await student.save({ session }); // Link on-the-fly
      }
    }

    addMemberSafely(targetUserId || null, student._id, 'student', student.email);
  }

  const chatGroup = await ChatGroup.create(
    [{
      teamId,
      classId: team.classId,
      groupName: `${team.teamCode} Chat`,
      createdBy: createdBy || lectId || team.createdBy,
      members,
    }],
    { session }
  );

  return chatGroup[0];
};

/**
 * Create or update the class-wide chat group.
 * It will include the lecturer, and all students currently in the class.
 *
 * @param {ObjectId} classId 
 * @param {object} options - options.session, options.createdBy
 */
const createOrUpdateChatGroupForClass = async (classId, options = {}) => {
  const session = options.session;
  const createdBy = options.createdBy;

  const cls = await Class.findById(classId).session(session);
  if (!cls) throw new Error('Class not found');

  // Find all students in this class
  const students = await Student.find({ classId: cls._id }).session(session);

  // Build member list
  const members = [];
  const addedUserIds = new Set();
  const addedStudentIds = new Set();
  const addedEmails = new Set();

  const addMemberSafely = (userId, studentId, role, email) => {
    if (userId) {
      if (addedUserIds.has(userId.toString())) return;
      addedUserIds.add(userId.toString());
    }
    if (studentId) {
      if (addedStudentIds.has(studentId.toString())) return;
      addedStudentIds.add(studentId.toString());
    }
    if (email) {
      const e = email.toLowerCase().trim();
      if (addedEmails.has(e)) return;
      addedEmails.add(e);
    }
    members.push({ userId, studentId, role });
  };

  // 1. Add Lecturer
  if (cls.lectureId) {
    addMemberSafely(cls.lectureId, null, 'lecture');
  }

  // 2. Add Creator / Admin if provided
  if (createdBy) {
    addMemberSafely(createdBy, null, 'admin');
  }

  // 3. Add Mentors
  if (cls.mentorIds && cls.mentorIds.length > 0) {
    for (const mId of cls.mentorIds) {
      addMemberSafely(mId, null, 'mentor');
    }
  }

  // 4. Add all students of this class
  for (const student of students) {
    let targetUserId = student.userId;

    if (!targetUserId && student.email) {
      const userObj = await User.findOne({ email: student.email.toLowerCase() }).session(session);
      if (userObj) {
        targetUserId = userObj._id;
        student.userId = userObj._id;
        await student.save({ session });
      }
    }

    addMemberSafely(targetUserId || null, student._id, 'student', student.email);
  }

  let chatGroup;
  if (cls.chatGroupId) {
    chatGroup = await ChatGroup.findById(cls.chatGroupId).session(session);
  }

  if (!chatGroup) {
    chatGroup = await ChatGroup.findOne({ teamId: null, classId: cls._id }).session(session);
  }

  if (chatGroup) {
    chatGroup.members = members;
    chatGroup.groupName = `${cls.classCode} General Chat`;
    if (cls.lectureId && !chatGroup.createdBy) {
      chatGroup.createdBy = cls.lectureId;
    }
    await chatGroup.save({ session });
  } else {
    const createdList = await ChatGroup.create(
      [{
        teamId: null,
        classId: cls._id,
        groupName: `${cls.classCode} General Chat`,
        createdBy: createdBy || cls.lectureId || cls._id,
        members,
      }],
      { session }
    );
    chatGroup = createdList[0];
  }

  cls.chatGroupId = chatGroup._id;
  await cls.save({ session });

  return chatGroup;
};

module.exports = { createChatGroupForTeam, createOrUpdateChatGroupForClass };
