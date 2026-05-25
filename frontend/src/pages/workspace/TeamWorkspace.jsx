// frontend/src/pages/workspace/TeamWorkspace.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Users, Calendar, Mail, Loader2, FileText, UploadCloud, History,
  ChevronRight, Award, Plus, User, ArrowLeft, Download, Trash2, Shield, MapPin
} from 'lucide-react';
import toast from 'react-hot-toast';
import { workspaceApi } from '../../api/workspaceApi';
import { useAuth } from '../../hooks/useAuth';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import PitchDeckUpload from './PitchDeckUpload';
import VersionHistory from './VersionHistory';
import EvaluationPanel from '../../components/workspace/EvaluationPanel';
import MentoringPanel from '../../components/workspace/MentoringPanel';
import SprintPanel from '../../components/workspace/SprintPanel';
import WeeklyRoadmapPlanner from '../../components/workspace/WeeklyRoadmapPlanner';
import QuickShortcuts from '../../components/workspace/shortcuts/QuickShortcuts';
import CheckpointSection from '../../components/workspace/checkpoints/CheckpointSection';

const statusColors = {
  DRAFT: 'bg-slate-100 text-slate-600 border border-slate-200',
  SUBMITTED: 'bg-blue-50 text-blue-600 border border-blue-200',
  REVIEWED: 'bg-purple-50 text-purple-600 border border-purple-200',
  APPROVED: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  REJECTED: 'bg-red-50 text-red-600 border border-red-200'
};

