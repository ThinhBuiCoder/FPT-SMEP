import React, { useState, useEffect } from 'react';

const DEFAULT_RUBRIC = [
  { criterionKey: "problem", criterionName: "Problem Clarity", maxScore: 10, weight: 1 },
  { criterionKey: "solution", criterionName: "Solution Feasibility", maxScore: 10, weight: 1 },
  { criterionKey: "market", criterionName: "Market Potential", maxScore: 10, weight: 1 },
  { criterionKey: "businessModel", criterionName: "Business Model", maxScore: 10, weight: 1 },
  { criterionKey: "pitchDeck", criterionName: "Pitch Deck Quality", maxScore: 10, weight: 1 },
  { criterionKey: "team", criterionName: "Team Capability", maxScore: 10, weight: 1 }
];

export default function RubricForm({ initialData, onSubmit, readOnly = false }) {
  const [rubricScores, setRubricScores] = useState(DEFAULT_RUBRIC.map(c => ({
    ...c,
    score: 0,
    comment: ''
  })));
  
  const [overallFeedback, setOverallFeedback] = useState('');
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [suggestions, setSuggestions] = useState('');

  useEffect(() => {
    if (initialData) {
      if (initialData.rubricScores && initialData.rubricScores.length > 0) {
        setRubricScores(initialData.rubricScores);
      }
      setOverallFeedback(initialData.overallFeedback || '');
      setStrengths(initialData.strengths || '');
      setWeaknesses(initialData.weaknesses || '');
      setSuggestions(initialData.suggestions || '');
    }
  }, [initialData]);

  const handleScoreChange = (index, value) => {
    if (readOnly) return;
    const newScores = [...rubricScores];
    newScores[index].score = Number(value);
    setRubricScores(newScores);
  };

  const handleCommentChange = (index, value) => {
    if (readOnly) return;
    const newScores = [...rubricScores];
    newScores[index].comment = value;
    setRubricScores(newScores);
  };

  const calculateTotal = () => rubricScores.reduce((sum, item) => sum + (item.score || 0), 0);
  const maxTotal = rubricScores.reduce((sum, item) => sum + (item.maxScore || 10), 0);

  const handleSubmit = (e, status) => {
    e.preventDefault();
    if (readOnly) return;
    onSubmit({
      rubricScores,
      overallFeedback,
      strengths,
      weaknesses,
      suggestions,
      status
    });
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-bold text-gray-800 mb-6">Evaluation Rubric</h3>
      
      <div className="space-y-6">
        {rubricScores.map((item, index) => (
          <div key={item.criterionKey} className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-semibold text-gray-700">
                {item.criterionName} (Max: {item.maxScore})
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Score:</span>
                <input
                  type="number"
                  min="0"
                  max={item.maxScore}
                  value={item.score}
                  onChange={(e) => handleScoreChange(index, e.target.value)}
                  disabled={readOnly}
                  className="w-20 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100"
                />
              </div>
            </div>
            <input
              type="text"
              placeholder="Comment for this criterion (optional)"
              value={item.comment}
              onChange={(e) => handleCommentChange(index, e.target.value)}
              disabled={readOnly}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100"
            />
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <div className="text-xl font-bold text-gray-800">
          Total Score: <span className="text-blue-600">{calculateTotal()}</span> / {maxTotal}
        </div>
      </div>

      <div className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Overall Feedback</label>
          <textarea
            rows={3}
            value={overallFeedback}
            onChange={(e) => setOverallFeedback(e.target.value)}
            disabled={readOnly}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100"
            placeholder="General feedback..."
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-green-700 mb-1">Strengths</label>
            <textarea
              rows={2}
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              disabled={readOnly}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-red-700 mb-1">Weaknesses</label>
            <textarea
              rows={2}
              value={weaknesses}
              onChange={(e) => setWeaknesses(e.target.value)}
              disabled={readOnly}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm disabled:bg-gray-100"
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
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100"
          />
        </div>
      </div>

      {!readOnly && (
        <div className="mt-8 flex justify-end space-x-4">
          <button
            type="button"
            onClick={(e) => handleSubmit(e, 'DRAFT')}
            className="inline-flex justify-center py-2 px-4 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={(e) => handleSubmit(e, 'SUBMITTED')}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Submit Evaluation
          </button>
        </div>
      )}
    </div>
  );
}
