// src/controllers/mentoring.controller.js
const MentoringSession = require('../models/MentoringSession');
const Team = require('../models/Team');
const workspacePerm = require('../utils/workspacePermission');
const workspaceAccess = require('../services/workspaceAccess.service');
const { successResponse, errorResponse } = require('../utils/apiResponse');
const notificationService = require('../services/notification.service');
const emailService = require('../services/email.service');
const User = require('../models/User');
const Student = require('../models/Student');


// POST /api/mentoring-sessions
const createSession = async (req, res) => {
  try {
    const { teamId, title, description, meetingDate, startTime, endTime, location, meetingLink, notes, actionItems, status, attendance } = req.body;
    
    // Validation - required fields
    if (!teamId) {
      return errorResponse(res, 'Team ID is required.', 400);
    }
    if (!title || title.trim() === '') {
      return errorResponse(res, 'Session title is required.', 400);
    }
    if (!meetingDate) {
      return errorResponse(res, 'Meeting date is required.', 400);
    }

    // Validation - date format
    const parsedDate = new Date(meetingDate);
    if (isNaN(parsedDate.getTime())) {
      return errorResponse(res, 'Invalid meeting date format.', 400);
    }

    // Validation - time range
    if (startTime && endTime) {
      if (startTime >= endTime) {
        return errorResponse(res, 'Start time must be before end time.', 400);
      }
    }

    // Role check: Student/User cannot create sessions
    if (req.user.role === 'STUDENT' || req.user.role === 'USER') {
      return errorResponse(res, 'You do not have permission to create mentoring sessions. Only lecturers and mentors can create sessions.', 403);
    }

    await workspaceAccess.assertCanMutateWorkspace(req.user, teamId);

    // Check team exists
    const team = await Team.findById(teamId);
    if (!team) {
      return errorResponse(res, 'Team not found.', 404);
    }

    // Permission check: Lecturer can create for their class teams
    // Mentor can create for teams they mentor
    // Admin can create for any team
    if (req.user.role !== 'ADMIN') {
      const Class = require('../models/Class');
      const cls = await Class.findById(team.classId);
      
      let hasPermission = false;
      
      if (req.user.role === 'LECTURER' || req.user.role === 'LECTURE') {
        // Lecturer can create for their class teams
        if (cls && cls.lectureId && cls.lectureId.toString() === req.user._id.toString()) {
          hasPermission = true;
        } else if (team.lectureId && team.lectureId.toString() === req.user._id.toString()) {
          hasPermission = true;
        }
      } else if (req.user.role === 'MENTOR') {
        // Mentor can create for teams they mentor
        if (team.mentorId && team.mentorId.toString() === req.user._id.toString()) {
          hasPermission = true;
        }
        // Or if they're assigned as mentor in the class
        if (cls && cls.mentorIds && cls.mentorIds.some(id => id.toString() === req.user._id.toString())) {
          hasPermission = true;
        }
      }
      
      if (!hasPermission) {
        return errorResponse(res, 'You do not have permission to create sessions for this team. You must be the team mentor/lecturer or an admin.', 403);
      }
    }

    // Conflict check: same day, same team or lecturer, overlapping times
    const dayStart = new Date(parsedDate);
    dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(parsedDate);
    dayEnd.setHours(23,59,59,999);

    if (startTime && endTime) {
      const existing = await MentoringSession.find({
        meetingDate: { $gte: dayStart, $lte: dayEnd },
        status: { $ne: 'CANCELLED' },
        $or: [ { teamId }, { lecturerId: req.user._id } ]
      });

      const toMinutes = (t) => {
        const parts = String(t || '').split(':');
        if (parts.length < 2) return null;
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      };

      const newStart = toMinutes(startTime);
      const newEnd = toMinutes(endTime);

      for (const ex of existing) {
        const exStart = toMinutes(ex.startTime);
        const exEnd = toMinutes(ex.endTime);
        if (exStart !== null && exEnd !== null && newStart !== null && newEnd !== null) {
          if (newStart < exEnd && exStart < newEnd) {
            return errorResponse(res, 'Schedule conflict with another session for the same team or lecturer.', 409);
          }
        }
      }
    }

    // Create session
    const session = await MentoringSession.create({
      teamId,
      classId: team.classId || null,
      lecturerId: req.user._id,
      createdBy: req.user._id,
      title: title.trim(),
      description: description ? description.trim() : '',
      meetingDate: parsedDate,
      startTime: startTime ? startTime.trim() : '',
      endTime: endTime ? endTime.trim() : '',
      location: location ? location.trim() : '',
      meetingLink: meetingLink ? meetingLink.trim() : '',
      notes: notes ? notes.trim() : '',
      actionItems: Array.isArray(actionItems) ? actionItems : [],
      status: ['SCHEDULED', 'COMPLETED', 'CANCELLED'].includes(status) ? status : 'SCHEDULED',
      attendance: Array.isArray(attendance) ? attendance : []
    });

    await session.populate([
      { path: 'lecturerId', select: 'name email avatar role' },
      { path: 'teamId', select: 'teamName teamCode' },
      { path: 'classId', select: 'className' }
    ]);

    // Dispatch notifications (in background) if enabled
    if (process.env.NOTIFICATIONS_ENABLED === 'true') {
      (async () => {
      try {
        // recipients: team members (students), lecturer, admins
        const recipients = [];

        // team members
        if (team && Array.isArray(team.members) && team.members.length > 0) {
          const studentIds = team.members.map(m => m.studentId).filter(Boolean);
          const students = await Student.find({ _id: { $in: studentIds } });
          students.forEach(s => {
            recipients.push({ id: s.userId || null, email: s.email });
          });
        }

        // lecturer
        if (session.lecturerId && session.lecturerId.email) {
          recipients.push({ id: session.lecturerId._id, email: session.lecturerId.email });
        }

        // admins
        const admins = await User.find({ role: 'ADMIN' });
        admins.forEach(a => recipients.push({ id: a._id, email: a.email }));

        // dedupe by email
        const map = new Map();
        for (const r of recipients) if (r.email) map.set(r.email.toLowerCase(), r);
        const finalRecipients = Array.from(map.values());

        if (finalRecipients.length > 0) {
          await notificationService.createBulkNotifications(finalRecipients, {
            type: 'MENTORING',
            title: `New mentoring session: ${session.title}`,
            message: `${session.title} scheduled on ${new Date(session.meetingDate).toLocaleString()}`,
            link: `/mentoring/${session._id}`,
            data: { sessionId: session._id },
            createdBy: req.user._id,
          });

          // send emails asynchronously (best-effort)
          for (const r of finalRecipients) {
            emailService.sendWorkshopNotificationEmail({ to: r.email, workshop: {
              title: session.title,
              startDate: session.meetingDate,
              startTime: session.startTime || '',
              endTime: session.endTime || '',
              meetingLink: session.meetingLink || '',
              location: session.location || '',
              description: session.description || '',
              type: 'SESSION'
            }, recipientName: '' }).catch(err => console.error('Email send failed:', err));
          }
        }
      } catch (err) {
        console.error('Failed to dispatch mentoring notifications:', err);
      }
      })();
    }

    return successResponse(res, { session }, 'Mentoring session created successfully!', 201);
  } catch (err) {
    console.error('createSession error:', err);
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    if (err.statusCode === 404) return errorResponse(res, err.message, 404);
    if (err.statusCode === 400) return errorResponse(res, err.message, 400);
    return errorResponse(res, 'Failed to create session: ' + err.message, 500);
  }
};

