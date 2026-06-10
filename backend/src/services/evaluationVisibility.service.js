// src/services/evaluationVisibility.service.js
// ─────────────────────────────────────────────────────────────────────────────
// Role-based evaluation visibility service.
//
// Business rules:
//  - LECTURER / ADMIN : full numeric data
//  - MENTOR           : level + label + color only — NO score, weightedScore,
//                       checkpointTotal, or totalScore
//  - STUDENT / USER   : same as LECTURER for published evaluations (gating is
//                       handled at the query level in the controller)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Performance level thresholds and metadata.
 * Evaluated in order — first match wins.
 */
const PERFORMANCE_LEVELS = [
  {
    minScore: 8.5,
    maxScore: 10,
    level: 'Excellent',
    label: 'Outstanding Performance',
    color: 'blue',
    colorHex: '#3B82F6',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-800',
    borderClass: 'border-blue-300',
  },
  {
    minScore: 7.0,
    maxScore: 8.499,
    level: 'Good',
    label: 'Meets Standard',
    color: 'green',
    colorHex: '#22C55E',
    bgClass: 'bg-green-100',
    textClass: 'text-green-800',
    borderClass: 'border-green-300',
  },
  {
    minScore: 5.0,
    maxScore: 6.999,
    level: 'Fair',
    label: 'Needs Effort',
    color: 'yellow',
    colorHex: '#EAB308',
    bgClass: 'bg-yellow-100',
    textClass: 'text-yellow-800',
    borderClass: 'border-yellow-300',
  },
  {
    minScore: 0,
    maxScore: 4.999,
    level: 'Poor',
    label: 'Needs Immediate Improvement',
    color: 'red',
    colorHex: '#EF4444',
    bgClass: 'bg-red-100',
    textClass: 'text-red-800',
    borderClass: 'border-red-300',
  },
];

/**
 * Derive performance level metadata from a raw numeric score (0–10).
 * Returns a safe default (Poor) when the score is missing or invalid.
 *
 * @param {number|null|undefined} score
 * @returns {{ level, label, color, colorHex, bgClass, textClass, borderClass }}
 */
const getPerformanceLevel = (score) => {
  const s = Number(score);
  if (!Number.isFinite(s)) {
    // Unknown / not yet scored — return a neutral "unscored" level
    return {
      level: 'Unscored',
      label: 'Not Yet Scored',
      color: 'gray',
      colorHex: '#94A3B8',
      bgClass: 'bg-slate-100',
      textClass: 'text-slate-600',
      borderClass: 'border-slate-300',
    };
  }
  const clamped = Math.max(0, Math.min(10, s));
  return (
    PERFORMANCE_LEVELS.find((p) => clamped >= p.minScore && clamped <= p.maxScore) ||
    PERFORMANCE_LEVELS[PERFORMANCE_LEVELS.length - 1]
  );
};

/**
 * Sanitize a single rubric score entry for Mentor visibility.
 * Strips numeric values and replaces them with level/label/color.
 *
 * @param {{ criterionKey, criterionName, weight, score, weightedScore, selectedLevel, comment }} rubricScore
 * @returns {{ criterionKey, criterionName, weight, level, label, color, colorHex, bgClass, textClass, borderClass, comment }}
 */
const sanitizeRubricScore = (rubricScore) => {
  const perf = getPerformanceLevel(rubricScore.score);
  return {
    criterionKey: rubricScore.criterionKey,
    criterionName: rubricScore.criterionName,
    weight: rubricScore.weight,
    level: perf.level,
    label: perf.label,
    color: perf.color,
    colorHex: perf.colorHex,
    bgClass: perf.bgClass,
    textClass: perf.textClass,
    borderClass: perf.borderClass,
    comment: rubricScore.comment || '',
  };
};

/**
 * Derive overall performance level from the checkpointTotal / weightedScore.
 *
 * @param {object} evaluation — Mongoose document or plain object
 * @returns {{ level, label, color, colorHex, bgClass, textClass, borderClass }}
 */
const getOverallPerformanceLevel = (evaluation) => {
  const totalScore =
    evaluation.checkpointTotal ?? evaluation.weightedScore ?? null;
  return getPerformanceLevel(totalScore);
};

/**
 * Sanitize a full evaluation document for Mentor role.
 * Removes all numeric score fields; adds performance level metadata.
 *
 * @param {object} evaluation — Mongoose document (.toObject() called internally)
 * @returns {object} mentor-safe evaluation object
 */
