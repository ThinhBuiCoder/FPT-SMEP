import { useEffect, useMemo, useState } from 'react';

const DEFAULT_CRITERIA = [
  { criterionKey: 'problem', criterionName: 'Problem Clarity', maxScore: 10, weight: 1 },
  { criterionKey: 'solution', criterionName: 'Solution Feasibility', maxScore: 10, weight: 1 },
  { criterionKey: 'market', criterionName: 'Market Potential', maxScore: 10, weight: 1 },
  { criterionKey: 'businessModel', criterionName: 'Business Model', maxScore: 10, weight: 1 },
  { criterionKey: 'pitchDeck', criterionName: 'Pitch Deck Quality', maxScore: 10, weight: 1 },
  { criterionKey: 'team', criterionName: 'Team Capability', maxScore: 10, weight: 1 },
];

const LEVEL_OPTIONS = [
  { value: 'EXCELLENT', label: 'Excellent', score: 9.2, range: '8.5–10' },
  { value: 'GOOD', label: 'Good', score: 7.7, range: '7.0–8.4' },
  { value: 'FAIR', label: 'Fair', score: 6.0, range: '5.0–6.9' },
  { value: 'POOR', label: 'Poor', score: 4.0, range: '< 5.0' },
];

const DEFAULT_LEVEL = LEVEL_OPTIONS[1].value;

const normalizeCriteria = (criteria = []) => {
  const source = Array.isArray(criteria) && criteria.length > 0 ? criteria : DEFAULT_CRITERIA;
  return source.map((item) => ({
    criterionKey: item.key || item.criterionKey,
    criterionName: item.label || item.criterionName,
    description: item.description || '',
    weight: Number(item.weight ?? 1),
    maxScore: Number(item.maxScore ?? 10),
    levels: item.levels || LEVEL_OPTIONS,
  }));
};

const initialRows = (criteria, initialData) => {
  const byKey = new Map((initialData?.rubricScores || []).map((item) => [item.criterionKey, item]));

  return criteria.map((criterion) => {
    const existing = byKey.get(criterion.criterionKey) || {};
    const fallbackLevel = existing.selectedLevel || existing.level || DEFAULT_LEVEL;
    const currentScore = Number(existing.score ?? existing.manualScore ?? 0);

    return {
      ...criterion,
      selectedLevel: fallbackLevel,
      scoreMode: existing.scoreMode || (existing.manualScore != null ? 'MANUAL' : 'LEVEL'),
      score: Number.isFinite(currentScore) ? currentScore : 0,
      comment: existing.comment || '',
      weightedScore: Number(existing.weightedScore ?? 0),
    };
  });
};

