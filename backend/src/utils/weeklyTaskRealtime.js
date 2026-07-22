const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const COURSE_CODE_PATTERN = /^[A-Z0-9_-]{2,30}$/;

const normalizeObjectId = (value) => {
  const normalized = value?.toString();
  return normalized && OBJECT_ID_PATTERN.test(normalized) ? normalized : null;
};

const normalizeCourseCode = (value) => {
  const normalized = value?.toString().trim().toUpperCase();
  return normalized && COURSE_CODE_PATTERN.test(normalized) ? normalized : null;
};

const getWeeklyTaskRooms = ({ teamId, classId, courseCode } = {}) => {
  const rooms = new Set();
  const normalizedTeamId = normalizeObjectId(teamId);
  const normalizedClassId = normalizeObjectId(classId);
  const normalizedCourseCode = normalizeCourseCode(courseCode);

  if (normalizedTeamId) rooms.add(`weekly-tasks:team:${normalizedTeamId}`);
  if (normalizedClassId) rooms.add(`weekly-tasks:class:${normalizedClassId}`);
  if (normalizedCourseCode) rooms.add(`weekly-tasks:course:${normalizedCourseCode}`);

  return [...rooms];
};

const getWeeklyTaskEmissionRooms = (task) => {
  if (task?.taskType === 'TEAM_TASK') {
    return getWeeklyTaskRooms({ teamId: task.teamId });
  }
  if (task?.taskType === 'CLASS_TASK') {
    return getWeeklyTaskRooms({ classId: task.classId });
  }
  if (task?.taskType === 'COURSE_TEMPLATE') {
    return getWeeklyTaskRooms({ courseCode: task.courseCode });
  }
  return [];
};

const emitWeeklyTaskChange = (req, action, task) => {
  const io = req.app.get('io');
  if (!io || !task) return;

  const rooms = getWeeklyTaskEmissionRooms(task);
  if (rooms.length === 0) return;

  const payload = {
    action,
    taskId: task._id?.toString() || null,
    taskType: task.taskType,
    teamId: task.teamId?.toString() || null,
    classId: task.classId?.toString() || null,
    courseCode: task.courseCode || null,
    weekNumber: task.weekNumber,
    occurredAt: new Date().toISOString(),
  };

  // Chaining rooms creates a union broadcast, so a client subscribed to both
  // its team and class receives this change only once.
  const operator = rooms.reduce((broadcast, room) => broadcast.to(room), io);
  operator.emit('weekly_task_changed', payload);
};

module.exports = {
  emitWeeklyTaskChange,
  getWeeklyTaskRooms,
};
