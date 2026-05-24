// src/controllers/weeklyTask.controller.js
const WeeklyTask = require('../models/WeeklyTask');
const Team = require('../models/Team');
const Class = require('../models/Class');
const Student = require('../models/Student');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// ── Role Authorization Helpers ───────────────────────────

const getStudentEntry = async (user) => {
  if (!user) return null;
  return await Student.findOne({
    $or: [
      { userId: user._id },
      { email: user.email.toLowerCase() }
    ]
  });
};

const canManageCourseTemplate = (user) => {
  return user && user.role.toUpperCase() === 'ADMIN';
};

const canManageClassTask = async (user, classId) => {
  const role = user.role.toUpperCase();
  if (role === 'ADMIN') return true;
  if (role === 'LECTURER') {
    const cls = await Class.findById(classId);
    return cls && cls.lectureId && cls.lectureId.toString() === user._id.toString();
  }
  return false;
};

const canManageTeamTask = async (user, teamId) => {
  const role = user.role.toUpperCase();

  if (role === 'ADMIN') return true;

  const team = await Team.findById(teamId);
  if (!team) return false;

  if (role === 'LECTURER') {
    const cls = await Class.findById(team.classId);
    return cls && cls.lectureId?.toString() === user._id.toString();
  }

  if (role === 'MENTOR') {
    if (team.mentorId?.toString() === user._id.toString()) return true;
    const cls = await Class.findById(team.classId);
    return cls?.mentorIds?.some(id => id.toString() === user._id.toString());
  }

  if (role === 'STUDENT' || role === 'USER') {
    const student = await getStudentEntry(user);
    return !!(
      student &&
      student.teamId &&
      student.teamId.toString() === team._id.toString()
    );
  }

  return false;
};

const normalizeDateOnly = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const computeTaskStatus = (task, today) => {
  const baseStatus =
    task.status === 'DONE'
      ? 'COMPLETED'
      : (task.status || 'TODO');

  const due = task.dueDate
    ? normalizeDateOnly(task.dueDate)
    : null;

  return (
    due &&
    due < today &&
    baseStatus !== 'COMPLETED'
  )
    ? 'OVERDUE'
    : baseStatus;
};

const validateTaskDates = ({ startDate, dueDate }, existingTask = null) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = startDate ? normalizeDateOnly(startDate) : null;
  const due = dueDate ? normalizeDateOnly(dueDate) : null;

  const existingStart = existingTask?.startDate ? normalizeDateOnly(existingTask.startDate) : null;
  const existingDue = existingTask?.dueDate ? normalizeDateOnly(existingTask.dueDate) : null;

  const isStartChanged = start && (!existingStart || start.getTime() !== existingStart.getTime());
  const isDueChanged = due && (!existingDue || due.getTime() !== existingDue.getTime());

  if (start && isStartChanged && start < today) {
    return 'Start date cannot be in the past.';
  }

  if (due && isDueChanged && due < today) {
    return 'Due date cannot be in the past.';
  }

  if (start && due && due < start) {
    return 'Due date must be on or after start date.';
  }

  return null;
};

// ── GET /api/weekly-tasks ────────────────────────────────

