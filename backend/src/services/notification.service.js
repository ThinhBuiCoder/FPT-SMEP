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
 * Uses onlineClassIds / offlineClassIds to determine recipient format.
 */
const notifyWorkshopCreated = async (workshopId) => {
  try {
    const ws = await Workshop.findById(workshopId).populate('createdBy', 'name');
    if (!ws || ws.status !== 'PUBLISHED') return;

    let recipients = []; // Array of { id, email, name, format }

    if (ws.targetAudience === 'ALL_STUDENTS') {
      const students = await Student.find();
      recipients = students.map(s => ({
        id: s.userId,
        email: s.email,
        name: s.fullName,
        format: ws.format
      }));
    } else if (ws.targetAudience === 'CLASS') {
      const onlineIds = (ws.onlineClassIds || []).map(c => c._id ? c._id.toString() : c.toString());
      const offlineIds = (ws.offlineClassIds || []).map(c => c._id ? c._id.toString() : c.toString());
      const allClassIds = [
        ...(ws.onlineClassIds || []).map(c => c._id || c),
        ...(ws.offlineClassIds || []).map(c => c._id || c)
      ];

      if (allClassIds.length === 0) return;

      const students = await Student.find({ classId: { $in: allClassIds } });
      recipients = students.map(s => {
        const cStr = s.classId ? s.classId.toString() : '';
        let fmt = ws.format;
        if (onlineIds.includes(cStr)) fmt = 'ONLINE';
        else if (offlineIds.includes(cStr)) fmt = 'OFFLINE';
        return {
          id: s.userId,
          email: s.email,
          name: s.fullName,
          format: fmt
        };
      });
    } else if (ws.targetAudience === 'TEAM' && ws.teamIds && ws.teamIds.length > 0) {
      const teams = await Team.find({ _id: { $in: ws.teamIds } });
      const studentIds = teams.flatMap(t => t.members.map(m => m.studentId));
      const students = await Student.find({ _id: { $in: studentIds } });
      recipients = students.map(s => ({
        id: s.userId,
        email: s.email,
        name: s.fullName,
        format: ws.format
      }));
    } else if (ws.targetAudience === 'LECTURER') {
      const allClassIds = [...ws.onlineClassIds || [], ...ws.offlineClassIds || []];
      if (allClassIds.length > 0) {
        const clses = await Class.find({ _id: { $in: allClassIds } }).populate('lectureId');
        clses.forEach(cls => {
          if (cls.lectureId) {
            recipients.push({
              id: cls.lectureId._id,
              email: cls.lectureId.email,
              name: cls.lectureId.name,
              format: ws.format
            });
          }
        });
      } else {
        const lecturers = await User.find({ role: 'LECTURER' });
        recipients = lecturers.map(l => ({
          id: l._id,
          email: l.email,
          name: l.name,
          format: ws.format
        }));
      }
    } else if (ws.targetAudience === 'MENTOR') {
      const allClassIds = [...ws.onlineClassIds || [], ...ws.offlineClassIds || []];
      if (allClassIds.length > 0) {
        const clses = await Class.find({ _id: { $in: allClassIds } }).populate('mentorIds');
        clses.forEach(cls => {
          if (cls.mentorIds) {
            cls.mentorIds.forEach(m => {
              recipients.push({
                id: m._id,
                email: m.email,
                name: m.name,
                format: ws.format
              });
            });
          }
        });
      } else {
        const mentors = await User.find({ role: 'MENTOR' });
        recipients = mentors.map(m => ({
          id: m._id,
          email: m.email,
          name: m.name,
          format: ws.format
        }));
      }
    }

    // Deduplicate recipients by email
    const uniqueMap = new Map();
    for (const r of recipients) {
      if (r.email && r.email.trim() !== '') {
        uniqueMap.set(r.email.toLowerCase(), r);
      }
    }
    const finalRecipients = Array.from(uniqueMap.values());

    console.log(`[NotificationService] Found ${finalRecipients.length} unique recipients for workshop ${ws._id}`);

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

    // Send emails (Promise.allSettled for better performance and safety)
    const emailPromises = finalRecipients.map(r => {
      return emailService.sendWorkshopNotificationEmail({
        to: r.email,
        workshop: ws,
        recipientName: r.name,
        format: r.format
      }).catch(err => console.error(`[NotificationService] Error sending email to ${r.email}:`, err.message));
    });

    Promise.allSettled(emailPromises).then(results => {
      const fulfilled = results.filter(r => r.status === 'fulfilled').length;
      console.log(`[NotificationService] Dispatched ${fulfilled}/${finalRecipients.length} emails for workshop ${ws._id}`);
    });

  } catch (err) {
    console.error('[NotificationService] Failed to dispatch workshop notifications:', err);
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
