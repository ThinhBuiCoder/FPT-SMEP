const Team = require('../models/Team');
const Class = require('../models/Class');
const Student = require('../models/Student');
const StartupLineage = require('../models/StartupLineage');

const ACCESS = {
  FULL: 'FULL',
  STUDENT: 'STUDENT',
  READ_ONLY: 'READ_ONLY',
  DENIED: 'DENIED',
};

const roleOf = (user) => String(user?.role || '').toUpperCase();

const identityFilter = (user) => {
  const or = [];
  if (user?._id) or.push({ userId: user._id });
  if (user?.email) or.push({ email: String(user.email).toLowerCase().trim() });
  return or.length ? { $or: or } : null;
};

const semesterText = (cls) => `${cls?.semester || ''}${cls?.year || ''}`;

const loadTeam = (teamId) =>
  Team.findById(teamId)
    .populate('classId', 'classCode subjectCode semester year lectureId mentorIds')
    .populate('mentorId', 'name email avatar role')
    .populate('lectureId', 'name email avatar role');

const getLineageTeamIds = async (team) => {
  if (!team?.lineageId) return [team._id];
  const lineage = await StartupLineage.findById(team.lineageId).select('teamIds currentTeamId');
  return lineage?.teamIds?.length ? lineage.teamIds : [team._id];
};

const getCurrentStudentTeamId = async (user) => {
  const filter = identityFilter(user);
  if (!filter) return null;

  const students = await Student.find({
    ...filter,
    teamId: { $ne: null },
  }).populate('classId', 'semester year status');

  const semesterRank = { SP: 1, SU: 2, FA: 3 };
  const current = students
    .filter((student) => student.classId && student.classId.status !== 'disabled')
    .sort((a, b) => {
      const yearDiff = Number(b.classId.year || 0) - Number(a.classId.year || 0);
      if (yearDiff) return yearDiff;
      return (semesterRank[b.classId.semester] || 0) - (semesterRank[a.classId.semester] || 0);
    })[0];

  return current?.teamId || null;
};

const personKeysOf = (student) => [
  student?.rollNumber ? `roll:${String(student.rollNumber).trim().toLowerCase()}` : null,
  student?.email ? `email:${String(student.email).trim().toLowerCase()}` : null,
].filter(Boolean);

const loadTeamStudents = async (team) => {
  if (!team?._id) return [];
  const memberStudentIds = (team.members || []).map((member) => member.studentId).filter(Boolean);
  return Student.find({
    $or: [
      { teamId: team._id },
      { _id: { $in: memberStudentIds } },
    ],
  }).select('rollNumber email teamId classId');
};

const findOverlappingTeams = async (team, minOverlap = 2) => {
  const sourceStudents = await loadTeamStudents(team);
  const sourceKeys = [...new Set(sourceStudents.flatMap(personKeysOf))];
  if (!sourceKeys.length) return [];

  const relatedStudents = await Student.find({
    teamId: { $ne: null, $nin: [team._id] },
    $or: [
      { rollNumber: { $in: sourceStudents.map((student) => student.rollNumber).filter(Boolean) } },
      { email: { $in: sourceStudents.map((student) => student.email).filter(Boolean) } },
    ],
  }).select('rollNumber email teamId');

  const overlapByTeam = new Map();
  relatedStudents.forEach((student) => {
    const teamId = String(student.teamId);
    const matchedKeys = personKeysOf(student).filter((key) => sourceKeys.includes(key));
    if (!matchedKeys.length) return;
    if (!overlapByTeam.has(teamId)) overlapByTeam.set(teamId, new Set());
    matchedKeys.forEach((key) => overlapByTeam.get(teamId).add(key));
  });

  const relatedTeamIds = [...overlapByTeam.entries()]
    .filter(([, keys]) => keys.size >= minOverlap)
    .map(([teamId]) => teamId);

  if (!relatedTeamIds.length) return [];

  return Team.find({ _id: { $in: relatedTeamIds } })
    .populate('classId', 'classCode subjectCode semester year lectureId mentorIds status')
    .populate('mentorId', 'name email avatar role')
    .populate('lectureId', 'name email avatar role')
    .sort({ createdAt: 1 });
};

