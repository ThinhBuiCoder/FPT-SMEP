import React, { useState, useEffect } from 'react';
import { getTeamEvaluations, createTeamEvaluation, updateTeamEvaluation } from '../../api/evaluationApi';
import RubricForm from './RubricForm';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

export default function EvaluationPanel({ teamId, proposalId, pitchDeckId }) {
  const { user } = useAuth();
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isStudent = user?.role === 'STUDENT' || user?.role === 'USER';

  useEffect(() => {
    fetchEvaluations();
  }, [teamId]);

  const fetchEvaluations = async () => {
    try {
      setLoading(true);
      const res = await getTeamEvaluations(teamId);
      if (res.success) {
        setEvaluations(res.data.evaluations || []);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load evaluations');
      toast.error('Failed to load evaluations');
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluationSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        proposalId,
        pitchDeckId
      };

      // Check if we already have an evaluation from this user
      const existing = evaluations.find(ev => ev.lecturerId?._id === user._id);
      
      let res;
      if (existing) {
        res = await updateTeamEvaluation(existing._id, payload);
      } else {
        res = await createTeamEvaluation(teamId, payload);
      }

      if (res.success) {
        toast.success(data.status === 'SUBMITTED' ? 'Evaluation submitted!' : 'Draft saved!');
        fetchEvaluations();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save evaluation');
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading evaluations...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>;
  }

  // Find user's own evaluation (if any)
  const myEvaluation = evaluations.find(ev => ev.lecturerId?._id === user?._id);

  return (
    <div className="space-y-8">
      {isStudent ? (
        evaluations.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <p className="text-gray-500">No evaluations have been submitted for your team yet.</p>
          </div>
        ) : (
          evaluations.map(ev => (
            <div key={ev._id} className="mb-8">
              <div className="flex items-center space-x-4 mb-4">
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-blue-100">
                    <span className="text-blue-700 font-medium leading-none">
                      {ev.lecturerId?.name?.charAt(0) || 'E'}
                    </span>
                  </span>
                </div>
                <div>
                  <h4 className="text-md font-bold text-gray-900">Evaluation by {ev.lecturerId?.name}</h4>
                  <p className="text-sm text-gray-500">{ev.evaluatorRole} • {new Date(ev.updatedAt).toLocaleDateString()}</p>
                </div>
                <div className="ml-auto">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${ev.status === 'SUBMITTED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {ev.status}
                  </span>
                </div>
              </div>
              <RubricForm initialData={ev} readOnly={true} />
            </div>
          ))
        )
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-lg font-medium text-gray-900">Your Evaluation</h2>
            <p className="text-sm text-gray-500">Evaluate the team's proposal and pitch deck based on the rubric.</p>
          </div>
          <RubricForm 
            initialData={myEvaluation || {}} 
            onSubmit={handleEvaluationSubmit} 
            readOnly={myEvaluation?.status === 'SUBMITTED' && user.role !== 'ADMIN'}
          />
          
          {evaluations.filter(e => e.lecturerId?._id !== user?._id).length > 0 && (
            <div className="mt-12">
              <h2 className="text-lg font-medium text-gray-900 mb-6">Other Evaluators</h2>
              {evaluations.filter(e => e.lecturerId?._id !== user?._id).map(ev => (
                <div key={ev._id} className="mb-8 opacity-80">
                  <div className="flex items-center mb-4">
                    <span className="font-semibold text-gray-700">{ev.lecturerId?.name}</span>
                    <span className="mx-2 text-gray-400">•</span>
                    <span className="text-sm text-gray-500">{ev.status}</span>
                  </div>
                  <RubricForm initialData={ev} readOnly={true} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