export default function TeamWorkspace() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Initialise active tab from URL query param (?tab=roadmap)
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(location.search);
    return params.get('tab') || 'overview';
  });

  // Sync tab when query param changes externally
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) setActiveTab(tab);
  }, [location.search]);

  const fetchWorkspaceData = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      let res;
      if (teamId) {
        res = await workspaceApi.getTeamWorkspace(teamId);
      } else {
        res = await workspaceApi.getMyWorkspace();
      }

      if (res.data === null) {
        // Not assigned to team yet
        setData(null);
      } else {
        setData(res.data);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to load workspace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaceData();
  }, [teamId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-sm text-slate-400 mt-2 font-medium">Loading Startup Workspace...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12 px-4">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Access Restricted</h2>
        <p className="text-slate-500 mt-2">{errorMsg}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 px-4 bg-white rounded-2xl border border-slate-200/60 shadow-sm mt-8">
        <div className="w-16 h-16 bg-primary-50 text-primary rounded-2xl flex items-center justify-center mx-auto mb-4 border border-primary-100">
          <Users className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">No Team Assigned</h2>
        <p className="text-slate-500 mt-2 max-w-md mx-auto">
          You are currently not assigned to any startup team. Ask your lecturer or administrator to add you to a team to access the workspace.
        </p>
      </div>
    );
  }

  const { team, class: cls, members, lecturer, mentor, proposal, latestDeck, pitchDecks, versions } = data;
  const privilegedRoles = ['ADMIN', 'LECTURER', 'MENTOR'];
  const isTeamMember = members && members.some(m => m.userId?._id === user?._id);
  const isEditable = privilegedRoles.includes(user?.role) || isTeamMember;

  // Build target proposal link
  const getProposalLink = () => {
    if (teamId) {
      return `/workspace/teams/${teamId}/proposal`;
    }
    return `/student/workspace/proposal`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary flex items-center justify-center text-white shrink-0 shadow-sm">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 bg-primary-50 text-primary border border-primary-100 rounded-md">
                {cls?.classCode}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200/40 rounded-md">
                {cls?.subjectCode}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{team.teamName} Workspace</h1>
            <p className="text-sm text-slate-500 mt-0.5">{team.description || 'Startup Workspace'}</p>
          </div>
        </div>

        {teamId && (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors text-sm font-semibold px-4 py-2 border border-slate-200 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {[
          { key: 'overview', label: 'Workspace Overview' },
          { key: 'roadmap', label: 'Weekly Roadmap' },
          { key: 'evaluation', label: 'Evaluation' },
          { key: 'mentoring', label: 'Mentoring Sessions' },
          { key: 'shortcut', label: 'Quick Shortcuts' },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 py-3 px-6 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${activeTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
          >
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left Side - Proposal & PitchDecks */}
          <div className="lg:col-span-8 space-y-6">

            {/* Proposal Card */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-bold text-slate-800">Startup Proposal</h2>
                </div>
                {proposal && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase ${statusColors[proposal.status]}`}>
                    {proposal.status}
                  </span>
                )}
              </div>

              {!proposal ? (
                <div className="text-center py-8">
                  <FileText className="w-16 h-16 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 mb-4">No startup proposal has been initialized yet.</p>
                  {isEditable ? (
                    <Button variant="primary" size="sm" icon={Plus} onClick={() => navigate(getProposalLink())}>
                      Create Proposal
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-400 font-semibold bg-slate-50 px-3 py-1 rounded-lg border border-slate-200">
                      Read-only: Proposal not initialized
                    </span>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{proposal.startupName || 'Unnamed Startup'}</h3>
                    {proposal.tagline && <p className="text-sm text-slate-500 mt-1 italic">"{proposal.tagline}"</p>}
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100/60">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Problem Statement</h4>
                    <p className="text-slate-600 text-sm leading-relaxed line-clamp-3">
                      {proposal.problem || 'Not specified yet.'}
                    </p>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-100/60">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Value Proposition</h4>
                    <p className="text-slate-600 text-sm leading-relaxed line-clamp-3">
                      {proposal.valueProposition || 'Not specified yet.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-400">
                      Last updated {new Date(proposal.updatedAt).toLocaleDateString()}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(getProposalLink() + '?preview=true')}
                      >
                        View Full Proposal
                      </Button>
                      {isEditable && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(getProposalLink())}
                        >
                          Edit Proposal
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Pitch Decks */}
            <PitchDeckUpload
              teamId={team._id}
              latestDeck={latestDeck}
              pitchDecks={pitchDecks}
              isEditable={isEditable}
              onRefresh={fetchWorkspaceData}
            />

            {/* Startup Checkpoints */}
            <CheckpointSection 
              teamId={team._id} 
              isEditable={isEditable}
            />
          </div>

          {/* Right Side - Team & Versions */}
          <div className="lg:col-span-4 space-y-6">

            {/* Stakeholders Info */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 space-y-4">
              <h3 className="font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Members & Mentors
              </h3>

              {/* Lecturer */}
              {lecturer && (
                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lecturer</p>
                  <div className="flex items-center gap-2.5 mt-1.5">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold text-xs">
                      {lecturer.name?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{lecturer.name}</p>
                      <p className="text-xs text-slate-400 truncate flex items-center gap-1"><Mail className="w-3 h-3" />{lecturer.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Mentor */}
              <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mentor</p>
                {mentor ? (
                  <div className="flex items-center gap-2.5 mt-1.5">
                    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-semibold text-xs">
                      {mentor.name?.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{mentor.name}</p>
                      <p className="text-xs text-slate-400 truncate flex items-center gap-1"><Mail className="w-3 h-3" />{mentor.email}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-1 italic">No mentor assigned yet</p>
                )}
              </div>

              {/* Members List */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Startup Team Members</p>
                <div className="space-y-2">
                  {members && members.map(member => (
                    <div key={member._id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50/60 border border-transparent hover:border-slate-100 transition-all">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary font-bold text-xs">
                          {member.fullName?.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{member.fullName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{member.rollNumber}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">
                        {member.roleInTeam || 'Member'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Proposal Version History */}
            {proposal && (
              <VersionHistory
                proposalId={proposal._id}
                versions={versions}
                isEditable={isEditable}
                onRefresh={fetchWorkspaceData}
              />
            )}

          </div>
        </div>
      )}

      {activeTab === 'roadmap' && (() => {
        // Map TeamWorkspace variables to WeeklyRoadmapPlanner props
        const courseCode = cls?.subjectCode || '';
        const classId = cls?._id || '';
        const teamIdProp = team?._id || '';
        // Find the current user's roleInTeam from members array
        const myMember = members?.find(m => m.userId?._id === user?._id || m.userId === user?._id);
        const roleInTeam = myMember?.roleInTeam || '';

        return (
          <WeeklyRoadmapPlanner
            courseCode={courseCode}
            classId={String(classId)}
            teamId={String(teamIdProp)}
            currentUser={user}
            roleInTeam={roleInTeam}
            teamMembers={members || []}
          />
        );
      })()}

      {activeTab === 'evaluation' && (
        <EvaluationPanel
          teamId={team._id}
          proposalId={proposal?._id}
          pitchDeckId={latestDeck?._id}
        />
      )}

      {activeTab === 'mentoring' && (
        <MentoringPanel teamId={team._id} />
      )}

      {activeTab === 'sprint' && (
        <SprintPanel teamId={team._id} members={members} isEditable={isEditable} />
      )}

      {activeTab === 'shortcut' && (
        <QuickShortcuts teamId={team._id} isEditable={isEditable} />
      )}
    </div>
  );
}
