import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckSquare, Plus, Trash2, Edit, ChevronDown, Clock, AlertTriangle, Tag, User, MapPin, CheckCircle2, Loader2, Search, Filter
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { dashboardApi } from '../../api/dashboardApi';
import { teamApi } from '../../api/teamApi';
import { getTeamTaskBoard, createWeeklyTask, updateWeeklyTask, deleteWeeklyTask, updateWeeklyTaskStatus } from '../../api/weeklyTaskApi';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import ConfirmDialog from '../../components/ui/ConfirmDialog';

// ─── Constants ────────────────────────────────────────────────────────────────
const WEEKS = Array.from({ length: 10 }, (_, i) => i + 1);
const STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'OVERDUE'];
const STATUS_CFG = {
  TODO:        { label: 'To Do',      bg: 'bg-slate-100',   text: 'text-slate-600',  dot: 'bg-slate-400', border: 'border-slate-200' },
  IN_PROGRESS: { label: 'In Progress',bg: 'bg-blue-50',     text: 'text-blue-600',   dot: 'bg-blue-500',  border: 'border-blue-200' },
  REVIEW:      { label: 'Review',     bg: 'bg-violet-50',   text: 'text-violet-600', dot: 'bg-violet-500',border: 'border-violet-200' },
  COMPLETED:   { label: 'Completed',  bg: 'bg-emerald-50',  text: 'text-emerald-600',dot: 'bg-emerald-500',border: 'border-emerald-200'},
  OVERDUE:     { label: 'Overdue',    bg: 'bg-red-50',      text: 'text-red-600',    dot: 'bg-red-500',   border: 'border-red-200' },
};

const PRIORITY_CFG = {
  LOW:      { label: 'Low',      bg: 'bg-slate-100',  text: 'text-slate-500'  },
  MEDIUM:   { label: 'Medium',   bg: 'bg-blue-50',    text: 'text-blue-600'   },
  HIGH:     { label: 'High',     bg: 'bg-amber-50',   text: 'text-amber-600'  },
  CRITICAL: { label: 'Critical', bg: 'bg-red-50',     text: 'text-red-600'    },
};

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
const Badge = ({ children, className = '' }) => (
  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${className}`}>{children}</span>
);

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG.TODO;
  return (
    <Badge className={`${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
    </Badge>
  );
};

const PriorityBadge = ({ priority }) => {
  const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG.MEDIUM;
  return <Badge className={`${cfg.bg} ${cfg.text}`}>{cfg.label}</Badge>;
};

