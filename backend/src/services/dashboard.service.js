// src/services/dashboard.service.js
const User = require('../models/User');
const Class = require('../models/Class');
const Team = require('../models/Team');
const StartupIdea = require('../models/StartupIdea');
const Evaluation = require('../models/Evaluation');
const AiAnalysis = require('../models/AiAnalysis');
const MentoringSession = require('../models/MentoringSession');
const Milestone        = require('../models/Milestone');
const Student          = require('../models/Student');
const Proposal         = require('../models/Proposal');
const PitchDeck        = require('../models/PitchDeck');
const SprintTask       = require('../models/SprintTask');
const Notification     = require('../models/Notification');
const WeeklyTask       = require('../models/WeeklyTask');


// ─── ADMIN ────────────────────────────────────────────────
const getAdminDashboard = async () => {
  const [
    totalUsers, totalClasses, totalTeams, totalIdeas, totalEvaluations,
    totalProposals, submittedProposals, totalMentoringSessions,
    totalMilestones, totalTasks, completedTasks,
    usersByRole, ideasByStatus, recentIdeas
  ] = await Promise.all([
    User.countDocuments(),
    Class.countDocuments(),
    Team.countDocuments(),
    StartupIdea.countDocuments(),
    Evaluation.countDocuments(),
    Proposal.countDocuments(),
    Proposal.countDocuments({ status: { $in: ['SUBMITTED', 'REVIEWED', 'APPROVED'] } }),
    MentoringSession.countDocuments(),
    Milestone.countDocuments(),
    SprintTask.countDocuments(),
    SprintTask.countDocuments({ status: 'DONE' }),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    StartupIdea.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    StartupIdea.find().sort({ createdAt: -1 }).limit(5)
      .populate({ path: 'teamId', select: 'teamName classId', populate: { path: 'classId', select: 'classCode' } }),
  ]);

  // Top teams ranking by average evaluation score
  const topTeamsRaw = await Evaluation.aggregate([
    { $match: { status: { $ne: 'DRAFT' } } },
    { $group: { _id: '$teamId', avgScore: { $avg: '$totalScore' }, count: { $sum: 1 } } },
    { $sort: { avgScore: -1 } },
    { $limit: 10 },
  ]);

  const topTeams = await Promise.all(
    topTeamsRaw.map(async (t) => {
      if (!t._id) return null;
      const team = await Team.findById(t._id)
        .populate({ path: 'classId', select: 'classCode' });
      const idea = await StartupIdea.findOne({ teamId: t._id });
      return {
        startupName: idea?.startupName || team?.teamName || '—',
        team: {
          _id: team?._id,
          name: team?.teamName,
          classId: team?.classId,
        },
        avgScore: parseFloat(t.avgScore.toFixed(2)),
        evaluationCount: t.count,
      };
    })
  );

  const overallTaskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    stats: {
      totalUsers,
      totalClasses,
      totalTeams,
      totalIdeas,
      totalEvaluations,
      totalProposals,
      submittedProposals,
      totalMentoringSessions,
      totalMilestones,
      totalTasks,
      completedTasks,
      overallTaskProgress,
    },
    usersByRole: usersByRole.map(r => ({ role: r._id, count: r.count })),
    ideasByStatus: ideasByStatus.map(s => ({ status: s._id, count: s.count })),
    recentIdeas,
    topTeams: topTeams.filter(Boolean),
  };
};

// ─── LECTURER ─────────────────────────────────────────────
const getLecturerDashboard = async (lecturerId) => {
  const myClasses = await Class.find({ lectureId: lecturerId })
    .populate({ path: 'lectureId', select: 'name email avatar' });

  const classIds = myClasses.map(c => c._id);
  const myTeams = await Team.find({ classId: { $in: classIds } });
  const teamIds = myTeams.map(t => t._id);

  const [pendingIdeas, recentEvals, recentSessions, totalTasks, completedTasks] = await Promise.all([
    StartupIdea.find({ teamId: { $in: teamIds }, status: 'SUBMITTED' })
      .populate({ path: 'teamId', select: 'teamName classId', populate: { path: 'classId', select: 'classCode' } })
      .sort({ submittedAt: -1 }),
    Evaluation.find({ lecturerId })
      .populate({ path: 'teamId', select: 'teamName' })
      .sort({ createdAt: -1 }).limit(5),
    MentoringSession.find({ lecturerId })
      .populate('teamId', 'teamName').sort({ meetingDate: -1 }).limit(5),
    SprintTask.countDocuments({ teamId: { $in: teamIds } }),
    SprintTask.countDocuments({ teamId: { $in: teamIds }, status: 'DONE' }),
  ]);

  // Pending evaluations: proposals submitted but not yet evaluated by this lecturer
  const submittedProposals = await Proposal.find({ teamId: { $in: teamIds }, status: 'SUBMITTED' });
  const evaluatedTeamIds = await Evaluation.find({ lecturerId, status: 'SUBMITTED' }).distinct('teamId');
  const pendingReviews = submittedProposals.filter(p => !evaluatedTeamIds.map(id => id.toString()).includes(p.teamId.toString())).length;

  // Team rankings by average evaluation score
  const teamScores = await Promise.all(
    myTeams.map(async (team) => {
      const evals = await Evaluation.find({ teamId: team._id, status: { $ne: 'DRAFT' } }, 'totalScore');
      const avg = evals.length ? parseFloat((evals.reduce((s, e) => s + e.totalScore, 0) / evals.length).toFixed(2)) : null;
      return { team: { id: team._id, name: team.teamName, classId: team.classId }, avgScore: avg };
    })
  );

  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    totalClasses: myClasses.length,
    totalTeams: myTeams.length,
    totalStudents: await Student.countDocuments({ classId: { $in: classIds } }),
    pendingReviews,
    myClasses,
    myTeams,
    pendingIdeas,
    recentEvaluations: recentEvals,
    recentSessions,
    taskProgress,
    teamRankings: teamScores.sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0)),
  };
};

