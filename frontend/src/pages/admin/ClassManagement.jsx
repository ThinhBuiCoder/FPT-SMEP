import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Plus, GraduationCap, Edit, Trash2, RefreshCw } from 'lucide-react';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ProgressBar from '../../components/ui/ProgressBar';
import Modal from '../../components/ui/Modal';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import { classApi } from '../../api/classApi';
import { userApi } from '../../api/userApi';

const ClassManagement = () => {
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lecturers, setLecturers] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', semester: 'Fall 2024', description: '', lecturerId: '' });

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [clsRes, usrRes] = await Promise.all([classApi.getAll(), userApi.getAll({ role: 'LECTURER' })]);
      const list = clsRes.data?.classes || clsRes.classes || clsRes.data || [];
      const lects = usrRes.data?.users || usrRes.users || usrRes.data || [];
      setClasses(Array.isArray(list) ? list : []);
      setLecturers(Array.isArray(lects) ? lects.filter(u => u.role === 'LECTURER') : []);
    } catch {
      toast.error('Failed to load classes');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchAll(); }, []);

  const openAdd = () => {
    setEditingClass(null);
    setFormData({ name: '', code: '', semester: 'Fall 2024', description: '', lecturerId: lecturers[0]?._id || '' });
    setIsModalOpen(true);
  };

  const openEdit = (e, cls) => {
    e.stopPropagation();
    setEditingClass(cls);
    setFormData({ name: cls.name, code: cls.code, semester: cls.semester, description: cls.description, lecturerId: cls.lecturerId?._id || cls.lecturerId || '' });
    setIsModalOpen(true);
  };

  
  const handleDelete = (e, id, name) => {
    setDeleteTarget({ e, id, name });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await classApi.delete(deleteTarget.id);
      setClasses(classes.filter(c => c._id !== deleteTarget.id));
      toast.success('Class deleted!');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete class');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.code || !formData.lecturerId) {
      toast.error('Fill in all required fields');
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingClass) {
        const res = await classApi.update(editingClass._id, formData);
        const updated = res.data?.class || res.class || { ...editingClass, ...formData };
        setClasses(classes.map(c => c._id === editingClass._id ? updated : c));
        toast.success('Class updated!');
      } else {
        const res = await classApi.create(formData);
        const newClass = res.data?.class || res.class || res.data;
        if (newClass) setClasses([newClass, ...classes]);
        toast.success('Class created!');
      }
      setIsModalOpen(false);
      fetchAll(); // Refresh to get populated data
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Class Management</h1>
          <p className="text-slate-500 mt-1">{classes.length} active startup incubation classes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchAll}>Refresh</Button>
          <Button variant="gradient" size="sm" icon={Plus} onClick={openAdd}>Create Class</Button>
        </div>
      </div>

      {classes.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No classes yet" description="Create your first class to get started" action={{ label: 'Create Class', onClick: openAdd }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {classes.map((cls, i) => (
            <motion.div
              key={cls._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 hover:shadow-md hover:-translate-y-1 transition-all group relative"
            >
              {/* Actions on hover */}
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-xl shadow-sm border border-slate-100">
                <button className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-primary-50 transition-all" onClick={(e) => openEdit(e, cls)}><Edit className="w-4 h-4" /></button>
                <button className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all" onClick={(e) => handleDelete(e, cls._id, cls.name)}><Trash2 className="w-4 h-4" /></button>
              </div>

              <div className="mb-4">
                <p className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">{cls.semester}</p>
                <h3 className="text-xl font-bold text-slate-900">{cls.code}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{cls.name}</p>
              </div>

              {cls.lecturerId && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase">Lecturer</p>
                    <p className="text-sm font-medium text-slate-800">{cls.lecturerId?.name || 'Unknown'}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-xs text-slate-400 uppercase mb-1">Members</p>
                  <p className="text-xl font-bold text-slate-900">{cls.members?.length || 0}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-xs text-slate-400 uppercase mb-1">Teams</p>
                  <p className="text-xl font-bold text-slate-900">{cls.teamCount || 0}</p>
                </div>
              </div>

              <ProgressBar value={cls.progress || 0} size="sm" showLabel />

              {cls.description && (
                <p className="text-xs text-slate-400 mt-3 line-clamp-2">{cls.description}</p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingClass ? 'Edit Class' : 'Create New Class'}
        submitText={editingClass ? 'Save Changes' : 'Create Class'}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class Code *</label>
              <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none uppercase" placeholder="EXE101" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Semester</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white" value={formData.semester} onChange={(e) => setFormData({ ...formData, semester: e.target.value })}>
                {['Fall 2024', 'Spring 2025', 'Summer 2025', 'Fall 2025'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Course Name *</label>
            <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" placeholder="Startup Entrepreneurship" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lecturer *</label>
            <select className="w-full border border-slate-200 rounded-lg px-3 py-2 outline-none bg-white" value={formData.lecturerId} onChange={(e) => setFormData({ ...formData, lecturerId: e.target.value })}>
              <option value="">Select Lecturer</option>
              {lecturers.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" rows={3} placeholder="Class description..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Delete Class`}
        description={`Are you sure you want to delete ${deleteTarget?.name || deleteTarget?.title || 'this item'}? This action cannot be undone.`}
        isSubmitting={isDeleting}
      />
    </div>
  );
};
export default ClassManagement;