const getWeeklyTasks = async (req, res) => {
  try {
    const { courseCode, weekNumber, classId, teamId, status, assigneeStudentId } = req.query;

    if (!courseCode || !weekNumber) {
      return errorResponse(res, 'courseCode and weekNumber are required.', 400);
    }

    const weekNum = parseInt(weekNumber, 10);
    if (isNaN(weekNum) || weekNum < 1 || weekNum > 10) {
      return errorResponse(res, 'weekNumber must be between 1 and 10.', 400);
    }

    // 1. Fetch Course Templates (always unfiltered by assignee/status)
    const courseTasks = await WeeklyTask.find({
      taskType: 'COURSE_TEMPLATE',
      courseCode: courseCode.toUpperCase(),
      weekNumber: weekNum,
    })
      .populate('createdBy', 'name email')
      .sort({ createdAt: 1 });

    // 2. Fetch Class Tasks (always unfiltered by assignee/status)
    let classTasks = [];
    if (classId) {
      classTasks = await WeeklyTask.find({
        taskType: 'CLASS_TASK',
        classId,
        weekNumber: weekNum,
      })
        .populate('createdBy', 'name email')
        .sort({ createdAt: 1 });
    }

    // 3. Fetch Team Tasks (supports optional status + assigneeStudentId filters)
    let teamTasks = [];
    if (teamId) {
      const teamQuery = {
        taskType: 'TEAM_TASK',
        teamId,
        weekNumber: weekNum,
      };

      if (assigneeStudentId) {
        teamQuery.assigneeStudentId = assigneeStudentId;
      }

      const rawTeamTasks = await WeeklyTask.find(teamQuery)
        .populate('assigneeStudentId', 'fullName rollNumber email')
        .populate('createdBy', 'name email')
        .sort({ createdAt: 1 });

      const today = normalizeDateOnly(new Date());

      teamTasks = rawTeamTasks.map(task => {
        const obj = task.toObject();
        const computedStatus = computeTaskStatus(obj, today);
        return {
          ...obj,
          computedStatus
        };
      });

      if (status) {
        const normalizedStatus = status.toUpperCase();
        const allowedStatuses = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'OVERDUE'];

        if (!allowedStatuses.includes(normalizedStatus)) {
          return errorResponse(
            res,
            'Invalid status. Allowed values: TODO, IN_PROGRESS, REVIEW, COMPLETED, OVERDUE.',
            400
          );
        }

        teamTasks = teamTasks.filter(
          task => task.computedStatus === normalizedStatus
        );
      }
    }

    return successResponse(res, {
      courseTasks,
      classTasks,
      teamTasks,
    });
  } catch (err) {
    console.error('getWeeklyTasks error:', err);
    return errorResponse(res, 'Server error.', 500);
  }
};

// ── GET /api/weekly-tasks/team/:teamId/board ────────────────

const getTeamTaskBoard = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { weekNumber, assigneeStudentId, priority, status, search } = req.query;

    const allowed = await canManageTeamTask(req.user, teamId);
    if (!allowed) {
      return errorResponse(res, 'Only team members, mentors, lecturers, or admins can manage Team Tasks.', 403);
    }

    const query = {
      taskType: 'TEAM_TASK',
      teamId,
    };

    if (weekNumber) {
      const weekNum = parseInt(weekNumber, 10);
      if (isNaN(weekNum) || weekNum < 1 || weekNum > 10) {
        return errorResponse(res, 'weekNumber must be between 1 and 10.', 400);
      }
      query.weekNumber = weekNum;
    }
    if (assigneeStudentId) query.assigneeStudentId = assigneeStudentId;
    
    const allowedPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (priority) {
      const normalizedPriority = priority.toUpperCase();
      if (!allowedPriorities.includes(normalizedPriority)) {
        return errorResponse(res, 'Invalid priority filter.', 400);
      }
      query.priority = normalizedPriority;
    }

    const allowedStatuses = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'OVERDUE'];
    let normalizedStatusFilter = null;
    if (status) {
      normalizedStatusFilter = status.toUpperCase();
      if (!allowedStatuses.includes(normalizedStatusFilter)) {
        return errorResponse(res, 'Invalid status filter.', 400);
      }
    }
    if (search) {
      query.title = { $regex: search, $options: 'i' };
    }

    const tasks = await WeeklyTask.find(query)
      .populate('assigneeStudentId', 'fullName rollNumber email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    const today = normalizeDateOnly(new Date());

    const mappedTasks = tasks.map(task => {
      const taskObj = task.toObject();
      const computedStatus = computeTaskStatus(taskObj, today);
      
      return {
        ...taskObj,
        computedStatus
      };
    });

    let filteredTasks = mappedTasks;
    if (normalizedStatusFilter) {
      filteredTasks = mappedTasks.filter(task => task.computedStatus === normalizedStatusFilter);
    }

    const grouped = {
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      COMPLETED: [],
      OVERDUE: [],
    };

    const summary = {
      total: filteredTasks.length,
      todo: 0,
      inProgress: 0,
      review: 0,
      completed: 0,
      overdue: 0,
      completionPercentage: 0,
    };

    let totalProgress = 0;

    filteredTasks.forEach((task) => {
      const st = task.computedStatus;
      if (grouped[st]) {
        grouped[st].push(task);
      } else {
        grouped.TODO.push(task);
      }
      
      if (st === 'TODO') summary.todo++;
      else if (st === 'IN_PROGRESS') summary.inProgress++;
      else if (st === 'REVIEW') summary.review++;
      else if (st === 'COMPLETED') summary.completed++;
      else if (st === 'OVERDUE') summary.overdue++;

      totalProgress += task.completionPercentage || 0;
    });

    if (filteredTasks.length > 0) {
      summary.completionPercentage = Math.round(totalProgress / filteredTasks.length);
    }

    return successResponse(res, { tasks: filteredTasks, grouped, summary });
  } catch (err) {
    console.error('getTeamTaskBoard error:', err);
    return errorResponse(res, 'Server error.', 500);
  }
};

