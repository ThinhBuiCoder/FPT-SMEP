// src/services/notification.service.js
const Notification = require('../models/Notification');
const User = require('../models/User');
const Student = require('../models/Student');
const Team = require('../models/Team');
const Class = require('../models/Class');
const Workshop = require('../models/Workshop');
const emailService = require('./email.service');

/**
 * Create a single in-app notification.
 */
const createNotification = async (payload) => {
  return await Notification.create(payload);
};

/**
 * Bulk create in-app notifications.
 * @param {Array} recipients Array of { id, email }
 * @param {Object} payload Base notification data
 */
const createBulkNotifications = async (recipients, payload) => {
  if (!Array.isArray(recipients) || recipients.length === 0) return [];

  const notifications = recipients.map(r => ({
    recipientId: r.id || null,
    recipientEmail: r.email,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    link: payload.link || null,
    data: payload.data || {},
    createdBy: payload.createdBy || null,
  }));

  return await Notification.insertMany(notifications);
};

/**
 * Get notifications for a user.
 */
const getUserNotifications = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return [];

  return await Notification.find({
    $or: [
      { recipientId: userId },
      { recipientEmail: user.email.toLowerCase() }
    ]
  }).sort({ createdAt: -1 }).limit(100);
};

/**
 * Mark a single notification as read.
 */
const markAsRead = async (notificationId, userId) => {
  const user = await User.findById(userId);
  const email = user ? user.email.toLowerCase() : '';

  return await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      $or: [
        { recipientId: userId },
        { recipientEmail: email }
      ]
    },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
};

/**
 * Mark all user notifications as read.
 */
const markAllAsRead = async (userId) => {
  const user = await User.findById(userId);
  const email = user ? user.email.toLowerCase() : '';

  return await Notification.updateMany(
    {
      $or: [
        { recipientId: userId },
        { recipientEmail: email }
      ],
      isRead: false
    },
    { isRead: true, readAt: new Date() }
  );
};

/**
 * Get unread notification count.
 */
const getUnreadCount = async (userId) => {
  const user = await User.findById(userId);
  const email = user ? user.email.toLowerCase() : '';

  return await Notification.countDocuments({
    $or: [
      { recipientId: userId },
      { recipientEmail: email }
    ],
    isRead: false
  });
};

/**
 * Notify target audience about a new workshop/seminar.
 */
const notifyWorkshopCreated = async (workshopId) => {
  try {
    const ws = await Workshop.findById(workshopId).populate('createdBy', 'name');
    if (!ws || ws.status !== 'PUBLISHED') return;

    let recipients = []; // Array of { id: user._id, email, name }

    if (ws.targetAudience === 'ALL_STUDENTS') {
      const students = await Student.find();
      recipients = students.map(s => ({
        id: s.userId,
        email: s.email,
        name: s.fullName
      }));
    } else if (ws.targetAudience === 'CLASS' && ws.classId) {
      const students = await Student.find({ classId: ws.classId });
      recipients = students.map(s => ({
        id: s.userId,
        email: s.email,
        name: s.fullName
      }));
    } else if (ws.targetAudience === 'TEAM' && ws.teamIds && ws.teamIds.length > 0) {
      const teams = await Team.find({ _id: { $in: ws.teamIds } });
      const studentIds = teams.flatMap(t => t.members.map(m => m.studentId));
      const students = await Student.find({ _id: { $in: studentIds } });
      recipients = students.map(s => ({
        id: s.userId,
        email: s.email,
        name: s.fullName
      }));
    } else if (ws.targetAudience === 'LECTURER') {
      // Find class lecturer or all lecturers
      if (ws.classId) {
        const cls = await Class.findById(ws.classId).populate('lectureId');
        if (cls?.lectureId) {
          recipients.push({
            id: cls.lectureId._id,
            email: cls.lectureId.email,
            name: cls.lectureId.name
          });
        }
      } else {
        const lecturers = await User.find({ role: 'LECTURER' });
        recipients = lecturers.map(l => ({
          id: l._id,
          email: l.email,
          name: l.name
        }));
      }
    } else if (ws.targetAudience === 'MENTOR') {
      if (ws.classId) {
        const cls = await Class.findById(ws.classId).populate('mentorIds');
        if (cls?.mentorIds) {
          recipients = cls.mentorIds.map(m => ({
            id: m._id,
            email: m.email,
            name: m.name
          }));
        }
      } else {
        const mentors = await User.find({ role: 'MENTOR' });
        recipients = mentors.map(m => ({
          id: m._id,
          email: m.email,
          name: m.name
        }));
      }
    }

    // Deduplicate recipients by email
    const uniqueMap = new Map();
    for (const r of recipients) {
      if (r.email) {
        uniqueMap.set(r.email.toLowerCase(), r);
      }
    }
    const finalRecipients = Array.from(uniqueMap.values());

    if (finalRecipients.length === 0) return;

    // Send in-app notifications
    const typeLabel = ws.type === 'SEMINAR' ? 'SEMINAR' : 'WORKSHOP';
    await createBulkNotifications(finalRecipients, {
      type: typeLabel,
      title: `New ${ws.type}: ${ws.title}`,
      message: `A new ${ws.type.toLowerCase()} has been announced: "${ws.title}". Scheduled on ${new Date(ws.startDate).toLocaleDateString()} at ${ws.startTime}.`,
      link: `/workshops`,
      data: { workshopId: ws._id },
      createdBy: ws.createdBy?._id || ws.createdBy,
    });

    // Send emails
    for (const r of finalRecipients) {
      // Async background call to avoid blocking
      emailService.sendWorkshopNotificationEmail({
        to: r.email,
        workshop: ws,
        recipientName: r.name
      }).catch(err => console.error(`Error sending email to ${r.email}:`, err.message));
    }

  } catch (err) {
    console.error('Failed to dispatch workshop notifications:', err);
  }
};

module.exports = {
  createNotification,
  createBulkNotifications,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  notifyWorkshopCreated,
};
