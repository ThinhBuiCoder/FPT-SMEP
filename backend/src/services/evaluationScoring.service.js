const { getCheckpointConfig } = require('../config/checkpointConfig');

const LEVEL_TO_SCORE = {
  EXCELLENT: 9.2,
  GOOD: 7.7,
  FAIR: 6.0,
  POOR: 4.0,
};

const normalizeLevel = (value) => (value || '').toString().trim().toUpperCase();

const clampScore = (score) => {
  if (score == null || Number.isNaN(Number(score))) return null;
  return Math.max(0, Math.min(10, Number(score)));
};

const getCriteria = (checkpointNumber) => {
  const config = getCheckpointConfig(checkpointNumber);
  return config?.rubrics || [];
};

const normalizeRubricScores = (checkpointNumber, rubricScores = []) => {
  const criteria = getCriteria(checkpointNumber);
  if (!criteria.length) {
    return { criteria, rubricScores: [], totalWeight: 0, checkpointTotal: 0 };
  }

  const inputMap = new Map(
    rubricScores.map((item) => [item.criterionKey, item])
  );

  const normalized = criteria.map((criterion) => {
    const input = inputMap.get(criterion.key) || {};
    const selectedLevel = normalizeLevel(input.selectedLevel || input.level);
    const manualScore = clampScore(input.manualScore ?? input.score);
    const autoScore = selectedLevel && LEVEL_TO_SCORE[selectedLevel] != null
      ? LEVEL_TO_SCORE[selectedLevel]
      : null;
    const score = manualScore ?? autoScore ?? 0;
    const weightedScore = Number(((score * criterion.weight) / 100).toFixed(2));

    return {
      criterionKey: criterion.key,
      criterionName: criterion.label,
      weight: criterion.weight,
      description: criterion.description,
      selectedLevel: selectedLevel || '',
      score: Number(score.toFixed(2)),
      weightedScore,
      comment: (input.comment || '').toString().trim(),
      scoreMode: manualScore != null ? 'MANUAL' : 'LEVEL',
    };
  });

  const totalWeight = normalized.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
  const checkpointTotal = Number(
    normalized.reduce((sum, item) => sum + (Number(item.weightedScore) || 0), 0).toFixed(2)
  );

  return { criteria, rubricScores: normalized, totalWeight, checkpointTotal };
};

const assertValidRubric = (checkpointNumber, rubricScores = []) => {
  const { criteria, totalWeight } = normalizeRubricScores(checkpointNumber, rubricScores);

  if (!criteria.length) {
    const error = new Error('Checkpoint rubric is not configured.');
    error.statusCode = 400;
    throw error;
  }

  if (totalWeight !== 100) {
    const error = new Error(`Total rubric weight for checkpoint ${checkpointNumber} must equal 100%. Current total: ${totalWeight}%.`);
    error.statusCode = 400;
    throw error;
  }

  return true;
};

module.exports = {
  LEVEL_TO_SCORE,
  clampScore,
  normalizeRubricScores,
  assertValidRubric,
};