const sanitizeEvaluationForMentor = (evaluation) => {
  const doc =
    typeof evaluation.toObject === 'function'
      ? evaluation.toObject()
      : { ...evaluation };

  const overallPerf = getOverallPerformanceLevel(doc);

  // Sanitize each rubric score entry
  const sanitizedRubricScores = (doc.rubricScores || []).map(sanitizeRubricScore);

  // Build the sanitized object — never include score numbers
  return {
    _id: doc._id,
    teamId: doc.teamId,
    classId: doc.classId,
    proposalId: doc.proposalId,
    checkpointNumber: doc.checkpointNumber,
    checkpointTitle: doc.checkpointTitle,
    lecturerId: doc.lecturerId,
    evaluatorRole: doc.evaluatorRole,
    status: doc.status,
    submittedAt: doc.submittedAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    // Overall performance (no numeric total)
    overallLevel: overallPerf.level,
    overallLabel: overallPerf.label,
    overallColor: overallPerf.color,
    overallColorHex: overallPerf.colorHex,
    overallBgClass: overallPerf.bgClass,
    overallTextClass: overallPerf.textClass,
    overallBorderClass: overallPerf.borderClass,
    // Rubric scores — level/label/color only
    rubricScores: sanitizedRubricScores,
    // Feedback text is visible to Mentor
    overallFeedback: doc.overallFeedback || '',
    // Explicitly omitted: score, weightedScore, checkpointTotal, totalWeight
    _mentorView: true, // sentinel flag for frontend
  };
};

/**
 * Sanitize a history snapshot for Mentor role.
 * Strips numeric scores from the embedded snapshot.
 *
 * @param {object} historyItem
 * @returns {object}
 */
const sanitizeHistoryItemForMentor = (historyItem) => {
  const doc =
    typeof historyItem.toObject === 'function'
      ? historyItem.toObject()
      : { ...historyItem };

  if (doc.snapshot) {
    const snapshotPerf = getOverallPerformanceLevel(doc.snapshot);
    doc.snapshot = {
      _id: doc.snapshot._id,
      status: doc.snapshot.status,
      checkpointNumber: doc.snapshot.checkpointNumber,
      checkpointTitle: doc.snapshot.checkpointTitle,
      evaluatorRole: doc.snapshot.evaluatorRole,
      overallLevel: snapshotPerf.level,
      overallLabel: snapshotPerf.label,
      overallColor: snapshotPerf.color,
      overallBgClass: snapshotPerf.bgClass,
      overallTextClass: snapshotPerf.textClass,
      overallBorderClass: snapshotPerf.borderClass,
      rubricScores: (doc.snapshot.rubricScores || []).map(sanitizeRubricScore),
      overallFeedback: doc.snapshot.overallFeedback || '',
    };
  }

  return doc;
};

/**
 * Format a single evaluation according to the requesting user's role.
 *
 * @param {object} evaluation — Mongoose doc or plain object
 * @param {string} role — 'MENTOR' | 'LECTURER' | 'ADMIN' | 'STUDENT' | 'USER'
 * @returns {object}
 */
const formatEvaluationByRole = (evaluation, role) => {
  const normalizedRole = (role || '').toString().toUpperCase();

  if (normalizedRole === 'MENTOR' || normalizedRole === 'STUDENT') {
    return sanitizeEvaluationForMentor(evaluation);
  }

  // LECTURER, ADMIN, USER — return full data
  const doc =
    typeof evaluation.toObject === 'function'
      ? evaluation.toObject()
      : { ...evaluation };

  // Attach performance level metadata alongside scores (useful for badges)
  const overallPerf = getOverallPerformanceLevel(doc);
  return {
    ...doc,
    overallLevel: overallPerf.level,
    overallLabel: overallPerf.label,
    overallColor: overallPerf.color,
    overallColorHex: overallPerf.colorHex,
    overallBgClass: overallPerf.bgClass,
    overallTextClass: overallPerf.textClass,
    overallBorderClass: overallPerf.borderClass,
    // Enrich each rubric score with its level metadata too
    rubricScores: (doc.rubricScores || []).map((rs) => ({
      ...rs,
      ...getPerformanceLevel(rs.score),
    })),
    _mentorView: false,
  };
};

/**
 * Format an array of evaluations according to the requesting user's role.
 *
 * @param {object[]} evaluations
 * @param {string} role
 * @returns {object[]}
 */
const formatEvaluationsByRole = (evaluations, role) =>
  (evaluations || []).map((ev) => formatEvaluationByRole(ev, role));

/**
 * Format a history item array according to the requesting user's role.
 *
 * @param {object[]} historyItems
 * @param {string} role
 * @returns {object[]}
 */
const formatHistoryByRole = (historyItems, role) => {
  const normalizedRole = (role || '').toString().toUpperCase();
  if (normalizedRole !== 'MENTOR' && normalizedRole !== 'STUDENT') return historyItems;
  return (historyItems || []).map(sanitizeHistoryItemForMentor);
};

module.exports = {
  PERFORMANCE_LEVELS,
  getPerformanceLevel,
  getOverallPerformanceLevel,
  sanitizeEvaluationForMentor,
  sanitizeHistoryItemForMentor,
  formatEvaluationByRole,
  formatEvaluationsByRole,
  formatHistoryByRole,
};