// ── POST /api/weekly-tasks ───────────────────────────────

const createWeeklyTask = async (req, res) => {
  try {
    const {
      title,
      description,
      taskType,
      weekNumber,
      courseCode,
      classId,
      teamId,
      assigneeStudentId,
      priority,
      startDate,
      dueDate,
      checklist,
      tags,
      estimatedHours,
    } = req.body;

    if (!title) return errorResponse(res, 'Task title is required.', 400);
    if (!taskType) return errorResponse(res, 'Task type is required.', 400);
    if (!weekNumber) return errorResponse(res, 'Week number is required.', 400);

    const allowedPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    let resolvedPriority = 'MEDIUM';
    if (priority) {
      resolvedPriority = priority.toUpperCase();
      if (!allowedPriorities.includes(resolvedPriority)) {
        return errorResponse(res, 'Invalid priority.', 400);
      }
    }

    const dateError = validateTaskDates({ startDate, dueDate });
    if (dateError) return errorResponse(res, dateError, 400);

    const weekNum = parseInt(weekNumber, 10);
    if (isNaN(weekNum) || weekNum < 1 || weekNum > 10) {
      return errorResponse(res, 'Week number must be between 1 and 10.', 400);
    }

    // Strict Role Validations
    if (taskType === 'COURSE_TEMPLATE') {
      if (!canManageCourseTemplate(req.user)) {
        return errorResponse(res, 'Only Admin or Course Manager can create Course Templates.', 403);
      }
    } else if (taskType === 'CLASS_TASK') {
      if (!classId) return errorResponse(res, 'ClassId is required for class tasks.', 400);
      const allowed = await canManageClassTask(req.user, classId);
      if (!allowed) {
        return errorResponse(res, 'Only Admin or the Class Lecturer can create Class Tasks.', 403);
      }
    } else if (taskType === 'TEAM_TASK') {
      if (!teamId) return errorResponse(res, 'TeamId is required for team tasks.', 400);
      const allowed = await canManageTeamTask(req.user, teamId);
      if (!allowed) {
        return errorResponse(res, 'Only team members, mentors, lecturers, or admins can manage Team Tasks.', 403);
      }
    } else {
      return errorResponse(res, 'Invalid task type.', 400);
    }

    // Course Code Resolution (No Fallbacks)
    let resolvedCourseCode = courseCode ? courseCode.toUpperCase() : null;

    if (taskType === 'COURSE_TEMPLATE') {
      if (!resolvedCourseCode) {
        return errorResponse(res, 'courseCode is required for COURSE_TEMPLATE.', 400);
      }
    } else if (taskType === 'CLASS_TASK') {
      if (!classId) return errorResponse(res, 'ClassId is required for class tasks.', 400);
      const cls = await Class.findById(classId);
      if (!cls || !cls.subjectCode) {
        return errorResponse(res, 'Could not infer courseCode for this class.', 400);
      }
      resolvedCourseCode = cls.subjectCode.toUpperCase();
    } else if (taskType === 'TEAM_TASK') {
      if (!teamId) return errorResponse(res, 'TeamId is required for team tasks.', 400);
      const team = await Team.findById(teamId);
      if (!team || !team.classId) {
        return errorResponse(res, 'Could not infer courseCode: Team or Class reference not found.', 400);
      }
      const cls = await Class.findById(team.classId);
      if (!cls || !cls.subjectCode) {
        return errorResponse(res, 'Could not infer courseCode for the team\'s class.', 400);
      }
      resolvedCourseCode = cls.subjectCode.toUpperCase();
    }

    // Set Scope based on TaskType
    let scope = 'COURSE';
    if (taskType === 'CLASS_TASK') scope = 'CLASS';
    if (taskType === 'TEAM_TASK') scope = 'TEAM';

    const task = await WeeklyTask.create({
      title,
      description: description || '',
      taskType,
      scope,
      weekNumber: weekNum,
      courseCode: resolvedCourseCode,
      classId: taskType === 'COURSE_TEMPLATE' ? null : classId,
      teamId: taskType === 'TEAM_TASK' ? teamId : null,
      assigneeStudentId: taskType === 'TEAM_TASK' ? (assigneeStudentId || null) : null,
      createdBy: req.user._id,
      priority: resolvedPriority,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      checklist: checklist || [],
      tags: tags || [],
      estimatedHours: estimatedHours || 0,
      isTemplate: taskType === 'COURSE_TEMPLATE',
    });

    await task.populate('assigneeStudentId', 'fullName rollNumber email');
    await task.populate('createdBy', 'name email');

    return successResponse(res, { task }, 'Weekly task created successfully!', 201);
  } catch (err) {
    console.error('createWeeklyTask error:', err);
    return errorResponse(res, 'Server error.', 500);
  }
};