// GET /api/mentoring-sessions/team/:teamId
const getSessionsByTeam = async (req, res) => {
  try {
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, req.params.teamId);

    const sessions = await MentoringSession.find({ teamId: req.params.teamId })
      .populate('lecturerId', 'name email avatar role')
      .populate('createdBy', 'name email avatar role')
      .sort({ meetingDate: -1, startTime: -1 });

    return successResponse(res, { sessions });
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error.', 500);
  }
};

// GET /api/mentoring-sessions/lecturer (sessions của tôi)
const getMyLecturerSessions = async (req, res) => {
  try {
    const sessions = await MentoringSession.find({ lecturerId: req.user._id })
      .populate('teamId', 'teamName teamCode classId')
      .sort({ meetingDate: -1, startTime: -1 });
    return successResponse(res, { sessions });
  } catch (err) {
    return errorResponse(res, 'Server error.', 500);
  }
};

// PUT /api/mentoring-sessions/:id
const updateSession = async (req, res) => {
  const { title, description, meetingDate, startTime, endTime, location, meetingLink, notes, actionItems, status, attendance } = req.body;
  
  try {
    const session = await MentoringSession.findById(req.params.id);
    if (!session) return errorResponse(res, 'Session not found.', 404);
    await workspaceAccess.assertCanMutateWorkspace(req.user, session.teamId);

    // Permission check: Only creator, assigned lecturer/mentor, or admin can update
    const isOwner = session.lecturerId.toString() === req.user._id.toString() || 
                    (session.createdBy && session.createdBy.toString() === req.user._id.toString());
    
    if (!isOwner && req.user.role !== 'ADMIN') {
      return errorResponse(res, 'You do not have permission to update this session. Only the session creator or admin can modify it.', 403);
    }

    // Validation: date format
    if (meetingDate) {
      const parsedDate = new Date(meetingDate);
      if (isNaN(parsedDate.getTime())) {
        return errorResponse(res, 'Invalid meeting date format.', 400);
      }
    }

    // Validation: time range
    const newStartTime = startTime !== undefined ? startTime : session.startTime;
    const newEndTime = endTime !== undefined ? endTime : session.endTime;
    if (newStartTime && newEndTime && newStartTime >= newEndTime) {
      return errorResponse(res, 'Start time must be before end time.', 400);
    }

    // Conflict check: same day, same team or lecturer, overlapping times (exclude this session)
    const targetDate = meetingDate ? new Date(meetingDate) : session.meetingDate;
    const dayStart = new Date(targetDate);
    dayStart.setHours(0,0,0,0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23,59,59,999);

    const toMinutes = (t) => {
      const parts = String(t || '').split(':');
      if (parts.length < 2) return null;
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };

    const checkStart = (newStartTime !== undefined ? newStartTime : session.startTime);
    const checkEnd = (newEndTime !== undefined ? newEndTime : session.endTime);

    if (checkStart && checkEnd) {
      const existing = await MentoringSession.find({
        _id: { $ne: session._id },
        meetingDate: { $gte: dayStart, $lte: dayEnd },
        status: { $ne: 'CANCELLED' },
        $or: [ { teamId: session.teamId }, { lecturerId: req.user._id } ]
      });

      const newStart = toMinutes(checkStart);
      const newEnd = toMinutes(checkEnd);
      for (const ex of existing) {
        const exStart = toMinutes(ex.startTime);
        const exEnd = toMinutes(ex.endTime);
        if (exStart !== null && exEnd !== null && newStart !== null && newEnd !== null) {
          if (newStart < exEnd && exStart < newEnd) {
            return errorResponse(res, 'Schedule conflict with another session for the same team or lecturer.', 409);
          }
        }
      }
    }

    // Validation: status enum
    if (status && !['SCHEDULED', 'COMPLETED', 'CANCELLED'].includes(status)) {
      return errorResponse(res, 'Invalid status. Must be one of: SCHEDULED, COMPLETED, CANCELLED.', 400);
    }

    // Validation: title if provided
    if (title !== undefined && (!title || title.trim() === '')) {
      return errorResponse(res, 'Session title cannot be empty.', 400);
    }

    // Update fields
    if (title !== undefined) session.title = title.trim();
    if (description !== undefined) session.description = description.trim();
    if (meetingDate) session.meetingDate = new Date(meetingDate);
    if (startTime !== undefined) session.startTime = startTime.trim();
    if (endTime !== undefined) session.endTime = endTime.trim();
    if (location !== undefined) session.location = location.trim();
    if (meetingLink !== undefined) session.meetingLink = meetingLink.trim();
    if (notes !== undefined) session.notes = notes.trim();
    if (actionItems !== undefined && Array.isArray(actionItems)) session.actionItems = actionItems;
    if (status !== undefined) session.status = status;
    if (attendance !== undefined && Array.isArray(attendance)) session.attendance = attendance;

    await session.save();
    await session.populate([
      { path: 'lecturerId', select: 'name email avatar role' },
      { path: 'teamId', select: 'teamName teamCode' }
    ]);

    // Dispatch notifications (in background) for update (if enabled)
    if (process.env.NOTIFICATIONS_ENABLED === 'true') {
      (async () => {
      try {
        const recipients = [];
        const team = await Team.findById(session.teamId);
        if (team && Array.isArray(team.members) && team.members.length > 0) {
          const studentIds = team.members.map(m => m.studentId).filter(Boolean);
          const students = await Student.find({ _id: { $in: studentIds } });
          students.forEach(s => recipients.push({ id: s.userId || null, email: s.email }));
        }
        if (session.lecturerId && session.lecturerId.email) recipients.push({ id: session.lecturerId._id, email: session.lecturerId.email });
        const admins = await User.find({ role: 'ADMIN' });
        admins.forEach(a => recipients.push({ id: a._id, email: a.email }));
        const map = new Map(); for (const r of recipients) if (r.email) map.set(r.email.toLowerCase(), r);
        const finalRecipients = Array.from(map.values());
        if (finalRecipients.length > 0) {
          await notificationService.createBulkNotifications(finalRecipients, {
            type: 'MENTORING',
            title: `Updated mentoring session: ${session.title}`,
            message: `${session.title} has been updated. Scheduled on ${new Date(session.meetingDate).toLocaleString()}`,
            link: `/mentoring/${session._id}`,
            data: { sessionId: session._id },
            createdBy: req.user._id,
          });
          for (const r of finalRecipients) {
            emailService.sendWorkshopNotificationEmail({ to: r.email, workshop: {
              title: session.title,
              startDate: session.meetingDate,
              startTime: session.startTime || '',
              endTime: session.endTime || '',
              meetingLink: session.meetingLink || '',
              location: session.location || '',
              description: session.description || '',
              type: 'SESSION'
            }, recipientName: '' }).catch(err => console.error('Email send failed:', err));
          }
        }
      } catch (err) {
        console.error('Failed to dispatch mentoring update notifications:', err);
      }
      })();
    }

    return successResponse(res, { session }, 'Session updated successfully!');
  } catch (err) {
    console.error('updateSession error:', err);
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    if (err.statusCode === 404) return errorResponse(res, err.message, 404);
    return errorResponse(res, 'Failed to update session: ' + err.message, 500);
  }
};