const studentBelongsToTeam = async (user, team) => {
  const filter = identityFilter(user);
  if (!filter || !team?._id) return false;
  const memberStudentIds = (team.members || []).map((member) => member.studentId).filter(Boolean);
  const found = await Student.exists({
    $and: [
      filter,
      { classId: team.classId?._id || team.classId },
      {
        $or: [
          { teamId: team._id },
          { _id: { $in: memberStudentIds } },
        ],
      },
    ],
  });
  return Boolean(found);
};

const userOwnsTeamAsLecturer = (user, team) => {
  const userId = String(user?._id || '');
  const cls = team?.classId || {};
  return String(team?.lectureId?._id || team?.lectureId || '') === userId
    || String(cls?.lectureId || '') === userId;
};

const userOwnsTeamAsMentor = (user, team) => {
  const userId = String(user?._id || '');
  const cls = team?.classId || {};
  return String(team?.mentorId?._id || team?.mentorId || '') === userId
    || (cls?.mentorIds || []).some((id) => String(id) === userId);
};

const userBelongsToLineage = async (user, teamIds) => {
  const role = roleOf(user);
  const teams = await Team.find({ _id: { $in: teamIds } })
    .populate('classId', 'lectureId mentorIds')
    .select('classId lectureId mentorId members isArchived');

  if (role === 'LECTURER' || role === 'LECTURE') {
    return teams.some((team) => userOwnsTeamAsLecturer(user, team));
  }

  if (role === 'MENTOR') {
    return teams.some((team) => userOwnsTeamAsMentor(user, team));
  }

  if (role === 'STUDENT' || role === 'USER') {
    for (const team of teams) {
      // eslint-disable-next-line no-await-in-loop
      if (await studentBelongsToTeam(user, team)) return true;
    }
  }

  return false;
};

const userOwnsInferredContinuityTeam = async (user, team) => {
  const role = roleOf(user);
  if (!['LECTURER', 'LECTURE', 'MENTOR'].includes(role)) return false;

  const relatedTeams = await findOverlappingTeams(team);
  return relatedTeams.some((relatedTeam) => (
    role === 'MENTOR'
      ? userOwnsTeamAsMentor(user, relatedTeam)
      : userOwnsTeamAsLecturer(user, relatedTeam)
  ));
};

const resolveWorkspaceAccess = async (user, teamId) => {
  const role = roleOf(user);
  const team = await loadTeam(teamId);
  if (!team) return { accessMode: ACCESS.DENIED, team: null };

  if (role === 'ADMIN') return { accessMode: ACCESS.FULL, team };

  if ((role === 'LECTURER' || role === 'LECTURE') && userOwnsTeamAsLecturer(user, team)) {
    return { accessMode: ACCESS.FULL, team };
  }

  if (role === 'MENTOR' && userOwnsTeamAsMentor(user, team)) {
    return { accessMode: ACCESS.FULL, team };
  }

  if ((role === 'STUDENT' || role === 'USER') && await studentBelongsToTeam(user, team)) {
    const currentTeamId = await getCurrentStudentTeamId(user);
    const isCurrentTeam = currentTeamId && String(currentTeamId) === String(team._id);
    return { accessMode: team.isArchived || !isCurrentTeam ? ACCESS.READ_ONLY : ACCESS.STUDENT, team };
  }

  const lineageTeamIds = await getLineageTeamIds(team);
  if (team.lineageId && await userBelongsToLineage(user, lineageTeamIds)) {
    return { accessMode: ACCESS.READ_ONLY, team };
  }

  if (await userOwnsInferredContinuityTeam(user, team)) {
    return { accessMode: ACCESS.READ_ONLY, team };
  }

  return { accessMode: ACCESS.DENIED, team };
};

const formatWorkspace = (team, accessMode) => {
  const cls = team.classId || {};
  return {
    teamId: team._id,
    classId: cls._id || team.classId,
    lineageId: team.lineageId,
    teamName: team.teamName,
    startupName: team.projectName || team.teamName,
    courseCode: team.courseCode || cls.subjectCode || '',
    semester: team.semester || semesterText(cls),
    classCode: cls.classCode || '',
    lecturerName: team.lectureId?.name || '',
    mentorNames: team.mentorId?.name ? [team.mentorId.name] : [],
    isArchived: Boolean(team.isArchived),
    status: team.isArchived ? 'Archived' : 'Current',
    accessMode,
  };
};