// ─── MENTOR ───────────────────────────────────────────────
const getMentorDashboard = async (mentorId) => {
  const myClasses = await Class.find({ mentorIds: mentorId });
  const classIds = myClasses.map(c => c._id);
  const myTeams = await Team.find({ $or: [ { mentorId }, { classId: { $in: classIds } } ] });
  const teamIds = myTeams.map(t => t._id);

  const [upcomingSessions, recentEvals, recentSessions, totalTasks, completedTasks] = await Promise.all([
    MentoringSession.countDocuments({ lecturerId: mentorId, meetingDate: { $gte: new Date() } }),
    Evaluation.find({ lecturerId: mentorId })
      .populate({ path: 'teamId', select: 'teamName' })
      .sort({ createdAt: -1 }).limit(5),
    MentoringSession.find({ lecturerId: mentorId })
      .populate('teamId', 'teamName').sort({ meetingDate: -1 }).limit(5),
    SprintTask.countDocuments({ teamId: { $in: teamIds } }),
    SprintTask.countDocuments({ teamId: { $in: teamIds }, status: 'DONE' }),
  ]);

  // Pending evaluations: proposals submitted but not yet evaluated by this mentor
  const submittedProposals = await Proposal.find({ teamId: { $in: teamIds }, status: 'SUBMITTED' });
  const evaluatedTeamIds = await Evaluation.find({ lecturerId: mentorId, status: 'SUBMITTED' }).distinct('teamId');
  const pendingReviews = submittedProposals.filter(p => !evaluatedTeamIds.map(id => id.toString()).includes(p.teamId.toString())).length;

  const evals = await Evaluation.find({ lecturerId: mentorId, status: { $ne: 'DRAFT' } });
  const averageScore = evals.length ? parseFloat((evals.reduce((sum, e) => sum + e.totalScore, 0) / evals.length).toFixed(2)) : 0;

  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    myTeams: myTeams.length,
    pendingReviews,
    upcomingSessions,
    averageScore,
    taskProgress,
    recentEvaluations: recentEvals,
    recentSessions,
  };
};

