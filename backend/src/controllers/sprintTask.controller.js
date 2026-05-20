// src/controllers/sprintTask.controller.js
const SprintTask = require('../models/SprintTask');
const Team = require('../models/Team');
const Student = require('../models/Student');
const Milestone = require('../models/Milestone');
const workspacePerm = require('../utils/workspacePermission');
const progressService = require('../services/progress.service');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// ── Helpers ──────────────────────────────────────────────

const isTeamMember = (team, studentId) => {
  if (!team || !team.members) return false;
  return team.members.some(m => m.studentId && m.studentId.toString() === studentId.toString());
};

// ── GET /api/sprint-tasks/team/:teamId ───────────────────

const getTeamTasks = async (req, res) => {
  try {
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, req.params.teamId);

    const filter = { teamId: req.params.teamId };
    if (req.query.milestoneId) filter.milestoneId = req.query.milestoneId;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.assigneeStudentId) filter.assigneeStudentId = req.query.assigneeStudentId;
    if (req.query.priority) filter.priority = req.query.priority;

    const tasks = await SprintTask.find(filter)
      .populate('assigneeId', 'name email avatar')
      .populate('assigneeStudentId', 'fullName rollNumber email')
      .populate('milestoneId', 'title')
      .populate('createdBy', 'name email')
      .sort({ position: 1, createdAt: -1 });

    return successResponse(res, { tasks });
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error.', 500);
  }
};

// ── POST /api/sprint-tasks/team/:teamId ──────────────────

