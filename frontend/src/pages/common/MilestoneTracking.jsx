import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { milestoneApi } from '../../api/milestoneApi';
import { dashboardApi } from '../../api/dashboardApi';
import { useAuth } from '../../hooks/useAuth';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Modal from '../../components/ui/Modal';
import { CheckSquare, Plus, Trash2, Edit } from 'lucide-react';

const COLUMNS = [
  { key: 'TODO', label: '📋 To Do', color: 'bg-slate-100 border-slate-200' },
  { key: 'IN_PROGRESS', label: '🔄 In Progress', color: 'bg-blue-50 border-blue-200' },
  { key: 'DONE', label: '✅ Done', color: 'bg-green-50 border-green-200' },
  { key: 'OVERDUE', label: '⚠️ Overdue', color: 'bg-red-50 border-red-200' },
];

// const statusColors = {
//   TODO: 'bg-slate-100 text-slate-600',
//   IN_PROGRESS: 'bg-blue-100 text-blue-700',
//   DONE: 'bg-green-100 text-green-700',
//   OVERDUE: 'bg-red-100 text-red-700',
// };

const MilestoneTracking = () => {
  const { user } = useAuth();
  const [milestones, setMilestones] = useState([]);
  const [teamId, setTeamId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', status: 'TODO' });

  const fetchData = async () => {
    try {
      setLoading(true);
      if (user?.role === 'STUDENT' || user?.role === 'LECTURER') {
        const res = await dashboardApi.getStudent();
        const d = res.data || res;
        if (d.team?._id) {
          setTeamId(d.team._id);
          const mRes = await milestoneApi.getByTeam(d.team._id);
          const list = mRes.data?.milestones || mRes.milestones || mRes.data || [];
          // Mark overdue
          const now = new Date();
          const processed = list.map(m => {
            if (m.status !== 'DONE' && new Date(m.dueDate) < now) return { ...m, status: 'OVERDUE' };
            return m;
          });
          setMilestones(Array.isArray(processed) ? processed : []);
        }
      }
    } catch {
      toast.error('Failed to load milestones');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => {
    setEditingMilestone(null);
    setForm({ title: '', description: '', dueDate: '', status: 'TODO' });
    setIsModalOpen(true);
  };

  const openEdit = (m) => {
    setEditingMilestone(m);
    setForm({ title: m.title, description: m.description || '', dueDate: m.dueDate ? m.dueDate.slice(0, 10) : '', status: m.status });
    setIsModalOpen(true);
  };

  
  const handleDelete = (id) => {
    setDeleteTarget({ id });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await milestoneApi.delete(deleteTarget.id);
      setMilestones(milestones.filter(m => m._id !== deleteTarget.id));
      toast.success('Milestone deleted!');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete milestone');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMove = async (milestone, newStatus) => {
    try {
      await milestoneApi.update(milestone._id, { status: newStatus });
      setMilestones(milestones.map(m => m._id === milestone._id ? { ...m, status: newStatus } : m));
    } catch { toast.error('Failed to update'); }
  };

  const handleSubmit = async () => {
    if (!form.title) { toast.error('Title required'); return; }
    if (!teamId) { toast.error('No team found'); return; }
    setIsSubmitting(true);
    try {
      if (editingMilestone) {
        const res = await milestoneApi.update(editingMilestone._id, form);
        const updated = res.data?.milestone || res.milestone || { ...editingMilestone, ...form };
        setMilestones(milestones.map(m => m._id === editingMilestone._id ? updated : m));
        toast.success('Milestone updated!');
      } else {
        const res = await milestoneApi.create({ ...form, teamId });
        const newM = res.data?.milestone || res.milestone || res.data;
        if (newM) setMilestones([...milestones, newM]);
        toast.success('Milestone created!');
      }
      setIsModalOpen(false);
    } catch { toast.error('Failed to save'); }
    finally { setIsSubmitting(false); }
  };

  if (loading) return <LoadingSkeleton />;

  const byStatus = (status) => milestones.filter(m => m.status === status);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Milestone Kanban</h1>
          <p className="text-slate-500 mt-1">{milestones.length} milestones • Track your startup progress</p>
        </div>
        {teamId && <Button variant="gradient" size="sm" icon={Plus} onClick={openAdd}>Add Milestone</Button>}
      </div>

      {milestones.length === 0 && !teamId ? (
        <EmptyState icon={CheckSquare} title="No team found" description="Join a team to track milestones" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLUMNS.map(col => (
            <div key={col.key}>
              <div className={`rounded-2xl border-2 ${col.color} p-4 space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-700 text-sm">{col.label}</h3>
                  <span className="text-xs font-bold bg-white/80 text-slate-500 px-2 py-0.5 rounded-full">{byStatus(col.key).length}</span>
                </div>

                {byStatus(col.key).length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">No items</div>
                ) : (
                  byStatus(col.key).map(m => (
                    <motion.div
                      key={m._id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white rounded-xl p-3.5 shadow-sm border border-white/60 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-slate-900 leading-tight">{m.title}</h4>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => openEdit(m)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-primary"><Edit className="w-3 h-3" /></button>
                          <button onClick={() => handleDelete(m._id)} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                      {m.description && <p className="text-xs text-slate-500 mb-2 line-clamp-2">{m.description}</p>}
                      {m.dueDate && (
                        <p className={`text-xs font-medium ${m.status === 'OVERDUE' ? 'text-red-600' : 'text-slate-400'}`}>
                          📅 {new Date(m.dueDate).toLocaleDateString()}
                        </p>
                      )}
                      {/* Move buttons */}
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {COLUMNS.filter(c => c.key !== col.key && c.key !== 'OVERDUE').map(c => (
                          <button key={c.key} onClick={() => handleMove(m, c.key)} className="text-[10px] px-1.5 py-0.5 bg-slate-100 hover:bg-primary hover:text-white text-slate-500 rounded font-medium transition-all">
                            → {c.key.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  ))
                )}

                {col.key === 'TODO' && teamId && (
                  <button onClick={openAdd} className="w-full border-2 border-dashed border-slate-200 rounded-xl py-2 text-xs text-slate-400 hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-1">
                    <Plus className="w-3 h-3" /> Add milestone
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMilestone ? 'Edit Milestone' : 'Add Milestone'}
        submitText={editingMilestone ? 'Save' : 'Create'}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. MVP Prototype" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
              <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {['TODO', 'IN_PROGRESS', 'DONE'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Delete Milestone`}
        description={`Are you sure you want to delete ${deleteTarget?.name || deleteTarget?.title || 'this item'}? This action cannot be undone.`}
        isSubmitting={isDeleting}
      />
    </div>
  );
};
export default MilestoneTracking;
