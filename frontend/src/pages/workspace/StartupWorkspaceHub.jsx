// Hub: list teams the user can open in Startup Workspace (Admin / Lecturer / Mentor)
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Kanban, Search, Loader2, Users, ChevronRight, FileText, Flag,
  GraduationCap, Award,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { workspaceApi } from '../../api/workspaceApi';
import { useAuth } from '../../hooks/useAuth';
import EmptyState from '../../components/ui/EmptyState';

const roleHint = {
  ADMIN: 'All startup teams in the system',
  LECTURER: 'Teams in classes you teach',
  MENTOR: 'Teams you mentor',
};

export default function StartupWorkspaceHub() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const role = (user?.role || 'STUDENT').toUpperCase();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await workspaceApi.getAccessibleTeams();
        if (res.success) {
          setTeams(res.data?.teams || []);
        }
      } catch (e) {
        toast.error(e?.message || 'Failed to load teams');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teams;
    return teams.filter((t) => {
      const cls = t.class?.classCode || '';
      return (
        t.teamName?.toLowerCase().includes(q) ||
        t.teamCode?.toLowerCase().includes(q) ||
        t.startupName?.toLowerCase().includes(q) ||
        cls.toLowerCase().includes(q)
      );
    });
  }, [teams, search]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-9 h-9 text-primary animate-spin" />
        <p className="text-sm text-slate-500 mt-3 font-medium">Loading startup workspaces…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white shadow-sm">
              <Kanban className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Startup Workspace</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {roleHint[role] || 'Teams you can access'}
              </p>
            </div>
          </div>
        </div>
        <p className="text-sm font-semibold text-slate-600 bg-white border border-slate-200/80 px-4 py-2 rounded-xl shadow-sm">
          {teams.length} team{teams.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search team, class code, startup name…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Kanban}
          title={teams.length === 0 ? 'No teams available' : 'No matches'}
          description={
            teams.length === 0
              ? 'You are not assigned to any class teams yet, or teams have not been created.'
              : 'Try a different search term.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((team) => (
            <button
              key={team._id}
              type="button"
              onClick={() => navigate(`/workspace/teams/${team._id}`)}
              className="group text-left bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary-50 px-2 py-0.5 rounded-md">
                    {team.class?.classCode || 'Class'}
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 mt-2 group-hover:text-primary transition-colors truncate">
                    {team.teamName}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{team.teamCode}</p>
                  {team.startupName && (
                    <p className="text-sm text-slate-600 mt-2 truncate">{team.startupName}</p>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary shrink-0 mt-1" />
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
                  <Users className="w-3 h-3" /> {team.memberCount} members
                </span>
                {team.proposalStatus && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                    <FileText className="w-3 h-3" /> {team.proposalStatus}
                  </span>
                )}
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-orange-50 text-orange-700 border border-orange-100">
                  <Flag className="w-3 h-3" /> {team.checkpointFileCount} checkpoint file{team.checkpointFileCount !== 1 ? 's' : ''}
                </span>
              </div>

              {(team.lecturer || team.mentor) && (
                <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-400">
                  {team.lecturer && (
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3 h-3" /> {team.lecturer.name}
                    </span>
                  )}
                  {team.mentor && (
                    <span className="flex items-center gap-1">
                      <Award className="w-3 h-3" /> {team.mentor.name}
                    </span>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center pb-4">
        View-only for your role: you can review proposals, pitch decks, and checkpoint submissions. Upload is reserved for students.
      </p>
    </div>
  );
}
