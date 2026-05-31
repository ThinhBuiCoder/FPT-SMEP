// backend/src/utils/workspacePermission.js
const Student = require("../models/Student");
const Team = require("../models/Team");
const Class = require("../models/Class");
const workspaceAccess = require("../services/workspaceAccess.service");

const semesterRank = { SP: 1, SU: 2, FA: 3 };

const getUserIdentityFilter = (user) => {
  const or = [];
  if (user?._id) or.push({ userId: user._id });
  if (user?.email) or.push({ email: String(user.email).toLowerCase().trim() });
  return or.length ? { $or: or } : null;
};

const sortStudentsByClassRecency = (students) => {
  return [...students].sort((a, b) => {
    const classA = a.classId || {};
    const classB = b.classId || {};
    const yearDiff = Number(classB.year || 0) - Number(classA.year || 0);
    if (yearDiff) return yearDiff;
    return (semesterRank[classB.semester] || 0) - (semesterRank[classA.semester] || 0);
  });
};

exports.getStudentsByUser = async (user) => {
  const identityFilter = getUserIdentityFilter(user);
  if (!identityFilter) return [];

  return Student.find(identityFilter)
    .populate("classId", "classCode subjectCode semester year status")
    .sort({ updatedAt: -1 });
};

exports.getCurrentStudentByUser = async (user) => {
  const students = await exports.getStudentsByUser(user);
  return sortStudentsByClassRecency(students.filter((student) => student.classId?.status !== "disabled"))[0] || null;
};

exports.getCurrentStudentWorkspaceContext = async (user) => {
  const students = sortStudentsByClassRecency(
    (await exports.getStudentsByUser(user)).filter((student) => student.classId?.status !== "disabled")
  );
  if (!students.length) return { student: null, team: null, reason: "NO_CLASS" };

  const currentStudent = students[0];
  if (!currentStudent.teamId) {
    return { student: currentStudent, team: null, reason: "NO_TEAM_IN_CURRENT_CLASS" };
  }

  const team = await Team.findOne({
    _id: currentStudent.teamId,
    classId: currentStudent.classId?._id || currentStudent.classId,
  });

  if (!team) {
    return { student: currentStudent, team: null, reason: "STALE_TEAM_CACHE" };
  }

  return { student: currentStudent, team, reason: null };
};

exports.getStudentForTeam = async (user, team) => {
  const identityFilter = getUserIdentityFilter(user);
  if (!identityFilter || !team?._id || !team?.classId) return null;

  const memberStudentIds = (team.members || []).map((member) => member.studentId).filter(Boolean);
  return Student.findOne({
    ...identityFilter,
    classId: team.classId,
    $or: [
      { teamId: team._id },
      { _id: { $in: memberStudentIds } },
    ],
  });
};

exports.canAccessTeamWorkspace = async (user, teamId) => {
  const { accessMode } = await workspaceAccess.resolveWorkspaceAccess(user, teamId);
  return accessMode !== workspaceAccess.ACCESS.DENIED;
};

exports.canEditTeamWorkspace = async (user, teamId) => {
  return workspaceAccess.canMutateWorkspace(user, teamId);
};

exports.assertCanAccessTeamWorkspace = async (user, teamId) => {
  const hasAccess = await exports.canAccessTeamWorkspace(user, teamId);
  if (!hasAccess) {
    const error = new Error("You do not have permission to view this team workspace.");
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