const getAllSessions = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'LECTURER' || req.user.role === 'LECTURE') {
      query.lecturerId = req.user._id;
    } else if (req.user.role === 'MENTOR') {
      const Class = require('../models/Class');
      const mentoredClasses = await Class.find({ mentorIds: req.user._id });
      const classIds = mentoredClasses.map(c => c._id);
      const mentoredTeams = await Team.find({ classId: { $in: classIds } });
      const teamIds = mentoredTeams.map(t => t._id);
      
      // MENTOR can see sessions they created or are assigned to their teams
      query.$or = [
        { lecturerId: req.user._id },
        { teamId: { $in: teamIds } }
      ];
    } else if (req.user.role === 'STUDENT') {
      // Students should only see sessions for their own team
      const Student = require('../models/Student');
      const student = await Student.findOne({ userId: req.user._id });
      if (!student || !student.teamId) {
        return successResponse(res, { sessions: [] });
      }
      query.teamId = student.teamId;
    }
    const sessions = await MentoringSession.find(query)
      .populate('lecturerId', 'name email avatar role')
      .populate('teamId', 'teamName teamCode')
      .sort({ meetingDate: -1, startTime: -1 });

    return successResponse(res, { sessions });
  } catch (err) {
    console.error('getAllSessions error:', err);
    return errorResponse(res, 'Server error.', 500);
  }
};

