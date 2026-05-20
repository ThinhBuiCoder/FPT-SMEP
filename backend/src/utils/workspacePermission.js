// backend/src/utils/workspacePermission.js
const Student = require("../models/Student");
const Team = require("../models/Team");
const Class = require("../models/Class");

exports.getCurrentStudentByUser = async (user) => {
  if (!user) return null;
  return await Student.findOne({
    $or: [
      { userId: user._id },
      { email: user.email.toLowerCase() }
    ]
  });
};

exports.canAccessTeamWorkspace = async (user, teamId) => {
  const role = user.role.toUpperCase();
  if (role === "ADMIN") return true;

  const team = await Team.findById(teamId);
  if (!team) return false;

  if (role === "STUDENT" || role === "USER") {
    const student = await exports.getCurrentStudentByUser(user);
    return student && student.teamId && student.teamId.toString() === teamId.toString();
  }

  if (role === "LECTURER" || role === "LECTURE") {
    if (team.lectureId && team.lectureId.toString() === user._id.toString()) return true;
    const cls = await Class.findById(team.classId);
    return cls && cls.lectureId && cls.lectureId.toString() === user._id.toString();
  }

  if (role === "MENTOR") {
    if (team.mentorId && team.mentorId.toString() === user._id.toString()) return true;
    const cls = await Class.findById(team.classId);
    return cls && cls.mentorIds && cls.mentorIds.some(id => id.toString() === user._id.toString());
  }

  return false;
};

exports.canEditTeamWorkspace = async (user, teamId) => {
  const role = user.role.toUpperCase();
  if (role === "ADMIN") return true;
  if (role === "STUDENT" || role === "USER") {
    const student = await exports.getCurrentStudentByUser(user);
    return student && student.teamId && student.teamId.toString() === teamId.toString();
  }
  return false;
};

exports.assertCanAccessTeamWorkspace = async (user, teamId) => {
  const hasAccess = await exports.canAccessTeamWorkspace(user, teamId);
  if (!hasAccess) {
    const error = new Error("Access Denied: You do not have permission to access this workspace.");
    error.statusCode = 403;
    throw error;
  }
};

exports.assertCanEditTeamWorkspace = async (user, teamId) => {
  const canEdit = await exports.canEditTeamWorkspace(user, teamId);
  if (!canEdit) {
    const error = new Error("Access Denied: Only student team members or admins can modify this workspace.");
    error.statusCode = 403;
    throw error;
  }
};