// ─── STUDENT ──────────────────────────────────────────────
const getStudentDashboard = async (userId, weekNumber = 1) => {
  const userObj = await User.findById(userId);
  if (!userObj) {
    return { hasTeam: false, myClass: null, team: null, startupIdea: null };
  }

  const student = await Student.findOne({
    $or: [
      { userId: userObj._id },
      { email: userObj.email.toLowerCase() }
    ]
  });

  if (!student) {
    return { hasTeam: false, myClass: null, team: null, startupIdea: null };
  }

  const myClass = await Class.findById(student.classId)
    .populate('lectureId', 'name email avatar');

  const myTeam = student.teamId
    ? await Team.findById(student.teamId)
        .populate('classId', 'classCode subjectCode semester year')
        .populate('members.studentId', 'fullName email rollNumber major')
    : null;

  const semesterLabel = (sem) => {
    if (sem === 'SP') return 'Spring';
    if (sem === 'SU') return 'Summer';
    if (sem === 'FA') return 'Fall';
    return sem || '';
  };

  const mappedClass = myClass ? {
    _id: myClass._id,
    name: myClass.description || 'Startup Idea Development',
    code: myClass.classCode,
    semester: `${semesterLabel(myClass.semester)} ${myClass.year || ''}`,
    lecturerId: myClass.lectureId,
  } : null;

  if (!myTeam) {
    return { hasTeam: false, myClass: mappedClass, team: null, startupIdea: null };
  }

  const teamMember = myTeam.members.find(
    m => m.studentId?._id?.toString() === student._id.toString() ||
         m.studentId?.toString() === student._id.toString()
  );

  const [startupIdea, milestones, sessions, tasksCount, unreadNotifications] = await Promise.all([
    StartupIdea.findOne({ teamId: myTeam._id }).sort({ createdAt: -1 }),
    Milestone.find({ teamId: myTeam._id }).sort({ dueDate: 1 }),
    MentoringSession.find({ teamId: myTeam._id })
      .populate('lecturerId', 'name avatar').sort({ meetingDate: -1 }).limit(3),
    SprintTask.aggregate([
      { $match: { teamId: myTeam._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]),
    Notification.countDocuments({
      $or: [
        { recipientId: userId },
        { recipientEmail: userObj.email.toLowerCase() }
      ],
      isRead: false
    })
  ]);

  let aiAnalysis = null, latestEvaluation = null;
  if (startupIdea) {
    [aiAnalysis, latestEvaluation] = await Promise.all([
      AiAnalysis.findOne({ startupIdeaId: startupIdea._id }).sort({ createdAt: -1 }),
      Evaluation.findOne({ teamId: myTeam._id, status: { $ne: 'DRAFT' } })
        .populate('lecturerId', 'name avatar').sort({ createdAt: -1 }),
    ]);
  }

  const now = new Date();
  const processedMilestones = milestones.map(m => {
    const obj = m.toObject();
    if (obj.status !== 'COMPLETED' && new Date(obj.dueDate) < now) obj.status = 'OVERDUE';
    return obj;
  });
  const done = processedMilestones.filter(m => m.status === 'COMPLETED').length;

  const mappedMembers = myTeam.members.map(m => ({
    userId: {
      _id: m.studentId?._id,
      name: m.studentId?.fullName || 'Unknown Student',
      email: m.studentId?.email || '',
      studentId: m.studentId?.rollNumber || '',
    },
    roleInTeam: m.roleInTeam
  }));

  const mappedTeam = {
    _id: myTeam._id,
    name: myTeam.teamName,
    code: myTeam.teamCode,
    members: mappedMembers,
  };

  // Process tasks count breakdown
  const tasksSummary = { todo: 0, inProgress: 0, review: 0, done: 0, total: 0 };
  for (const tc of tasksCount) {
    const status = tc._id;
    const count = tc.count;
    tasksSummary.total += count;
    if (status === 'TODO') tasksSummary.todo = count;
    else if (status === 'IN_PROGRESS') tasksSummary.inProgress = count;
    else if (status === 'REVIEW') tasksSummary.review = count;
    else if (status === 'DONE' || status === 'COMPLETED') {
    tasksSummary.done += count;
    }
  }

  // Fetch weekly task stats for the student's selected roadmap week
  let selectedWeek = Number(weekNumber) || 1;
  if (selectedWeek < 1 || selectedWeek > 10) selectedWeek = 1;
  const courseCode = myClass?.subjectCode || 'EXE101';

  const [dbCourseTasks, dbClassTasks, dbTeamTasks] = await Promise.all([
    WeeklyTask.find({ taskType: 'COURSE_TEMPLATE', courseCode, weekNumber: selectedWeek }),
    myClass ? WeeklyTask.find({ taskType: 'CLASS_TASK', classId: myClass._id, weekNumber: selectedWeek }) : [],
    myTeam ? WeeklyTask.find({ taskType: 'TEAM_TASK', teamId: myTeam._id, weekNumber: selectedWeek }) : []
  ]);

  const allWeeklyTasks = [...dbCourseTasks, ...dbClassTasks, ...dbTeamTasks];
  const overdueWeekly = allWeeklyTasks.filter( t => t.taskType === 'TEAM_TASK' && ( t.status === 'OVERDUE' || ( t.status !== 'COMPLETED' && t.dueDate && new Date(t.dueDate) < now ) ) ).length;
  const pendingWeekly = allWeeklyTasks.filter(t => ['TODO', 'IN_PROGRESS', 'REVIEW'].includes(t.status) && !(t.dueDate && new Date(t.dueDate) < now)).length;
  const completedWeekly = allWeeklyTasks.filter(t => t.status === 'COMPLETED').length;
  
  const pendingWithDue = allWeeklyTasks.filter(t => ['TODO', 'IN_PROGRESS', 'REVIEW'].includes(t.status) && t.dueDate);
  let nextWeeklyDeadline = null;
  if (pendingWithDue.length > 0) {
    const sorted = pendingWithDue.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    nextWeeklyDeadline = sorted[0].dueDate;
  }

  const weeklyTasksSummary = {
    selectedWeek,
    overdue: overdueWeekly,
    pending: pendingWeekly,
    completed: completedWeekly,
    nextDeadline: nextWeeklyDeadline
  };

  return {
    hasTeam: true,
    myClass: mappedClass,
    team: mappedTeam,
    roleInTeam: teamMember?.roleInTeam || 'Member',
    startupIdea,
    aiAnalysis,
    latestEvaluation,
    milestones: processedMilestones,
    mentoringSessions: sessions,
    tasksSummary,
    unreadNotifications,
    milestoneProgress: {
      done,
      total: milestones.length,
      percentage: milestones.length > 0 ? Math.round((done / milestones.length) * 100) : 0,
    },
    weeklyTasksSummary,
  };
}

module.exports = {
  getAdminDashboard,
  getLecturerDashboard,
  getMentorDashboard,
  getStudentDashboard
};