// PATCH /api/mentoring-sessions/:id/cancel
const cancelSession = async (req, res) => {
  try {
    const session = await MentoringSession.findById(req.params.id);
    if (!session) return errorResponse(res, 'Session not found.', 404);
    await workspaceAccess.assertCanMutateWorkspace(req.user, session.teamId);

    if (session.status === 'CANCELLED') {
      return errorResponse(res, 'This session is already cancelled.', 400);
    }

    // Permission check
    const isOwner = session.lecturerId.toString() === req.user._id.toString() || 
                    (session.createdBy && session.createdBy.toString() === req.user._id.toString());

    if (!isOwner && req.user.role !== 'ADMIN') {
      return errorResponse(res, 'You do not have permission to cancel this session. Only the session creator or admin can do this.', 403);
    }

    session.status = 'CANCELLED';
    await session.save();
    await session.populate('lecturerId', 'name email avatar role');

    // Dispatch notifications (in background) for cancel (if enabled)
    if (process.env.NOTIFICATIONS_ENABLED === 'true') {
      (async () => {
      try {
        const recipients = [];
        const team = await Team.findById(session.teamId);
        if (team && Array.isArray(team.members) && team.members.length > 0) {
          const studentIds = team.members.map(m => m.studentId).filter(Boolean);
          const students = await Student.find({ _id: { $in: studentIds } });
          students.forEach(s => recipients.push({ id: s.userId || null, email: s.email }));
        }
        if (session.lecturerId && session.lecturerId.email) recipients.push({ id: session.lecturerId._id, email: session.lecturerId.email });
        const admins = await User.find({ role: 'ADMIN' });
        admins.forEach(a => recipients.push({ id: a._id, email: a.email }));
        const map = new Map(); for (const r of recipients) if (r.email) map.set(r.email.toLowerCase(), r);
        const finalRecipients = Array.from(map.values());
        if (finalRecipients.length > 0) {
          await notificationService.createBulkNotifications(finalRecipients, {
            type: 'MENTORING',
            title: `Cancelled mentoring session: ${session.title}`,
            message: `${session.title} scheduled on ${new Date(session.meetingDate).toLocaleString()} has been cancelled.`,
            link: `/mentoring/${session._id}`,
            data: { sessionId: session._id },
            createdBy: req.user._id,
          });
          for (const r of finalRecipients) {
            emailService.sendWorkshopNotificationEmail({ to: r.email, workshop: {
              title: session.title,
              startDate: session.meetingDate,
              startTime: session.startTime || '',
              endTime: session.endTime || '',
              meetingLink: session.meetingLink || '',
              location: session.location || '',
              description: session.description || '',
              type: 'SESSION'
            }, recipientName: '' }).catch(err => console.error('Email send failed:', err));
          }
        }
      } catch (err) {
        console.error('Failed to dispatch mentoring cancel notifications:', err);
      }
      })();
    }

    return successResponse(res, { session }, 'Session cancelled successfully!');
  } catch (err) {
    console.error('cancelSession error:', err);
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Failed to cancel session: ' + err.message, 500);
  }
};

