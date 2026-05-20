// src/services/ranking.service.js
const Team = require('../models/Team');
const Class = require('../models/Class');
const Student = require('../models/Student');
const Evaluation = require('../models/Evaluation');
const Proposal = require('../models/Proposal');
const PitchDeck = require('../models/PitchDeck');
const SprintTask = require('../models/SprintTask');
const StartupIdea = require('../models/StartupIdea');

/**
 * Calculate scores and ranking details for a list of teams.
 */
const calculateTeamScores = async (teams) => {
  const rankList = await Promise.all(
    teams.map(async (team) => {
      // 1. Evaluation Score (60%)
      const evals = await Evaluation.find({ teamId: team._id, status: { $ne: 'DRAFT' } });
      let evaluationScore = 0;
      if (evals.length > 0) {
        const totalNorm = evals.reduce((sum, e) => {
          const max = e.maxTotalScore || 10;
          return sum + ((e.totalScore / max) * 100);
        }, 0);
        evaluationScore = totalNorm / evals.length;
      }

      // 2. Sprint Progress (25%)
      const tasks = await SprintTask.find({ teamId: team._id });
      let sprintProgress = 0;
      if (tasks.length > 0) {
        const doneCount = tasks.filter(t => t.status === 'DONE').length;
        sprintProgress = (doneCount / tasks.length) * 100;
      }

      // 3. Proposal Score (10%)
      const proposal = await Proposal.findOne({ teamId: team._id });
      let proposalScore = 0;
      if (proposal) {
        if (['SUBMITTED', 'REVIEWED', 'APPROVED'].includes(proposal.status)) {
          proposalScore = 100;
        } else if (proposal.status === 'DRAFT') {
          proposalScore = 50;
        }
      }

      // 4. Pitch Deck Score (5%)
      const deck = await PitchDeck.findOne({ teamId: team._id, status: 'ACTIVE' });
      const deckScore = deck ? 100 : 0;

      // Final score formula: 60% eval + 25% sprint + 10% proposal + 5% deck
      const finalScore = parseFloat(
        (evaluationScore * 0.6 + sprintProgress * 0.25 + proposalScore * 0.1 + deckScore * 0.05).toFixed(2)
      );

      const idea = await StartupIdea.findOne({ teamId: team._id });

      return {
        teamId: team._id,
        teamName: team.teamName,
        teamCode: team.teamCode,
        className: team.classId?.classCode || '—',
        startupName: idea?.startupName || team.teamName || '—',
        scores: {
          evaluationScore: parseFloat(evaluationScore.toFixed(2)),
          sprintProgress: parseFloat(sprintProgress.toFixed(2)),
          proposalScore,
          deckScore,
        },
        finalScore,
      };
    })
  );

  // Sort by finalScore desc
  return rankList.sort((a, b) => b.finalScore - a.finalScore);
};

/**
 * Get rankings for all teams (Admin only)
 */
const getGlobalRankings = async () => {
  const teams = await Team.find().populate('classId', 'classCode');
  return await calculateTeamScores(teams);
};

/**
 * Get rankings for a specific class
 */
const getClassRankings = async (classId) => {
  const teams = await Team.find({ classId }).populate('classId', 'classCode');
  return await calculateTeamScores(teams);
};

/**
 * Get rankings for a student's class
 */
const getStudentClassRankings = async (userId) => {
  const student = await Student.findOne({ userId });
  if (!student || !student.classId) return [];

  const teams = await Team.find({ classId: student.classId }).populate('classId', 'classCode');
  return await calculateTeamScores(teams);
};

/**
 * Get rankings for teams assigned to lecturer or mentor
 */
const getLecturerOrMentorRankings = async (userId) => {
  // Lecturer myClasses
  const classes = await Class.find({
    $or: [
      { lectureId: userId },
      { mentorIds: userId }
    ]
  });
  const classIds = classes.map(c => c._id);

  // Teams where lecturerId = userId, mentorId = userId or in lecturer's/mentor's classes
  const teams = await Team.find({
    $or: [
      { lectureId: userId },
      { mentorId: userId },
      { classId: { $in: classIds } }
    ]
  }).populate('classId', 'classCode');

  return await calculateTeamScores(teams);
};

module.exports = {
  getGlobalRankings,
  getClassRankings,
  getStudentClassRankings,
  getLecturerOrMentorRankings,
};
