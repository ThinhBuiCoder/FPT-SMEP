// src/controllers/milestone.controller.js
const Milestone = require('../models/Milestone');
const SprintTask = require('../models/SprintTask');
const Team = require('../models/Team');
const workspacePerm = require('../utils/workspacePermission');
const workspaceAccess = require('../services/workspaceAccess.service');
const { recalculateMilestoneProgress } = require('../services/progress.service');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// GET /api/milestones/team/:teamId
const getMilestonesByTeam = async (req, res) => {
  try {
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, req.params.teamId);

    const now = new Date();
    const milestones = await Milestone.find({ teamId: req.params.teamId })
      .populate('createdBy', 'name email')
      .sort({ dueDate: 1 });

    const result = milestones.map(m => {
      const obj = m.toObject();
      // Normalize legacy status
      if (obj.status === 'TODO') obj.status = 'PLANNED';
      if (obj.status === 'DONE') obj.status = 'COMPLETED';
      // Auto-mark overdue in response
      if (obj.status !== 'COMPLETED' && obj.dueDate && new Date(obj.dueDate) < now) {
        obj.status = 'OVERDUE';
      }
      return obj;
    });

    return successResponse(res, { milestones: result });
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error.', 500);
  }
};

// POST /api/milestones/team/:teamId
const createMilestone = async (req, res) => {
  const { title, description, startDate, dueDate } = req.body;
  const { teamId } = req.params;

  if (!title || !dueDate) return errorResponse(res, 'Missing required fields: title, dueDate.', 400);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  if (due < today) {
    return errorResponse(res, 'Due date cannot be in the past.', 400);
  }

  if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
    return errorResponse(res, 'Start date must be before due date.', 400);
  }

  try {
    await workspacePerm.assertCanEditTeamWorkspace(req.user, teamId);
    await workspaceAccess.assertCanMutateWorkspace(req.user, teamId);

    const team = await Team.findById(teamId);
    if (!team) return errorResponse(res, 'Team not found.', 404);

    const milestone = await Milestone.create({
      teamId,
      classId: team.classId,
      title,
      description: description || '',
      startDate: startDate ? new Date(startDate) : undefined,
      dueDate: new Date(dueDate),
      status: 'PLANNED',
      progress: 0,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    return successResponse(res, { milestone }, 'Milestone created!', 201);
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error.', 500);
  }
};

// PUT /api/milestones/:id
const updateMilestone = async (req, res) => {
  const { title, description, startDate, dueDate, status } = req.body;
  try {
    const m = await Milestone.findById(req.params.id);
    if (!m) return errorResponse(res, 'Milestone not found.', 404);

    await workspacePerm.assertCanEditTeamWorkspace(req.user, m.teamId);
    await workspaceAccess.assertCanMutateWorkspace(req.user, m.teamId);

    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      return errorResponse(res, 'Start date must be before due date.', 400);
    }

    if (title !== undefined) m.title = title;
    if (description !== undefined) m.description = description;
    if (startDate !== undefined) m.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) m.dueDate = new Date(dueDate);
    if (status !== undefined) m.status = status;
    m.updatedBy = req.user._id;

    await m.save();
    return successResponse(res, { milestone: m }, 'Milestone updated!');
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error.', 500);
  }
};

// DELETE /api/milestones/:id
const deleteMilestone = async (req, res) => {
  try {
    const m = await Milestone.findById(req.params.id);
    if (!m) return errorResponse(res, 'Milestone not found.', 404);

    await workspacePerm.assertCanEditTeamWorkspace(req.user, m.teamId);
    await workspaceAccess.assertCanMutateWorkspace(req.user, m.teamId);

    // Block delete if milestone has tasks
    const taskCount = await SprintTask.countDocuments({ milestoneId: m._id });
    if (taskCount > 0) {
      return errorResponse(res, `Cannot delete milestone: it has ${taskCount} task(s). Remove tasks first.`, 400);
    }

    await Milestone.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Milestone deleted!');
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error.', 500);
  }
};

module.exports = { createMilestone, getMilestonesByTeam, updateMilestone, deleteMilestone };