// DELETE /api/mentoring-sessions/:id (hard delete - admin only)
const deleteSession = async (req, res) => {
  try {
    const session = await MentoringSession.findById(req.params.id);
    if (!session) return errorResponse(res, 'Session not found.', 404);
    await workspaceAccess.assertCanMutateWorkspace(req.user, session.teamId);

    // Admin only for hard delete
    if (req.user.role !== 'ADMIN') {
      return errorResponse(res, 'Only admins can permanently delete sessions.', 403);
    }

    await MentoringSession.findByIdAndDelete(req.params.id);
    return successResponse(res, null, 'Session permanently deleted!');
  } catch (err) {
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Server error.', 500);
  }
};

// GET /api/mentoring-sessions/past (lịch sử mentoring đã diễn ra)
const getPastSessions = async (req, res) => {
  try {
    let query = {
      status: 'COMPLETED',
      meetingDate: { $lt: new Date() }
    };

    if (req.user.role === 'LECTURER' || req.user.role === 'LECTURE') {
      query.lecturerId = req.user._id;
    } else if (req.user.role === 'MENTOR') {
      const Class = require('../models/Class');
      const mentoredClasses = await Class.find({ mentorIds: req.user._id });
      const classIds = mentoredClasses.map(c => c._id);
      const mentoredTeams = await Team.find({ classId: { $in: classIds } });
      const teamIds = mentoredTeams.map(t => t._id);
      query.$or = [
        { lecturerId: req.user._id },
        { teamId: { $in: teamIds } }
      ];
    }

    const sessions = await MentoringSession.find(query)
      .populate('lecturerId', 'name email avatar role')
      .populate('teamId', 'teamName teamCode')
      .sort({ meetingDate: -1 });

    return successResponse(res, { sessions });
  } catch (err) {
    return errorResponse(res, 'Server error.', 500);
  }
};

// POST /api/mentoring-sessions/:id/notes (thêm/cập nhật notes)
const addSessionNote = async (req, res) => {
  const { notes } = req.body;
  
  if (!notes || notes.trim() === '') {
    return errorResponse(res, 'Notes content is required.', 400);
  }

  if (notes.length > 5000) {
    return errorResponse(res, 'Notes cannot exceed 5000 characters.', 400);
  }

  try {
    const session = await MentoringSession.findById(req.params.id);
    if (!session) return errorResponse(res, 'Session not found.', 404);
    await workspaceAccess.assertCanMutateWorkspace(req.user, session.teamId);

    // Disallow notes on cancelled sessions
    if (session.status === 'CANCELLED') {
      return errorResponse(res, 'Cannot add notes to a cancelled session.', 400);
    }

    // Permission check: Only creator, assigned lecturer/mentor, or admin can add notes
    const isOwner = session.lecturerId.toString() === req.user._id.toString() || 
                    (session.createdBy && session.createdBy.toString() === req.user._id.toString());

    if (!isOwner && req.user.role !== 'ADMIN') {
      return errorResponse(res, 'You do not have permission to add notes to this session. Only the session creator or admin can do this.', 403);
    }

    session.notes = notes.trim();
    await session.save();
    await session.populate('lecturerId', 'name email avatar role');

    return successResponse(res, { session }, 'Session notes updated successfully!');
  } catch (err) {
    console.error('addSessionNote error:', err);
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Failed to save notes: ' + err.message, 500);
  }
};

