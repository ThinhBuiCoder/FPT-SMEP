import React, { useState, useEffect } from 'react';
import { getProposalComments, createProposalComment, resolveComment } from '../../api/commentApi';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

export default function InlineCommentUI({ proposalId, sectionKey }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [newComment, setNewComment] = useState('');

  const isStudent = user?.role === 'STUDENT' || user?.role === 'USER';

  useEffect(() => {
    if (proposalId && isOpen) {
      fetchComments();
    }
  }, [proposalId, isOpen]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const res = await getProposalComments(proposalId);
      if (res.success) {
        setComments(res.data.filter(c => c.sectionKey === sectionKey));
      }
    } catch (err) {
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const res = await createProposalComment(proposalId, { sectionKey, content: newComment });
      if (res.success) {
        toast.success('Comment added');
        setNewComment('');
        fetchComments();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add comment');
    }
  };

  const handleResolve = async (commentId) => {
    try {
      const res = await resolveComment(commentId);
      if (res.success) {
        toast.success('Comment resolved');
        fetchComments();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resolve comment');
    }
  };

  const activeComments = comments.filter(c => !c.resolved);
  const resolvedComments = comments.filter(c => c.resolved);

  return (
    <div className="mt-2">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 bg-gray-50 px-2 py-1 rounded"
      >
        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
        {activeComments.length > 0 ? `${activeComments.length} active comments` : 'Comments'}
      </button>

      {isOpen && (
        <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 shadow-inner">
          {loading ? (
            <div className="text-sm text-gray-500">Loading comments...</div>
          ) : (
            <div className="space-y-4">
              {activeComments.map(c => (
                <div key={c._id} className="bg-white p-3 rounded shadow-sm border border-gray-200">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-sm text-gray-800">{c.createdBy?.name}</span>
                      <span className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    {(!isStudent || c.createdBy?._id === user?._id) && (
                      <button onClick={() => handleResolve(c._id)} className="text-xs text-green-600 hover:text-green-800">Resolve</button>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{c.content}</p>
                </div>
              ))}

              {resolvedComments.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Resolved Comments</p>
                  {resolvedComments.map(c => (
                    <div key={c._id} className="bg-gray-100 p-3 rounded mb-2 opacity-75">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-gray-600">{c.createdBy?.name}</span>
                        <span className="text-xs text-gray-500">Resolved by {c.resolvedBy?.name}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 line-through">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeComments.length === 0 && resolvedComments.length === 0 && (
                <p className="text-sm text-gray-500 italic">No comments yet for this section.</p>
              )}

              {!isStudent && (
                <form onSubmit={handleAddComment} className="mt-4">
                  <textarea
                    rows="2"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="block w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 mb-2"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!newComment.trim()}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      Post Comment
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