const getAccessibleWorkspaces = async (user, lineageId) => {
  const lineage = await StartupLineage.findById(lineageId).select('teamIds currentTeamId');
  if (!lineage) return [];

  const teams = await Team.find({ _id: { $in: lineage.teamIds } })
    .populate('classId', 'classCode subjectCode semester year lectureId mentorIds')
    .populate('mentorId', 'name email avatar role')
    .populate('lectureId', 'name email avatar role')
    .sort({ createdAt: 1 });

  const rows = [];
  for (const team of teams) {
    // eslint-disable-next-line no-await-in-loop
    const { accessMode } = await resolveWorkspaceAccess(user, team._id);
    if (accessMode !== ACCESS.DENIED) rows.push(formatWorkspace(team, accessMode));
  }
  return rows;
};

const getStudentDirectWorkspaces = async (user) => {
  const filter = identityFilter(user);
  if (!filter) return [];

  const role = roleOf(user);
  if (role !== 'STUDENT' && role !== 'USER') return [];

  const students = await Student.find({
    ...filter,
    teamId: { $ne: null },
  })
    .populate('classId', 'classCode subjectCode semester year lectureId mentorIds status')
    .sort({ createdAt: 1 });

  const teamIds = [...new Set(students.map((student) => String(student.teamId)).filter(Boolean))];
  if (!teamIds.length) return [];

  const teams = await Team.find({ _id: { $in: teamIds } })
    .populate('classId', 'classCode subjectCode semester year lectureId mentorIds status')
    .populate('mentorId', 'name email avatar role')
    .populate('lectureId', 'name email avatar role')
    .sort({ createdAt: 1 });

  const rows = [];
  for (const team of teams) {
    // eslint-disable-next-line no-await-in-loop
    const { accessMode } = await resolveWorkspaceAccess(user, team._id);
    if (accessMode !== ACCESS.DENIED) {
      rows.push(formatWorkspace(team, accessMode));
    }
  }
  return rows;
};

const getInferredContinuityWorkspaces = async (user, team) => {
  const relatedTeams = await findOverlappingTeams(team);
  const rows = [];

  for (const relatedTeam of relatedTeams) {
    // eslint-disable-next-line no-await-in-loop
    const { accessMode } = await resolveWorkspaceAccess(user, relatedTeam._id);
    if (accessMode !== ACCESS.DENIED) {
      rows.push(formatWorkspace(relatedTeam, accessMode));
    }
  }

  return rows;
};

const canMutateWorkspace = async (user, teamId) => {
  const { accessMode } = await resolveWorkspaceAccess(user, teamId);
  return [ACCESS.FULL, ACCESS.STUDENT].includes(accessMode);
};

const assertCanMutateWorkspace = async (user, teamId) => {
  const allowed = await canMutateWorkspace(user, teamId);
  if (!allowed) {
    const error = new Error('This workspace is read-only for your role.');
    error.statusCode = 403;
    throw error;
  }
};

const ensureTeamLineage = async (team, userId) => {
  if (team.lineageId) return StartupLineage.findById(team.lineageId);

  const cls = team.classId?._id ? team.classId : await Class.findById(team.classId);
  const lineage = await StartupLineage.create({
    startupName: team.projectName || team.teamName,
    originalTeamId: team._id,
    teamIds: [team._id],
    currentTeamId: team._id,
    createdBy: userId,
  });

  team.lineageId = lineage._id;
  team.courseCode = team.courseCode || cls?.subjectCode || null;
  team.semester = team.semester || semesterText(cls);
  await team.save();
  return lineage;
};

module.exports = {
  ACCESS,
  resolveWorkspaceAccess,
  getAccessibleWorkspaces,
  getStudentDirectWorkspaces,
  getInferredContinuityWorkspaces,
  canMutateWorkspace,
  assertCanMutateWorkspace,
  ensureTeamLineage,
  formatWorkspace,
};