export default function RubricForm({
  initialData,
  onSubmit,
  readOnly = false,
  criteria: customCriteria,
  checkpointNumber,
  checkpointTitle,
}) {
  const criteria = useMemo(() => normalizeCriteria(customCriteria), [customCriteria]);
  const [rubricScores, setRubricScores] = useState(() => initialRows(criteria, initialData));
  const [overallFeedback, setOverallFeedback] = useState('');
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [suggestions, setSuggestions] = useState('');

  useEffect(() => {
    setRubricScores(initialRows(criteria, initialData));
    setOverallFeedback(initialData?.overallFeedback || '');
    setStrengths(initialData?.strengths || '');
    setWeaknesses(initialData?.weaknesses || '');
    setSuggestions(initialData?.suggestions || '');
  }, [criteria, initialData]);

  const selectedLevelMeta = (value) => LEVEL_OPTIONS.find((opt) => opt.value === value) || LEVEL_OPTIONS[1];

  const updateRow = (index, patch) => {
    if (readOnly) return;
    setRubricScores((prev) => {
      const next = [...prev];
      const current = { ...next[index], ...patch };
      const score = Number(current.score || 0);
      const weight = Number(current.weight || 0);
      current.weightedScore = Number(((score * weight) / 100).toFixed(2));
      next[index] = current;
      return next;
    });
  };

  const handleLevelChange = (index, level) => {
    const meta = selectedLevelMeta(level);
    updateRow(index, {
      selectedLevel: level,
      scoreMode: 'LEVEL',
      score: meta.score,
    });
  };

  const handleScoreChange = (index, value) => {
    const numeric = value === '' ? 0 : Number(value);
    updateRow(index, {
      scoreMode: 'MANUAL',
      score: Number.isFinite(numeric) ? Math.max(0, Math.min(10, numeric)) : 0,
    });
  };

  const handleCommentChange = (index, value) => updateRow(index, { comment: value });

  const checkpointTotal = useMemo(
    () => rubricScores.reduce((sum, item) => sum + (Number(item.weightedScore) || 0), 0),
    [rubricScores]
  );
  const totalWeight = useMemo(
    () => rubricScores.reduce((sum, item) => sum + (Number(item.weight) || 0), 0),
    [rubricScores]
  );
  const totalRawScore = useMemo(
    () => rubricScores.reduce((sum, item) => sum + (Number(item.score) || 0), 0),
    [rubricScores]
  );
  const maxTotal = useMemo(
    () => rubricScores.reduce((sum, item) => sum + (Number(item.maxScore) || 10), 0),
    [rubricScores]
  );

  const handleSubmit = (e, status) => {
    e.preventDefault();
    if (readOnly || !onSubmit) return;

    onSubmit({
      checkpointNumber,
      checkpointTitle,
      rubricScores,
      overallFeedback,
      strengths,
      weaknesses,
      suggestions,
      status,
    });
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-slate-200/70">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-5">
        <div>
          <h3 className="text-lg font-black text-slate-900">Evaluation Rubric</h3>
          <p className="text-sm text-slate-500">
            {checkpointTitle ? `Checkpoint ${checkpointNumber} · ${checkpointTitle}` : 'Manual and level-based scoring with weighted totals.'}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-center">
            <p className="text-slate-400 uppercase tracking-wider font-semibold">Raw</p>
            <p className="font-black text-slate-900">{totalRawScore.toFixed(1)} / {maxTotal.toFixed(0)}</p>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2 text-center">
            <p className="text-blue-500 uppercase tracking-wider font-semibold">Weighted</p>
            <p className="font-black text-blue-700">{checkpointTotal.toFixed(2)} / 10</p>
          </div>
          <div className={`rounded-xl border px-3 py-2 text-center ${totalWeight === 100 ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
            <p className={`uppercase tracking-wider font-semibold ${totalWeight === 100 ? 'text-emerald-500' : 'text-amber-600'}`}>Weight</p>
            <p className={`font-black ${totalWeight === 100 ? 'text-emerald-700' : 'text-amber-700'}`}>{totalWeight}%</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200/80">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-500">
              <th className="px-4 py-3 font-semibold">Criterion</th>
              <th className="px-4 py-3 font-semibold w-24">Weight</th>
              <th className="px-4 py-3 font-semibold w-40">Level</th>
              <th className="px-4 py-3 font-semibold w-28">Score</th>
              <th className="px-4 py-3 font-semibold w-32">Weighted</th>
              <th className="px-4 py-3 font-semibold">Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rubricScores.map((item, index) => (
              <tr key={item.criterionKey} className="align-top">
                <td className="px-4 py-4">
                  <div className="font-semibold text-slate-900">{item.criterionName}</div>
                  {item.description && <div className="mt-1 text-xs text-slate-500">{item.description}</div>}
                </td>
                <td className="px-4 py-4">
                  <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{item.weight}%</span>
                </td>
                <td className="px-4 py-4">
                  <select
                    value={item.selectedLevel}
                    onChange={(e) => handleLevelChange(index, e.target.value)}
                    disabled={readOnly}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:bg-slate-50"
                  >
                    {item.levels.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label} ({level.range})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-4">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={item.score}
                    onChange={(e) => handleScoreChange(index, e.target.value)}
                    disabled={readOnly}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:bg-slate-50"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Manual override</p>
                </td>
                <td className="px-4 py-4">
                  <div className="font-bold text-blue-700">{Number(item.weightedScore || 0).toFixed(2)}</div>
                  <div className="text-xs text-slate-400">score × weight</div>
                </td>
                <td className="px-4 py-4">
                  <textarea
                    rows={2}
                    placeholder="Criterion comment"
                    value={item.comment}
                    onChange={(e) => handleCommentChange(index, e.target.value)}
                    disabled={readOnly}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/10 disabled:bg-slate-50 resize-none"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Raw Score</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{totalRawScore.toFixed(2)} <span className="text-sm text-slate-400">/ {maxTotal.toFixed(0)}</span></p>
        </div>
        <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-500">Checkpoint Total</p>
          <p className="mt-1 text-2xl font-black text-blue-700">{checkpointTotal.toFixed(2)} <span className="text-sm text-blue-400">/ 10</span></p>
        </div>
        <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500">Weight Validity</p>
          <p className="mt-1 text-2xl font-black text-emerald-700">{totalWeight}%</p>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Overall Feedback</label>
          <textarea
            rows={3}
            value={overallFeedback}
            onChange={(e) => setOverallFeedback(e.target.value)}
            disabled={readOnly}
            className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-primary focus:ring-primary/10 sm:text-sm disabled:bg-slate-50"
            placeholder="General feedback..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-emerald-700 mb-1">Strengths</label>
            <textarea
              rows={2}
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              disabled={readOnly}
              className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 sm:text-sm disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-red-700 mb-1">Weaknesses</label>
            <textarea
              rows={2}
              value={weaknesses}
              onChange={(e) => setWeaknesses(e.target.value)}
              disabled={readOnly}
              className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm disabled:bg-slate-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-blue-700 mb-1">Suggestions for Improvement</label>
          <textarea
            rows={2}
            value={suggestions}
            onChange={(e) => setSuggestions(e.target.value)}
            disabled={readOnly}
            className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-slate-50"
          />
        </div>
      </div>

      {!readOnly && onSubmit && (
        <div className="mt-8 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button
            type="button"
            onClick={(e) => handleSubmit(e, 'DRAFT')}
            className="inline-flex justify-center py-2.5 px-4 border border-slate-200 shadow-sm text-sm font-semibold rounded-xl text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, 'SUBMITTED')}
            className="inline-flex justify-center py-2.5 px-4 border border-transparent shadow-sm text-sm font-semibold rounded-xl text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            Submit Evaluation
          </button>
        </div>
      )}
    </div>
  );
}
