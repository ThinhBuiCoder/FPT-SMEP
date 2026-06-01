import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { X, Loader2 } from 'lucide-react';
import { classApi } from '../../api/classApi';
import { userApi } from '../../api/userApi';

const SEMESTERS   = ['SP', 'SU', 'FA'];
const SUBJECTS    = ['EXE101', 'EXE201'];
const CURRENT_YR  = new Date().getFullYear();
const YEARS       = Array.from({ length: 6 }, (_, i) => CURRENT_YR - 1 + i);

export default function BulkCreateModal({ lecturers: initialLecturers = [], isLecturer = false, onClose, onCreated }) {
  const [form, setForm] = useState({
    subjectCode: 'EXE101',
    semester:    'SP',
    year:        String(CURRENT_YR),
    count:       '5',
    lecturerIds: [],
    mentorIds:   [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [preview,    setPreview]    = useState([]);

  const [allLecturers, setAllLecturers] = useState(initialLecturers);
  const [allMentors, setAllMentors] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const [lectRes, mentorRes] = await Promise.all([
          allLecturers.length === 0 ? userApi.getAll({ role: 'LECTURER', limit: 200 }) : Promise.resolve(null),
          userApi.getAll({ role: 'MENTOR', limit: 200 })
        ]);
        if (lectRes) {
          setAllLecturers(lectRes?.data?.users || lectRes?.users || []);
        }
        setAllMentors(mentorRes?.data?.users || mentorRes?.users || []);
      } catch (err) {
        toast.error('Failed to load user lists');
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, []);

  const buildPreview = (f) => {
    const n = parseInt(f.count, 10);
    if (!n || n < 1) return [];
    return Array.from({ length: Math.min(n, 5) }, (_, i) => `${f.subjectCode}_${i + 1}`);
  };

  const handleChange = (k, v) => {
    const next = { ...form, [k]: v };
    setForm(next);
    if (k === 'subjectCode' || k === 'count') {
      setPreview(buildPreview(next));
    }
  };

  const validate = () => {
    if (!form.subjectCode) return 'Subject code is required';
    if (!['SP','SU','FA'].includes(form.semester)) return 'Invalid semester';
    const n = parseInt(form.count, 10);
    if (!n || n < 1 || n > 100) return 'Count must be between 1 and 100';
    const y = parseInt(form.year, 10);
    if (!y || y < 2020) return 'Invalid year';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }

    setSubmitting(true);
    try {
      const res = await classApi.bulkCreate({
        subjectCode: form.subjectCode,
        semester:    form.semester,
        year:        parseInt(form.year, 10),
        count:       parseInt(form.count, 10),
        lecturerIds: form.lecturerIds.length > 0 ? form.lecturerIds : undefined,
        mentorIds:   form.mentorIds.length > 0 ? form.mentorIds : undefined,
      });
      const count = res?.data?.count || res?.count || parseInt(form.count, 10);
      toast.success(`${count} classes created successfully!`);
      onCreated();
    } catch (e) {
      toast.error(e?.message || 'Failed to create classes');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-float w-full max-w-md animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {isLecturer ? 'Tạo lớp học' : 'Bulk Create Classes'}
            </h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {isLecturer
                ? 'Tạo nhiều lớp cùng lúc — tự động gán cho bạn'
                : 'Generate multiple classes at once'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Subject + Semester */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Subject Code *</label>
              <select
                value={form.subjectCode}
                onChange={(e) => handleChange('subjectCode', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Semester *</label>
              <select
                value={form.semester}
                onChange={(e) => handleChange('semester', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {SEMESTERS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Year + Count */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Year *</label>
              <select
                value={form.year}
                onChange={(e) => handleChange('year', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                {YEARS.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Number of Classes *</label>
              <input
                type="number"
                min="1" max="100"
                value={form.count}
                onChange={(e) => handleChange('count', e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
          </div>

          {loadingUsers ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : (
            <>
              {/* Lecturers — ẩn khi LECTURER tự tạo (tự động gán) */}
              {!isLecturer && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assign Lecturers (optional)</label>
                  <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-1.5">
                    {allLecturers.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">No lecturers found</p>
                    ) : (
                      allLecturers.map(l => {
                        const checked = form.lecturerIds.includes(l._id);
                        return (
                          <label key={l._id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                const nextIds = checked
                                  ? form.lecturerIds.filter(id => id !== l._id)
                                  : [...form.lecturerIds, l._id];
                                handleChange('lecturerIds', nextIds);
                              }}
                              className="rounded border-slate-300 text-primary focus:ring-primary h-3.5 w-3.5"
                            />
                            <span>{l.name} ({l.email})</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Lecturers info khi là LECTURER */}
              {isLecturer && (
                <div className="flex items-center gap-2 p-3 bg-primary-50 border border-primary-100 rounded-xl">
                  <span className="text-lg">👤</span>
                  <p className="text-xs text-primary font-medium">Lớp sẽ được tự động gán cho bạn.</p>
                </div>
              )}

              {/* Mentors */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign Mentors (optional)</label>
                <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-1.5">
                  {allMentors.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-2">No mentors found</p>
                  ) : (
                    allMentors.map(m => {
                      const checked = form.mentorIds.includes(m._id);
                      return (
                        <label key={m._id} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const nextMentorIds = checked
                                ? form.mentorIds.filter(id => id !== m._id)
                                : [...form.mentorIds, m._id];
                              handleChange('mentorIds', nextMentorIds);
                            }}
                            className="rounded border-slate-300 text-primary focus:ring-primary h-3.5 w-3.5"
                          />
                          <span>{m.name} ({m.email})</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}

          {/* Preview */}
          {preview.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-2">Preview (first {preview.length} of {form.count})</p>
              <div className="flex flex-wrap gap-2">
                {preview.map(code => (
                  <span key={code} className="px-2 py-0.5 bg-primary-50 text-primary text-xs font-mono rounded-lg">{code}</span>
                ))}
                {parseInt(form.count, 10) > 5 && (
                  <span className="px-2 py-0.5 text-slate-400 text-xs">+{parseInt(form.count, 10) - 5} more</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-all">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : 'Create Classes'}
          </button>
        </div>
      </div>
    </div>
  );
}