// ── PUT /api/weekly-tasks/:id ────────────────────────────

const updateWeeklyTask = async (req, res) => {
  try {
    const task = await WeeklyTask.findById(req.params.id);
    if (!task) return errorResponse(res, 'Weekly task not found.', 404);

    // Permission validations
    if (task.taskType === 'COURSE_TEMPLATE') {
      if (!canManageCourseTemplate(req.user)) {
        return errorResponse(res, 'Only Admin or Course Manager can update Course Templates.', 403);
      }
    } else if (task.taskType === 'CLASS_TASK') {
      const allowed = await canManageClassTask(req.user, task.classId);
      if (!allowed) {
        return errorResponse(res, 'Only Admin or the Class Lecturer can update Class Tasks.', 403);
      }
    } else if (task.taskType === 'TEAM_TASK') {
      const allowed = await canManageTeamTask(req.user, task.teamId);
      if (!allowed) {
        return errorResponse(res, 'Only team members, mentors, lecturers, or admins can manage Team Tasks.', 403);
      }

      const role = req.user.role.toUpperCase();
      if (role === 'STUDENT' || role === 'USER') {
        if (task.createdBy.toString() !== req.user._id.toString()) {
          return errorResponse(
            res,
            'You can only edit TEAM_TASK created by yourself.',
            403
          );
        }
      }
    }

    const {
      title,
      description,
      weekNumber,
      priority,
      startDate,
      dueDate,
      checklist,
      tags,
      estimatedHours,
      status,
      assigneeStudentId,
    } = req.body;

    const dateError = validateTaskDates({ startDate, dueDate }, task);
    if (dateError) return errorResponse(res, dateError, 400);

    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (weekNumber !== undefined) {
      const weekNum = parseInt(weekNumber, 10);
      if (!isNaN(weekNum) && weekNum >= 1 && weekNum <= 10) {
        task.weekNumber = weekNum;
      }
    }
    if (priority !== undefined) {
      const allowedPriorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      const normalizedPriority = priority.toUpperCase();
      if (!allowedPriorities.includes(normalizedPriority)) {
        return errorResponse(res, 'Invalid priority.', 400);
      }
      task.priority = normalizedPriority;
    }
    if (startDate !== undefined) task.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    if (checklist !== undefined) task.checklist = checklist;
    if (tags !== undefined) task.tags = tags;
    if (estimatedHours !== undefined) task.estimatedHours = estimatedHours;
    if (status !== undefined) {
      const allowedStatuses = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'OVERDUE'];
      const normalizedStatus = status.toUpperCase();
      if (!allowedStatuses.includes(normalizedStatus)) {
        return errorResponse(res, 'Invalid status.', 400);
      }
      task.status = normalizedStatus;
    }
    if (assigneeStudentId !== undefined && task.taskType === 'TEAM_TASK') {
      task.assigneeStudentId = assigneeStudentId || null;
    }

    await task.save();

    await task.populate('assigneeStudentId', 'fullName rollNumber email');
    await task.populate('createdBy', 'name email');

    return successResponse(res, { task }, 'Weekly task updated successfully!');
  } catch (err) {
    console.error('updateWeeklyTask error:', err);
    return errorResponse(res, 'Server error.', 500);
  }
};

