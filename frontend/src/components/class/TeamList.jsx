import { useState } from 'react';
import toast from 'react-hot-toast';
import { Users, Trash2, MessageSquare, MessageSquareDashed, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { teamApi } from '../../api/teamApi';

const majorColor = (major) => {
  const palette = ['bg-blue-50 text-blue-700', 'bg-purple-50 text-purple-700', 'bg-cyan-50 text-cyan-700', 'bg-orange-50 text-orange-700', 'bg-pink-50 text-pink-700'];
  let h = 0; for (const c of (major || '')) h = c.charCodeAt(0) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
};

// Safe display: avoids rendering raw ObjectId or object
const safeName = (ref) => {
  if (!ref) return null;
  if (typeof ref === 'string') return null; // unpopulated ObjectId string — don't render
  if (typeof ref === 'object' && ref.name) return ref.name;
  return null;
};

function TeamCard({ team, onRefresh }) {
  const [expanded,  setExpanded]  = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete ${team.teamName || 'this team'}? This will also remove the chat group.`)) return;
    setDeleting(true);
    try {
      await teamApi.delete(team._id);
      toast.success(`${team.teamName || 'Team'} deleted`);
      onRefresh();
    } catch (e) {
      toast.error(e?.message || 'Failed to delete team');
    } finally {
      setDeleting(false);
    }
  };

  const members = Array.isArray(team.members) ? team.members : [];
  const lecturerName = safeName(team.lectureId);
  const mentorName   = safeName(team.mentorId);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
      {/* Team header */}
      <div className="flex items-center justify-between p-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-3 flex-1 text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <span className="text-white font-bold text-sm">{team.teamName?.replace('Team ', '') || '?'}</span>
          </div>
          <div>
            <p className="font-bold text-slate-900">{team.teamName || 'Unnamed Team'}</p>
            <p className="text-xs text-slate-400 font-mono">{team.teamCode || '—'}</p>
          </div>
          {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 ml-2" /> : <ChevronRight className="w-4 h-4 text-slate-400 ml-2" />}
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Users className="w-3.5 h-3.5" /> {members.length}
          </span>
          {/* Chat group status badge */}
          {team.chatGroupId ? (
            <span className="px-2 py-0.5 bg-green-50 text-green-600 text-xs font-semibold rounded-full flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Chat Active
            </span>
          ) : (
            <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-xs font-semibold rounded-full flex items-center gap-1">
              <MessageSquareDashed className="w-3 h-3" /> Chat not created
            </span>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Members */}
      {expanded && (
        <div className="border-t border-slate-100 p-4">
          {members.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-2">No members</p>
          ) : (
            <div className="space-y-2">
              {members.map((m, i) => {
                const s = m?.studentId;
                // Guard: studentId could be null or unpopulated ObjectId
                const studentName  = (typeof s === 'object' && s?.fullName) ? s.fullName : 'Unknown';
                const studentEmail = (typeof s === 'object' && s?.email) ? s.email : '';
                const studentMajor = (typeof s === 'object' && s?.major) ? s.major : null;
                const initial      = studentName.charAt(0)?.toUpperCase() || '?';

                return (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-secondary-300 to-secondary flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{studentName}</p>
                      {studentEmail && <p className="text-xs text-slate-400 truncate">{studentEmail}</p>}
                    </div>
                    {studentMajor && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${majorColor(studentMajor)}`}>
                        {studentMajor}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 shrink-0">{m.roleInTeam || 'Member'}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Mentor / Lecture — safe display */}
          {(lecturerName || mentorName) && (
            <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-3">
              {lecturerName && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="px-2 py-0.5 bg-secondary-50 text-secondary rounded-full font-semibold">Lecturer</span>
                  {lecturerName}
                </div>
              )}
              {mentorName && (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="px-2 py-0.5 bg-primary-50 text-primary rounded-full font-semibold">Mentor</span>
                  {mentorName}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TeamList({ teams, onRefresh }) {
  // Guard: teams might be null/undefined
  const safeTeams = Array.isArray(teams) ? teams : [];

  if (safeTeams.length === 0) {
    return (
      <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
        <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">No teams yet</p>
        <p className="text-sm mt-1">Select students above and click &quot;Create Team&quot;</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {safeTeams.map(team => (
        <TeamCard key={team._id} team={team} onRefresh={onRefresh} />
      ))}
    </div>
  );
}
