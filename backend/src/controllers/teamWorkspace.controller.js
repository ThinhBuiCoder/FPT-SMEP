const Team = require('../models/Team');
const Student = require('../models/Student');
const StartupLineage = require('../models/StartupLineage');
const Shortcut = require('../models/Shortcut');
const workspaceAccess = require('../services/workspaceAccess.service');

const ok = (res, data, message = 'OK') => res.json({ success: true, data, message });
const fail = (res, message, status = 500) => res.status(status).json({ success: false, message });

const getCurrentStudentTeam = async (user) => {
  const students = await Student.find({
    $or: [
      { userId: user._id },
      { email: String(user.email || '').toLowerCase() },
    ],
  }).populate('classId', 'semester year status');

  const semesterRank = { SP: 1, SU: 2, FA: 3 };
  const current = students
    .filter((student) => student.classId && student.classId.status !== 'disabled')
    .sort((a, b) => {
      const yearDiff = Number(b.classId.year || 0) - Number(a.classId.year || 0);
      if (yearDiff) return yearDiff;
      return (semesterRank[b.classId.semester] || 0) - (semesterRank[a.classId.semester] || 0);
    })[0];

  if (!current?.teamId) return null;
  return Team.findOne({ _id: current.teamId, classId: current.classId._id });
};

const buildContext = async (user, teamId) => {
  const access = await workspaceAccess.resolveWorkspaceAccess(user, teamId);
  if (!access.team || access.accessMode === workspaceAccess.ACCESS.DENIED) {
    const error = new Error('You do not have permission to view this team workspace.');
    error.statusCode = 403;
    throw error;
  }

  const lineage = await workspaceAccess.ensureTeamLineage(access.team, user._id);
  const [lineageWorkspaces, directStudentWorkspaces, inferredContinuityWorkspaces] = await Promise.all([
    workspaceAccess.getAccessibleWorkspaces(user, lineage._id),
    workspaceAccess.getStudentDirectWorkspaces(user),
    workspaceAccess.getInferredContinuityWorkspaces(user, access.team),
  ]);
  const workspaceMap = new Map();
  [
    workspaceAccess.formatWorkspace(access.team, access.accessMode),
    ...lineageWorkspaces,
    ...directStudentWorkspaces,
    ...inferredContinuityWorkspaces,
  ].forEach((workspace) => {
    workspaceMap.set(String(workspace.teamId), workspace);
  });
  const availableWorkspaces = [...workspaceMap.values()].sort((a, b) => {
    const aText = `${a.semester || ''}${a.courseCode || ''}`;
    const bText = `${b.semester || ''}${b.courseCode || ''}`;
    return aText.localeCompare(bText);
  });
  return {
    selectedWorkspace: workspaceAccess.formatWorkspace(access.team, access.accessMode),
    availableWorkspaces,
    accessMode: access.accessMode,
  };
};

exports.getCurrentWorkspace = async (req, res) => {
  try {
    const role = String(req.user.role || '').toUpperCase();
    if (role !== 'STUDENT' && role !== 'USER') {
      return fail(res, 'Current workspace requires a teamId for this role.', 400);
    }

    const team = await getCurrentStudentTeam(req.user);
    if (!team) {
      return ok(res, null, 'You have joined this class but have not been assigned to a team yet.');
    }

    return ok(res, await buildContext(req.user, team._id));
  } catch (err) {
    return fail(res, err.message, err.statusCode || 500);
  }
};

exports.getWorkspaceContext = async (req, res) => {
  try {
    return ok(res, await buildContext(req.user, req.params.teamId));
  } catch (err) {
    return fail(res, err.message, err.statusCode || 500);
  }
};

exports.getLineageWorkspaces = async (req, res) => {
  try {
    const availableWorkspaces = await workspaceAccess.getAccessibleWorkspaces(req.user, req.params.lineageId);
    return ok(res, { availableWorkspaces });
  } catch (err) {
    return fail(res, err.message, err.statusCode || 500);
  }
};