const createTask = async (req, res) => {
  const { teamId } = req.params;
  const { milestoneId, title, description, assigneeStudentId, status, priority, startDate, dueDate } = req.body;

  if (!title) return errorResponse(res, 'Task title is required.', 400);

  if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
    return errorResponse(res, 'Start date must be before due date.', 400);
  }

  try {
    await workspacePerm.assertCanEditTeamWorkspace(req.user, teamId);

    const team = await Team.findById(teamId);
    if (!team) return errorResponse(res, 'Team not found.', 404);

    // Validate milestone belongs to team
    if (milestoneId) {
      const milestone = await Milestone.findById(milestoneId);
      if (!milestone || milestone.teamId.toString() !== teamId) {
        return errorResponse(res, 'Invalid milestone for this team.', 400);
      }
    }

    // Validate assignee is team member
    let assigneeUserId = null;
    if (assigneeStudentId) {
      if (!isTeamMember(team, assigneeStudentId)) {
        return errorResponse(res, 'Assignee must be a member of this team.', 400);
      }
      const student = await Student.findById(assigneeStudentId);
      if (student && student.userId) assigneeUserId = student.userId;
    }

    const task = await SprintTask.create({
      teamId,
      classId: team.classId,
      milestoneId: milestoneId || null,
      title,
      description: description || '',
      assigneeId: assigneeUserId,
      assigneeStudentId: assigneeStudentId || null,
      status: status || 'TODO',
      priority: priority || 'MEDIUM',
      startDate: startDate ? new Date(startDate) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      position: 0,
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    // Recalculate milestone progress
    if (milestoneId) await progressService.recalculateMilestoneProgress(milestoneId);

    await task.populate('assigneeStudentId', 'fullName rollNumber email');
    await task.populate('milestoneId', 'title');

    return successResponse(res, { task }, 'Task created!', 201);
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    console.error('createTask error:', err);
    return errorResponse(res, 'Server error.', 500);
  }
};

// ── GET /api/sprint-tasks/:taskId ────────────────────────

const getTask = async (req, res) => {
  try {
    const task = await SprintTask.findById(req.params.taskId)
      .populate('assigneeId', 'name email avatar')
      .populate('assigneeStudentId', 'fullName rollNumber email')
      .populate('milestoneId', 'title')
      .populate('createdBy', 'name email');

    if (!task) return errorResponse(res, 'Task not found.', 404);

    await workspacePerm.assertCanAccessTeamWorkspace(req.user, task.teamId);
    return successResponse(res, { task });
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error.', 500);
  }
};

// ── PUT /api/sprint-tasks/:taskId ────────────────────────

const updateTask = async (req, res) => {
  const { title, description, milestoneId, assigneeStudentId, status, priority, startDate, dueDate, position } = req.body;

  try {
    const task = await SprintTask.findById(req.params.taskId);
    if (!task) return errorResponse(res, 'Task not found.', 404);

    await workspacePerm.assertCanEditTeamWorkspace(req.user, task.teamId);

    if (startDate && dueDate && new Date(startDate) > new Date(dueDate)) {
      return errorResponse(res, 'Start date must be before due date.', 400);
    }

    const team = await Team.findById(task.teamId);

    // Validate assignee
    if (assigneeStudentId !== undefined) {
      if (assigneeStudentId) {
        if (!isTeamMember(team, assigneeStudentId)) {
          return errorResponse(res, 'Assignee must be a member of this team.', 400);
        }
        const student = await Student.findById(assigneeStudentId);
        task.assigneeStudentId = assigneeStudentId;
        task.assigneeId = student?.userId || null;
      } else {
        task.assigneeStudentId = null;
        task.assigneeId = null;
      }
    }

    // Validate milestone
    if (milestoneId !== undefined) {
      if (milestoneId) {
        const ms = await Milestone.findById(milestoneId);
        if (!ms || ms.teamId.toString() !== task.teamId.toString()) {
          return errorResponse(res, 'Invalid milestone for this team.', 400);
        }
      }
      const oldMilestoneId = task.milestoneId;
      task.milestoneId = milestoneId || null;
      // Recalc old milestone if changed
      if (oldMilestoneId && oldMilestoneId.toString() !== (milestoneId || '')) {
        await progressService.recalculateMilestoneProgress(oldMilestoneId);
      }
    }

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;
    if (priority !== undefined) task.priority = priority;
    if (startDate !== undefined) task.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    if (position !== undefined) task.position = position;
    task.updatedBy = req.user._id;

    await task.save();

    // Recalculate milestone progress
    if (task.milestoneId) await progressService.recalculateMilestoneProgress(task.milestoneId);

    await task.populate('assigneeStudentId', 'fullName rollNumber email');
    await task.populate('milestoneId', 'title');

    return successResponse(res, { task }, 'Task updated!');
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error.', 500);
  }
};

// ── PUT /api/sprint-tasks/:taskId/status (Kanban drag) ───

const updateTaskStatus = async (req, res) => {
  const { status, position } = req.body;

  if (!status || !['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'].includes(status)) {
    return errorResponse(res, 'Invalid status value.', 400);
  }

  try {
    const task = await SprintTask.findById(req.params.taskId);
    if (!task) return errorResponse(res, 'Task not found.', 404);

    await workspacePerm.assertCanEditTeamWorkspace(req.user, task.teamId);

    task.status = status;
    if (position !== undefined) task.position = position;
    task.updatedBy = req.user._id;

    await task.save(); // pre-save hook handles completedAt

    // Recalculate milestone progress
    if (task.milestoneId) await progressService.recalculateMilestoneProgress(task.milestoneId);

    return successResponse(res, { task }, 'Task status updated!');
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error.', 500);
  }
};

// ── DELETE /api/sprint-tasks/:taskId ─────────────────────

const deleteTask = async (req, res) => {
  try {
    const task = await SprintTask.findById(req.params.taskId);
    if (!task) return errorResponse(res, 'Task not found.', 404);

    await workspacePerm.assertCanEditTeamWorkspace(req.user, task.teamId);

    const milestoneId = task.milestoneId;
    await SprintTask.findByIdAndDelete(req.params.taskId);

    // Recalculate milestone progress after removal
    if (milestoneId) await progressService.recalculateMilestoneProgress(milestoneId);

    return successResponse(res, null, 'Task deleted!');
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error.', 500);
  }
};

// ── GET /api/sprint-tasks/team/:teamId/progress ─────────

const getTeamProgress = async (req, res) => {
  try {
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, req.params.teamId);
    const progress = await progressService.getTeamProgress(req.params.teamId);
    return successResponse(res, progress);
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error.', 500);
  }
};

module.exports = {
  getTeamTasks,
  createTask,
  getTask,
  updateTask,
  updateTaskStatus,
  deleteTask,
  getTeamProgress,
};
