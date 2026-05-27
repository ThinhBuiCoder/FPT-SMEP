// frontend/src/components/evaluation/RubricScoringForm.jsx
import React, { useState, useEffect } from 'react';
import { getCheckpointConfig } from '../../api/evaluation.api';

/**
 * RubricScoringForm Component
 * 
 * Displays a rubric scoring table where lecturers can:
 * - Select a level (Excellent, Good, Fair, Poor) for each criterion
 * - Manually input scores from 0-10
 * - View weighted calculations automatically
 * - Add criterion-specific comments
 */
const RubricScoringForm = ({ 
  checkpointNumber, 
  initialScores = [], 
  onScoresChange,
  onTotalChange,
  readOnly = false 
}) => {
  const [checkpoint, setCheckpoint] = useState(null);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Level to score mapping
  const levelScores = {
    EXCELLENT: 9.2,
    GOOD: 7.7,
    FAIR: 6.0,
    POOR: 4.0,
  };

  useEffect(() => {
    const loadCheckpoint = async () => {
      try {
        setLoading(true);
        // Assuming there's an API to get checkpoint config
        // For now, use mock data structure
        const config = {
          number: checkpointNumber,
          rubrics: [
            // Mock data - will be replaced with actual API
            { key: 'criterion1', label: 'Criterion 1', weight: 30, description: 'Description' },
            { key: 'criterion2', label: 'Criterion 2', weight: 20, description: 'Description' },
          ]
        };
        setCheckpoint(config);
        
        // Initialize scores
        const initialized = config.rubrics.map((rubric) => {
          const existing = initialScores.find(s => s.criterionKey === rubric.key);
          return {
            criterionKey: rubric.key,
            criterionName: rubric.label,
            weight: rubric.weight,
            description: rubric.description,
            score: existing?.score || 0,
            selectedLevel: existing?.selectedLevel || '',
            scoreMode: existing?.scoreMode || 'LEVEL',
            comment: existing?.comment || '',
            weightedScore: 0,
          };
        });
        setScores(initialized);
        setLoading(false);
      } catch (err) {
        setError('Failed to load checkpoint configuration');
        setLoading(false);
      }
    };

    loadCheckpoint();
  }, [checkpointNumber, initialScores]);

  // Calculate weighted scores when scores change
  useEffect(() => {
    if (scores.length === 0) return;

    const updated = scores.map(score => {
      const weightedScore = (score.score * score.weight) / 100;
      return {
        ...score,
        weightedScore: parseFloat(weightedScore.toFixed(2)),
      };
    });

    setScores(updated);
    
    // Calculate total
    const total = updated.reduce((sum, s) => sum + s.weightedScore, 0);
    onTotalChange?.(parseFloat(total.toFixed(2)));
    onScoresChange?.(updated);
  }, [scores.map(s => s.score).join(',')]);

  const handleLevelChange = (index, level) => {
    const updated = [...scores];
    updated[index].selectedLevel = level;
    updated[index].scoreMode = 'LEVEL';
    updated[index].score = levelScores[level] || 0;
    setScores(updated);
  };

  const handleManualScore = (index, score) => {
    const numScore = Math.max(0, Math.min(10, parseFloat(score) || 0));
    const updated = [...scores];
    updated[index].score = numScore;
    updated[index].scoreMode = 'MANUAL';
    updated[index].selectedLevel = '';
    setScores(updated);
  };

  const handleCommentChange = (index, comment) => {
    const updated = [...scores];
    updated[index].comment = comment;
    setScores(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin">Loading rubric...</div>
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 p-4">{error}</div>;
  }

  const totalScore = scores.reduce((sum, s) => sum + s.weightedScore, 0);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left border text-sm font-semibold">Criterion</th>
              <th className="px-4 py-3 text-center border text-sm font-semibold whitespace-nowrap">Weight</th>
              <th className="px-4 py-3 text-center border text-sm font-semibold whitespace-nowrap">Level</th>
              <th className="px-4 py-3 text-center border text-sm font-semibold whitespace-nowrap">Score</th>
              <th className="px-4 py-3 text-right border text-sm font-semibold whitespace-nowrap">Weighted</th>
              <th className="px-4 py-3 text-left border text-sm font-semibold">Comment</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((score, index) => (
              <tr key={score.criterionKey} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 border">
                  <div>
                    <div className="font-medium text-sm">{score.criterionName}</div>
                    <div className="text-xs text-gray-600 mt-1">{score.description}</div>
                  </div>
                </td>
                <td className="px-4 py-3 border text-center">
                  <div className="font-semibold text-blue-600">{score.weight}%</div>
                </td>
                <td className="px-4 py-3 border">
                  <select
                    value={score.selectedLevel}
                    onChange={(e) => handleLevelChange(index, e.target.value)}
                    disabled={readOnly}
                    className="w-full px-2 py-1 border rounded text-sm disabled:bg-gray-100"
                  >
                    <option value="">-- Select --</option>
                    <option value="EXCELLENT">Excellent (8.5-10)</option>
                    <option value="GOOD">Good (7.0-8.4)</option>
                    <option value="FAIR">Fair (5.0-6.9)</option>
                    <option value="POOR">Poor (&lt;5.0)</option>
                  </select>
                </td>
                <td className="px-4 py-3 border text-center">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={score.score || ''}
                    onChange={(e) => handleManualScore(index, e.target.value)}
                    disabled={readOnly}
                    className="w-20 px-2 py-1 border rounded text-center text-sm disabled:bg-gray-100"
                  />
                </td>
                <td className="px-4 py-3 border text-right">
                  <div className="font-semibold text-green-600">
                    {score.weightedScore.toFixed(2)}
                  </div>
                </td>
                <td className="px-4 py-3 border">
                  <input
                    type="text"
                    value={score.comment}
                    onChange={(e) => handleCommentChange(index, e.target.value)}
                    placeholder="Add comment..."
                    disabled={readOnly}
                    className="w-full px-2 py-1 border rounded text-sm disabled:bg-gray-100"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-blue-50 font-bold border-t-2 border-blue-300">
            <tr>
              <td colSpan="4" className="px-4 py-3 border text-right">
                Checkpoint Total:
              </td>
              <td className="px-4 py-3 border text-right">
                <div className="text-lg text-blue-700">
                  {totalScore.toFixed(2)} / 10
                </div>
              </td>
              <td className="px-4 py-3 border"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Summary Section */}
      <div className="p-4 bg-gray-50 border-t">
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-sm text-gray-600">Total Weight</div>
            <div className="text-lg font-bold text-gray-800">
              {scores.reduce((sum, s) => sum + s.weight, 0)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Criteria Count</div>
            <div className="text-lg font-bold text-gray-800">{scores.length}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-600">Checkpoint Score</div>
            <div className="text-lg font-bold text-blue-700">{totalScore.toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RubricScoringForm;
