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

// ─── ADMIN ────────────────────────────────────────────────
const getAdminDashboard = async () => {
  const [totalUsers, totalClasses, totalTeams, totalIdeas, totalEvaluations,
         usersByRole, ideasByStatus, recentIdeas] = await Promise.all([
    User.countDocuments(),
    Class.countDocuments(),
    Team.countDocuments(),
    StartupIdea.countDocuments(),
    Evaluation.countDocuments(),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    StartupIdea.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    StartupIdea.find().sort({ createdAt: -1 }).limit(5)
      .populate({ path: 'teamId', select: 'name classId', populate: { path: 'classId', select: 'name' } }),
  ]);

  // Top teams ranking by average evaluation score
  const topTeamsRaw = await Evaluation.aggregate([
    { $group: { _id: '$startupIdeaId', avgScore: { $avg: '$totalScore' }, count: { $sum: 1 } } },
    { $sort: { avgScore: -1 } },
    { $limit: 10 },
  ]);

  const topTeams = await Promise.all(
    topTeamsRaw.map(async (t) => {
      const idea = await StartupIdea.findById(t._id)
        .populate({ path: 'teamId', select: 'name classId', populate: { path: 'classId', select: 'name' } });
      return {
        startupName: idea?.startupName,
        team: idea?.teamId,
        avgScore: parseFloat(t.avgScore.toFixed(2)),
        evaluationCount: t.count,
      };
    })
  );

  return {
    stats: { totalUsers, totalClasses, totalTeams, totalIdeas, totalEvaluations },
    usersByRole: usersByRole.map(r => ({ role: r._id, count: r.count })),
    ideasByStatus: ideasByStatus.map(s => ({ status: s._id, count: s.count })),
    recentIdeas,
    topTeams: topTeams.filter(t => t.team),
  };
};

// ─── LECTURER ─────────────────────────────────────────────
const getLecturerDashboard = async (lecturerId) => {
  const myClasses = await Class.find({ lecturerId })
    .populate('members', 'name email studentId');

  const classIds = myClasses.map(c => c._id);
  const myTeams = await Team.find({ classId: { $in: classIds } })
    .populate('members.userId', 'name email avatar');
  const teamIds = myTeams.map(t => t._id);

  const [pendingIdeas, recentEvals, recentSessions] = await Promise.all([
    StartupIdea.find({ teamId: { $in: teamIds }, status: 'SUBMITTED' })
      .populate({ path: 'teamId', select: 'name classId', populate: { path: 'classId', select: 'name' } })
      .sort({ submittedAt: -1 }),
    Evaluation.find({ lecturerId })
      .populate({ path: 'startupIdeaId', select: 'startupName teamId',
        populate: { path: 'teamId', select: 'name' } })
      .sort({ createdAt: -1 }).limit(5),
    MentoringSession.find({ lecturerId })
      .populate('teamId', 'name').sort({ meetingDate: -1 }).limit(5),
  ]);

  // Team rankings
  const teamScores = await Promise.all(
    myTeams.map(async (team) => {
      const ideas = await StartupIdea.find({ teamId: team._id }, '_id');
      if (!ideas.length) return { team: { id: team._id, name: team.name }, avgScore: null };
      const evals = await Evaluation.find({ startupIdeaId: { $in: ideas.map(i => i._id) } }, 'totalScore');
      const avg = evals.length ? parseFloat((evals.reduce((s, e) => s + e.totalScore, 0) / evals.length).toFixed(2)) : null;
      return { team: { id: team._id, name: team.name, classId: team.classId }, avgScore: avg };
    })
  );

  return {
    totalClasses: myClasses.length,
    totalTeams: myTeams.length,
    totalStudents: myClasses.reduce((s, c) => s + c.members.length, 0),
    pendingReviews: pendingIdeas.length,
    myClasses,
    myTeams,
    pendingIdeas,
    recentEvaluations: recentEvals,
    recentSessions,
    teamRankings: teamScores.sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0)),
  };
};

// ─── STUDENT ──────────────────────────────────────────────
const getStudentDashboard = async (userId) => {
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

  const [startupIdea, milestones, sessions] = await Promise.all([
    StartupIdea.findOne({ teamId: myTeam._id }).sort({ createdAt: -1 }),
    Milestone.find({ teamId: myTeam._id }).sort({ dueDate: 1 }),
    MentoringSession.find({ teamId: myTeam._id })
      .populate('lecturerId', 'name avatar').sort({ meetingDate: -1 }).limit(3),
  ]);

  let aiAnalysis = null, latestEvaluation = null;
  if (startupIdea) {
    [aiAnalysis, latestEvaluation] = await Promise.all([
      AiAnalysis.findOne({ startupIdeaId: startupIdea._id }).sort({ createdAt: -1 }),
      Evaluation.findOne({ startupIdeaId: startupIdea._id })
        .populate('lecturerId', 'name avatar').sort({ createdAt: -1 }),
    ]);
  }

  const now = new Date();
  const processedMilestones = milestones.map(m => {
    const obj = m.toObject();
    if (obj.status !== 'DONE' && new Date(obj.dueDate) < now) obj.status = 'OVERDUE';
    return obj;
  });
  const done = processedMilestones.filter(m => m.status === 'DONE').length;

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
    milestoneProgress: {
      done, total: milestones.length,
      percentage: milestones.length > 0 ? Math.round((done / milestones.length) * 100) : 0,
    },
  };
};

module.exports = { getAdminDashboard, getLecturerDashboard, getStudentDashboard };