// ─── TaskCard ─────────────────────────────────────────────────────────────────
function TaskCard({ task, canEdit, canDelete, canUpdateSts, onEdit, onDelete, onStatusChange, onMarkComplete }) {
  const [statusOpen, setStatusOpen] = useState(false);

  const checklist = task.checklist || [];
  const checklistDone = checklist.filter(c => c.isCompleted).length;
  const assigneeName = task.assigneeStudentId?.fullName || task.assigneeStudentId?.rollNumber || null;
  const dueDateStr = task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : null;
  
  const currentStatus = task.computedStatus || task.status;
  const isOverdue = currentStatus === 'OVERDUE';

  return (
    <div className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow duration-200 ${isOverdue ? 'border-red-200' : 'border-slate-200/80'}`}>
      <div className={`h-0.5 rounded-t-xl ${
        task.priority === 'CRITICAL' ? 'bg-red-500' : task.priority === 'HIGH' ? 'bg-amber-400' : task.priority === 'MEDIUM' ? 'bg-blue-400' : 'bg-slate-200'
      }`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap gap-1">
            <StatusBadge status={currentStatus} />
            <PriorityBadge priority={task.priority} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && (
              <button onClick={() => onEdit(task)} title="Edit" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && (
              <button onClick={() => onDelete(task._id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <h4 className="text-sm font-semibold text-slate-800 leading-snug mb-1">{task.title}</h4>
        {task.description && <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-2">{task.description}</p>}

        {checklist.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>Checklist</span><span>{checklistDone}/{checklist.length}</span>
            </div>
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${(checklistDone / checklist.length) * 100}%` }} />
            </div>
          </div>
        )}

        {checklist.length === 0 && task.completionPercentage > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>Progress</span><span>{task.completionPercentage}%</span>
            </div>
            <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${task.completionPercentage}%` }} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 mt-2">
          <span className="font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">W{task.weekNumber}</span>
          {assigneeName && <span className="flex items-center gap-1"><User className="w-3 h-3" />{assigneeName}</span>}
          {dueDateStr && <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-semibold' : ''}`}><Clock className="w-3 h-3" />{dueDateStr}</span>}
        </div>

        {canUpdateSts && currentStatus !== 'COMPLETED' && (
          <div className="mt-3 flex items-center gap-2 pt-3 border-t border-slate-100">
            <button onClick={() => onMarkComplete(task._id)} className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" />Mark Complete
            </button>

            <div className="relative ml-auto">
              <button onClick={() => setStatusOpen(p => !p)} className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors">
                Move <ChevronDown className="w-3 h-3" />
              </button>
              {statusOpen && (
                <div className="absolute right-0 bottom-full mb-1 z-20 bg-white rounded-xl shadow-lg border border-slate-200/80 py-1 min-w-[140px]">
                  {STATUSES.filter(s => s !== currentStatus).map(s => {
                    const cfg = STATUS_CFG[s];
                    return (
                      <button key={s} onClick={() => { onStatusChange(task._id, s); setStatusOpen(false); }} className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors">
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TeamTaskModal ──────────────────────────────────────────────────────────
function TeamTaskModal({ isOpen, onClose, onSave, task, teamMembers, loading }) {
  const isEdit = !!task;

  const [form, setForm] = useState({
    title: '', description: '', priority: 'MEDIUM', weekNumber: 1,
    startDate: '', dueDate: '', assigneeStudentId: '', estimatedHours: '', tags: '', checklist: [],
  });
  const [newCheckItem, setNewCheckItem] = useState('');

  useEffect(() => {
    if (task) {
      setForm({
        title: task.title || '', description: task.description || '', priority: task.priority || 'MEDIUM', weekNumber: task.weekNumber || 1,
        startDate: task.startDate ? task.startDate.slice(0, 10) : '', dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
        assigneeStudentId: task.assigneeStudentId?._id || task.assigneeStudentId || '', estimatedHours: task.estimatedHours || '',
        tags: (task.tags || []).join(', '), checklist: task.checklist || [],
      });
    } else {
      setForm({
        title: '', description: '', priority: 'MEDIUM', weekNumber: 1,
        startDate: '', dueDate: '', assigneeStudentId: '', estimatedHours: '', tags: '', checklist: [],
      });
    }
    setNewCheckItem('');
  }, [task, isOpen]);

  if (!isOpen) return null;

  const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }

    const today = new Date().toISOString().split('T')[0];

    if (form.startDate && form.startDate < today) {
      toast.error('Start date cannot be in the past'); return;
    }
    if (form.dueDate && form.dueDate < today) {
      toast.error('Due date cannot be in the past'); return;
    }
    if (form.startDate && form.dueDate && form.dueDate < form.startDate) {
      toast.error('Due date must be on or after start date'); return;
    }

    const payload = {
      ...form,
      taskType: 'TEAM_TASK',
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      estimatedHours: Number(form.estimatedHours) || 0,
      assigneeStudentId: form.assigneeStudentId || undefined,
      startDate: form.startDate || undefined,
      dueDate: form.dueDate || undefined,
    };
    onSave(payload);
  };

  const addCheckItem = () => {
    const t = newCheckItem.trim();
    if (!t) return;
    set('checklist', [...form.checklist, { text: t, isCompleted: false }]);
    setNewCheckItem('');
  };

  const removeCheckItem = (idx) => set('checklist', form.checklist.filter((_, i) => i !== idx));
  const toggleCheckItem = (idx) => set('checklist', form.checklist.map((c, i) => i === idx ? { ...c, isCompleted: !c.isCompleted } : c));

  const inputCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white';
  const labelCls = 'block text-xs font-semibold text-slate-600 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">{isEdit ? 'Edit Team Task' : 'New Team Task'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div><label className={labelCls}>Title *</label><input className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} required /></div>
          <div><label className={labelCls}>Description</label><textarea className={`${inputCls} resize-none`} rows={3} value={form.description} onChange={e => set('description', e.target.value)} /></div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Week Number *</label>
              <select className={inputCls} value={form.weekNumber} onChange={e => set('weekNumber', Number(e.target.value))}>
                {WEEKS.map(w => <option key={w} value={w}>Week {w}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Priority</label>
              <select className={inputCls} value={form.priority} onChange={e => set('priority', e.target.value)}>
                {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <option key={p} value={p}>{PRIORITY_CFG[p].label}</option>)}
              </select>
            </div>
          </div>

          {teamMembers?.length > 0 && (
            <div>
              <label className={labelCls}>Assignee</label>
              <select className={inputCls} value={form.assigneeStudentId} onChange={e => set('assigneeStudentId', e.target.value)}>
                <option value="">Unassigned</option>
                {teamMembers.map(m => {
                  const id = m._id || m.studentId?._id || m.userId?._id;
                  const name = m.fullName || m.studentId?.fullName || m.userId?.name || 'Member';
                  return <option key={id} value={id}>{name}</option>;
                })}
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls}>Start Date</label><input type="date" className={inputCls} min={new Date().toISOString().split('T')[0]} value={form.startDate} onChange={e => set('startDate', e.target.value)} /></div>
            <div><label className={labelCls}>Due Date</label><input type="date" className={inputCls} min={form.startDate || new Date().toISOString().split('T')[0]} value={form.dueDate} onChange={e => set('dueDate', e.target.value)} /></div>
            <div><label className={labelCls}>Est. Hours</label><input type="number" min="0" step="0.5" className={inputCls} value={form.estimatedHours} onChange={e => set('estimatedHours', e.target.value)} /></div>
          </div>

          <div>
            <label className={labelCls}>Checklist</label>
            <div className="space-y-2 mb-2">
              {form.checklist.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input type="checkbox" checked={item.isCompleted} onChange={() => toggleCheckItem(idx)} className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600" />
                  <span className={`flex-1 text-sm ${item.isCompleted ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.text}</span>
                  <button type="button" onClick={() => removeCheckItem(idx)} className="text-slate-300 hover:text-red-500 text-xs">✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className={`${inputCls} flex-1`} placeholder="Add item…" value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCheckItem())} />
              <button type="button" onClick={addCheckItem} className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg">Add</button>
            </div>
          </div>
        </form>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Team Execution Board ──────────────────────────────────────────────────
export default function MilestoneTracking() {
  const { user } = useAuth();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const queryTeamId = queryParams.get('teamId');

  const [teamId, setTeamId] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  
  const [tasks, setTasks] = useState([]);
  const [groupedTasks, setGroupedTasks] = useState({ TODO: [], IN_PROGRESS: [], REVIEW: [], COMPLETED: [], OVERDUE: [] });
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [filterWeek, setFilterWeek] = useState('ALL');
  const [filterAssignee, setFilterAssignee] = useState('ALL');
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterSearch, setFilterSearch] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Determine permissions
  const role = user?.role?.toUpperCase() || '';
  const isAdmin = role === 'ADMIN';
  const isLecturer = role === 'LECTURER';
  const isMentor = role === 'MENTOR';
  const isTeamMemberContext = !!teamId && (role === 'STUDENT' || role === 'USER');
  
  const canCreateTeamTask = isAdmin || isLecturer || isMentor || isTeamMemberContext;
  
  const canEditTask = (task) => {
    if (isAdmin || isLecturer || isMentor) return true;
    if (!isTeamMemberContext) return false;
    const createdById = String(task?.createdBy?._id || task?.createdBy || '');
    const currentUserId = String(user?._id || '');
    return createdById === currentUserId;
  };
  const canUpdateStatus = () => isAdmin || isLecturer || isMentor || isTeamMemberContext;
  const canDeleteTask = (task) => {
    if (isAdmin || isLecturer || isMentor) return true;
    if (!isTeamMemberContext) return false;
    const createdById = String(task?.createdBy?._id || task?.createdBy || '');
    const currentUserId = String(user?._id || '');
    return createdById === currentUserId;
  };

  const resolveTeam = useCallback(async () => {
    try {
      if (role === 'STUDENT' || role === 'USER') {
        const res = await dashboardApi.getStudent();
        const d = res.data || res;
        if (d.team?._id) return d.team._id;
      } else if (queryTeamId) {
        return queryTeamId;
      }
      return null;
    } catch {
      return null;
    }
  }, [role, queryTeamId]);

  const loadBoard = useCallback(async (currentTeamId) => {
    if (!currentTeamId) return;
    try {
      setError(null);
      const params = {};
      if (filterWeek !== 'ALL') params.weekNumber = filterWeek;
      if (filterAssignee !== 'ALL') params.assigneeStudentId = filterAssignee;
      if (filterPriority !== 'ALL') params.priority = filterPriority;
      if (filterSearch.trim()) params.search = filterSearch;

      const res = await getTeamTaskBoard(currentTeamId, params);
      const data = res.data?.data || res.data || res;
      setTasks(data.tasks || []);
      setGroupedTasks(data.grouped || { TODO: [], IN_PROGRESS: [], REVIEW: [], COMPLETED: [], OVERDUE: [] });
      setSummary(data.summary);
      
      // Fetch members if empty
      if (teamMembers.length === 0) {
        const tRes = await teamApi.getById(currentTeamId);
        const tData = tRes.data?.team || tRes.data;
        if (tData?.members) setTeamMembers(tData.members);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load execution board');
    } finally {
      setLoading(false);
    }
  }, [filterWeek, filterAssignee, filterPriority, filterSearch, teamMembers.length]);

  useEffect(() => {
    setLoading(true);
    resolveTeam().then(tid => {
      setTeamId(tid);
      if (tid) {
        loadBoard(tid);
      } else {
        setLoading(false);
      }
    });
  }, [resolveTeam, loadBoard]);

  const handleSave = async (payload) => {
    try {
      setActionLoading(true);
      if (editingTask) {
        await updateWeeklyTask(editingTask._id, payload);
        toast.success('Task updated');
      } else {
        await createWeeklyTask({ ...payload, teamId });
        toast.success('Task created');
      }
      setModalOpen(false);
      loadBoard(teamId);
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to save task');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (taskId, status) => {
    try {
      setActionLoading(true);
      await updateWeeklyTaskStatus(taskId, { status });
      toast.success('Status updated');
      loadBoard(teamId);
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setActionLoading(true);
      await deleteWeeklyTask(deleteTarget._id);
      toast.success('Task deleted');
      setDeleteTarget(null);
      loadBoard(teamId);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete task');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  if (!teamId) {
    return (
      <EmptyState 
        icon={CheckSquare} 
        title={role === 'STUDENT' ? "No Team Assigned" : "Team Workspace Required"} 
        description={role === 'STUDENT' ? "You need to be part of a team to view the execution board." : "Please navigate to a specific Team Workspace and access the execution board from there."} 
      />
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-red-600 font-semibold">{error}</p>
        <button onClick={() => loadBoard(teamId)} className="mt-4 text-sm text-red-600 hover:text-red-800 font-medium underline">Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <CheckSquare className="w-6 h-6 text-blue-600" />
              Team Execution Board
            </h1>
            <p className="text-slate-500 text-sm mt-1">Track startup team tasks across roadmap weeks</p>
          </div>
          {canCreateTeamTask && (
            <button onClick={() => { setEditingTask(null); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-sm font-semibold text-sm">
              <Plus className="w-4 h-4" /> Add Team Task
            </button>
          )}
        </div>

        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
            {[
              { l: 'Total', v: summary.total, c: 'bg-slate-100 text-slate-700' },
              { l: 'Completed', v: summary.completed, c: 'bg-emerald-100 text-emerald-800' },
              { l: 'In Progress', v: summary.inProgress, c: 'bg-blue-100 text-blue-800' },
              { l: 'Overdue', v: summary.overdue, c: 'bg-red-100 text-red-800' },
              { l: 'Completion', v: `${summary.completionPercentage}%`, c: 'bg-violet-100 text-violet-800' }
            ].map(s => (
              <div key={s.l} className={`px-4 py-3 rounded-xl ${s.c} flex flex-col items-center justify-center`}>
                <span className="text-xl font-bold">{s.v}</span>
                <span className="text-xs font-semibold uppercase tracking-wider opacity-80">{s.l}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search tasks..." value={filterSearch} onChange={e => setFilterSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-full" />
          </div>
          <select value={filterWeek} onChange={e => setFilterWeek(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none cursor-pointer">
            <option value="ALL">All Weeks</option>
            {WEEKS.map(w => <option key={w} value={w}>Week {w}</option>)}
          </select>
          <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none cursor-pointer">
            <option value="ALL">All Members</option>
            {teamMembers.map(m => {
              const id = m._id || m.studentId?._id || m.userId?._id;
              const name = m.fullName || m.studentId?.fullName || m.userId?.name || 'Member';
              return <option key={id} value={id}>{name}</option>;
            })}
          </select>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none cursor-pointer">
            <option value="ALL">All Priorities</option>
            {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(p => <option key={p} value={p}>{PRIORITY_CFG[p].label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
        {STATUSES.map(status => {
          const cfg = STATUS_CFG[status];
          const colTasks = groupedTasks[status] || [];
          return (
            <div key={status} className={`flex-none w-[320px] rounded-2xl border-2 ${cfg.border} bg-slate-50/50 flex flex-col max-h-[800px] snap-center`}>
              <div className={`p-4 border-b-2 ${cfg.border} bg-white rounded-t-xl flex items-center justify-between sticky top-0 z-10`}>
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                </h3>
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{colTasks.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {colTasks.length === 0 ? (
                  <div className="text-center py-8 text-xs font-medium text-slate-400">No tasks in this status</div>
                ) : (
                  colTasks.map(task => (
                    <TaskCard 
                      key={task._id} task={task} 
                      canEdit={canEditTask(task)} 
                      canDelete={canDeleteTask(task)} 
                      canUpdateSts={canUpdateStatus()} 
                      onEdit={t => { setEditingTask(t); setModalOpen(true); }}
                      onDelete={() => setDeleteTarget(task)}
                      onStatusChange={handleStatusChange}
                      onMarkComplete={tid => handleStatusChange(tid, 'COMPLETED')}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TeamTaskModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSave} task={editingTask} teamMembers={teamMembers} loading={actionLoading} />
      
      <ConfirmDialog isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} title="Delete Task" description="Are you sure you want to delete this task? This action cannot be undone." isSubmitting={actionLoading} />
    </div>
  );
}