// POST /api/mentoring-sessions/:id/action-items (thêm action item)
const addActionItem = async (req, res) => {
  const { content, assigneeId, dueDate } = req.body;
  
  if (!content || content.trim() === '') {
    return errorResponse(res, 'Action item content is required.', 400);
  }

  if (content.length > 1000) {
    return errorResponse(res, 'Action item content cannot exceed 1000 characters.', 400);
  }

  try {
    const session = await MentoringSession.findById(req.params.id);
    if (!session) return errorResponse(res, 'Session not found.', 404);
    await workspaceAccess.assertCanMutateWorkspace(req.user, session.teamId);

    // Permission check
    const isOwner = session.lecturerId.toString() === req.user._id.toString() || 
                    (session.createdBy && session.createdBy.toString() === req.user._id.toString());

    if (!isOwner && req.user.role !== 'ADMIN' && req.user.role !== 'MENTOR' && req.user.role !== 'LECTURER') {
      return errorResponse(res, 'You do not have permission to add action items to this session.', 403);
    }

    // Validate dueDate if provided
    let validDueDate = null;
    if (dueDate) {
      const parsedDate = new Date(dueDate);
      if (isNaN(parsedDate.getTime())) {
        return errorResponse(res, 'Invalid due date format.', 400);
      }
      validDueDate = parsedDate;
    }

    const newActionItem = {
      content: content.trim(),
      assigneeId: assigneeId || null,
      dueDate: validDueDate,
      completed: false
    };

    session.actionItems.push(newActionItem);
    await session.save();
    await session.populate('actionItems.assigneeId', 'name email');

    return successResponse(res, { session }, 'Action item added successfully!', 201);
  } catch (err) {
    console.error('addActionItem error:', err);
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Failed to add action item: ' + err.message, 500);
  }
};

// PATCH /api/mentoring-sessions/:id/action-items/:itemId (cập nhật action item)
const updateActionItem = async (req, res) => {
  const { itemId } = req.params;
  const { content, completed, assigneeId, dueDate } = req.body;

  try {
    const session = await MentoringSession.findById(req.params.id);
    if (!session) return errorResponse(res, 'Session not found.', 404);
    await workspaceAccess.assertCanMutateWorkspace(req.user, session.teamId);

    const actionItem = session.actionItems.id(itemId);
    if (!actionItem) return errorResponse(res, 'Action item not found.', 404);

    // Permission check
    const isOwner = session.lecturerId.toString() === req.user._id.toString() || 
                    (session.createdBy && session.createdBy.toString() === req.user._id.toString());

    if (!isOwner && req.user.role !== 'ADMIN' && req.user.role !== 'MENTOR' && req.user.role !== 'LECTURER') {
      return errorResponse(res, 'You do not have permission to update action items for this session.', 403);
    }

    // Validation: content
    if (content !== undefined) {
      if (!content || content.trim() === '') {
        return errorResponse(res, 'Action item content cannot be empty.', 400);
      }
      if (content.length > 1000) {
        return errorResponse(res, 'Action item content cannot exceed 1000 characters.', 400);
      }
      actionItem.content = content.trim();
    }

    // Validation: dueDate
    if (dueDate !== undefined) {
      if (dueDate) {
        const parsedDate = new Date(dueDate);
        if (isNaN(parsedDate.getTime())) {
          return errorResponse(res, 'Invalid due date format.', 400);
        }
        actionItem.dueDate = parsedDate;
      } else {
        actionItem.dueDate = null;
      }
    }

    // Update other fields
    if (completed !== undefined) actionItem.completed = Boolean(completed);
    if (assigneeId !== undefined) actionItem.assigneeId = assigneeId || null;

    await session.save();
    await session.populate('actionItems.assigneeId', 'name email');

    return successResponse(res, { session }, 'Action item updated successfully!');
  } catch (err) {
    console.error('updateActionItem error:', err);
    if (err.statusCode === 403) return errorResponse(res, err.message, 403);
    return errorResponse(res, 'Failed to update action item: ' + err.message, 500);
  }
};

module.exports = {
  createSession,
  getSessionsByTeam,
  getMyLecturerSessions,
  updateSession,
  getAllSessions,
  cancelSession,
  deleteSession,
  getPastSessions,
  addSessionNote,
  addActionItem,
  updateActionItem
};