exports.linkWorkspaces = async (req, res) => {
  try {
    const { previousTeamId, nextTeamId } = req.body;
    if (!previousTeamId || !nextTeamId) {
      return fail(res, 'previousTeamId and nextTeamId are required.', 400);
    }

    const [previousTeam, nextTeam] = await Promise.all([
      Team.findById(previousTeamId).populate('classId', 'subjectCode semester year'),
      Team.findById(nextTeamId).populate('classId', 'subjectCode semester year'),
    ]);

    if (!previousTeam || !nextTeam) return fail(res, 'Team not found.', 404);

    const previousAccess = await workspaceAccess.resolveWorkspaceAccess(req.user, previousTeamId);
    const nextAccess = await workspaceAccess.resolveWorkspaceAccess(req.user, nextTeamId);
    if (
      req.user.role?.toUpperCase() !== 'ADMIN'
      && (previousAccess.accessMode !== workspaceAccess.ACCESS.FULL || nextAccess.accessMode !== workspaceAccess.ACCESS.FULL)
    ) {
      return fail(res, 'Only admins or lecturers with full access to both teams can link workspaces.', 403);
    }

    const lineage = await workspaceAccess.ensureTeamLineage(previousTeam, req.user._id);
    const nextExistingLineageId = nextTeam.lineageId ? nextTeam.lineageId.toString() : null;
    const shouldMergeNextLineage = nextExistingLineageId && nextExistingLineageId !== lineage._id.toString();
    const nextExistingLineage = shouldMergeNextLineage
      ? await StartupLineage.findById(nextTeam.lineageId).select('teamIds')
      : null;

    const teamIds = new Set(lineage.teamIds.map((id) => id.toString()));
    (nextExistingLineage?.teamIds || []).forEach((id) => teamIds.add(id.toString()));
    teamIds.add(previousTeam._id.toString());
    teamIds.add(nextTeam._id.toString());

    nextTeam.lineageId = lineage._id;
    nextTeam.previousTeamId = previousTeam._id;
    nextTeam.courseCode = nextTeam.courseCode || nextTeam.classId?.subjectCode || null;
    nextTeam.semester = nextTeam.semester || `${nextTeam.classId?.semester || ''}${nextTeam.classId?.year || ''}`;
    nextTeam.isArchived = false;

    previousTeam.nextTeamId = nextTeam._id;
    previousTeam.isArchived = true;
    previousTeam.archivedAt = previousTeam.archivedAt || new Date();
    previousTeam.courseCode = previousTeam.courseCode || previousTeam.classId?.subjectCode || null;
    previousTeam.semester = previousTeam.semester || `${previousTeam.classId?.semester || ''}${previousTeam.classId?.year || ''}`;

    lineage.teamIds = [...teamIds];
    lineage.currentTeamId = nextTeam._id;
    lineage.status = 'ACTIVE';

    const mergedTeamIds = [...teamIds];
    await Promise.all([
      previousTeam.save(),
      nextTeam.save(),
      lineage.save(),
      Team.updateMany({ _id: { $in: mergedTeamIds } }, { lineageId: lineage._id }),
      shouldMergeNextLineage
        ? StartupLineage.findByIdAndUpdate(nextExistingLineageId, {
            status: 'ARCHIVED',
            teamIds: [],
          })
        : Promise.resolve(),
    ]);
    await Shortcut.updateMany(
      { teamId: { $in: mergedTeamIds } },
      { lineageId: lineage._id }
    );
    return ok(res, await buildContext(req.user, nextTeam._id), 'Workspace lineage linked.');
  } catch (err) {
    return fail(res, err.message, err.statusCode || 500);
  }
};

exports.pivotWorkspace = async (req, res) => {
  try {
    const { oldLineageId, newTeamId } = req.body;
    if (!oldLineageId || !newTeamId) return fail(res, 'oldLineageId and newTeamId are required.', 400);

    const role = req.user.role?.toUpperCase();
    if (role !== 'ADMIN' && role !== 'LECTURER') return fail(res, 'Only admins or lecturers can pivot workspaces.', 403);

    await StartupLineage.findByIdAndUpdate(oldLineageId, { status: 'PIVOTED' });
    const newTeam = await Team.findById(newTeamId).populate('classId', 'subjectCode semester year');
    if (!newTeam) return fail(res, 'Team not found.', 404);
    const existingLineageId = newTeam.lineageId ? newTeam.lineageId.toString() : null;

    const lineage = await StartupLineage.create({
      startupName: newTeam.projectName || newTeam.teamName,
      originalTeamId: newTeam._id,
      teamIds: [newTeam._id],
      currentTeamId: newTeam._id,
      status: 'ACTIVE',
      createdBy: req.user._id,
    });

    newTeam.lineageId = lineage._id;
    newTeam.courseCode = newTeam.courseCode || newTeam.classId?.subjectCode || null;
    newTeam.semester = newTeam.semester || `${newTeam.classId?.semester || ''}${newTeam.classId?.year || ''}`;
    await Promise.all([
      newTeam.save(),
      existingLineageId
        ? StartupLineage.findByIdAndUpdate(existingLineageId, {
            status: 'ARCHIVED',
            teamIds: [],
          })
        : Promise.resolve(),
    ]);

    return ok(res, await buildContext(req.user, newTeam._id), 'Workspace pivoted.');
  } catch (err) {
    return fail(res, err.message, err.statusCode || 500);
  }
};