// ── DELETE /api/weekly-tasks/:id ─────────────────────────

const deleteWeeklyTask = async (req, res) => {
  try {
    const task = await WeeklyTask.findById(req.params.id);
    if (!task) return errorResponse(res, 'Weekly task not found.', 404);

    // Permission validations
    if (task.taskType === 'COURSE_TEMPLATE') {
      if (!canManageCourseTemplate(req.user)) {
        return errorResponse(res, 'Only Admin or Course Manager can delete Course Templates.', 403);
      }
    } else if (task.taskType === 'CLASS_TASK') {
      const allowed = await canManageClassTask(req.user, task.classId);
      if (!allowed) {
        return errorResponse(res, 'Only Admin or the Class Lecturer can delete Class Tasks.', 403);
      }
    } else if (task.taskType === 'TEAM_TASK') {
      const allowed = await canManageTeamTask(req.user, task.teamId);
      if (!allowed) {
        return errorResponse(res, 'Only team members, mentors, lecturers, or admins can manage Team Tasks.', 403);
      }
      
      const role = req.user.role.toUpperCase();
      if (role === 'STUDENT' || role === 'USER') {
        if (task.createdBy.toString() !== req.user._id.toString()) {
          return errorResponse(
            res,
            'You can only delete TEAM_TASK created by yourself.',
            403
          );
        }
      }
    }

    await WeeklyTask.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Weekly task deleted successfully!');
  } catch (err) {
    console.error('deleteWeeklyTask error:', err);
    return errorResponse(res, 'Server error.', 500);
  }
};

// ── PATCH /api/weekly-tasks/:id/status ───────────────────

const updateWeeklyTaskStatus = async (req, res) => {
  try {
    const task = await WeeklyTask.findById(req.params.id);
    if (!task) return errorResponse(res, 'Weekly task not found.', 404);

    const { status, checklist } = req.body;

    // Strict Protection: Students cannot update COURSE_TEMPLATE or CLASS_TASK
    if (task.taskType === 'COURSE_TEMPLATE' || task.taskType === 'CLASS_TASK') {
      // Must be Admin or Class Lecturer
      let allowed = false;
      if (task.taskType === 'COURSE_TEMPLATE') {
        allowed = canManageCourseTemplate(req.user);
      } else {
        allowed = await canManageClassTask(req.user, task.classId);
      }

      if (!allowed) {
        return errorResponse(res, 'Students are not allowed to modify course or class roadmap requirements.', 403);
      }
    }

    // For TEAM_TASK status updates:
    if (task.taskType === 'TEAM_TASK') {
      const allowed = await canManageTeamTask(req.user, task.teamId);
      if (!allowed) {
        return errorResponse(
          res,
          'Only team members, mentors, lecturers, or admins can manage Team Tasks.',
          403
        );
      }
    }

    // Apply status and checklist updates
    if (status !== undefined) {
      const allowedStatuses = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'OVERDUE'];
      const normalized = status.toUpperCase();

      if (!allowedStatuses.includes(normalized)) {
        return errorResponse(
          res,
          'Invalid status.',
          400
        );
      }
      task.status = normalized;
    }
    if (checklist !== undefined) task.checklist = checklist;

    await task.save(); // Model's pre-save hook handles checklist & completion percentage

    await task.populate('assigneeStudentId', 'fullName rollNumber email');
    await task.populate('createdBy', 'name email');

    return successResponse(res, { task }, 'Task status and checklist updated successfully!');
  } catch (err) {
    console.error('updateWeeklyTaskStatus error:', err);
    return errorResponse(res, 'Server error.', 500);
  }
};

module.exports = {
  getWeeklyTasks,
  getTeamTaskBoard,
  createWeeklyTask,
  updateWeeklyTask,
  deleteWeeklyTask,
  updateWeeklyTaskStatus,
};
