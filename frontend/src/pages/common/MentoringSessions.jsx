import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { mentoringApi } from '../../api/mentoringApi';
import { dashboardApi } from '../../api/dashboardApi';
import { teamApi } from '../../api/teamApi';
import { classApi } from '../../api/classApi';
import { useAuth } from '../../hooks/useAuth';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Modal from '../../components/ui/Modal';
import { Calendar, Plus, Video, Clock, Trash2, Edit, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const MentoringSessions = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [teamId, setTeamId] = useState(null);
  const [teams, setTeams] = useState([]);
  const [myClasses, setMyClasses] = useState([]);
  const [activeView, setActiveView] = useState('timetable'); // default to timetable so they see schedules immediately
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [calMonth, setCalMonth] = useState(new Date());
  const [form, setForm] = useState({ title: '', meetingDate: '', notes: '', actionItems: [''], teamId: '' });

  const fetchData = async () => {
    try {
      setLoading(true);
      let list = [];
      if (user?.role === 'STUDENT') {
        const res = await dashboardApi.getStudent();
        const d = res.data || res;
        if (d.team?._id) {
          setTeamId(d.team._id);
          const mRes = await mentoringApi.getSessionsByTeam(d.team._id);
          list = mRes.data?.sessions || mRes.sessions || mRes.data || [];
        }
      } else {
        const res = await mentoringApi.getAllSessions();
        list = res.data?.sessions || res.sessions || res.data || [];
        
        try {
          const teamsRes = await teamApi.getAll();
          const teamsData = teamsRes.data?.teams || teamsRes.teams || teamsRes.data || [];
          setTeams(teamsData);
        } catch (teamsErr) {
          console.error('Failed to load teams:', teamsErr);
        }
      }
      setSessions(Array.isArray(list) ? list : []);

      // Fetch user classes for Timetable
      try {
        let classesRes;
        if (user?.role === 'STUDENT') {
          classesRes = await classApi.getMyClasses();
        } else {
          classesRes = await classApi.getAll();
        }
        const classesList = classesRes.data?.classes || classesRes.classes || classesRes.data || [];
        setMyClasses(classesList);
      } catch (classesErr) {
        console.error('Failed to load user classes:', classesErr);
      }
    } catch {
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => {
    setEditingSession(null);
    setForm({ title: '', meetingDate: '', notes: '', actionItems: [''], teamId: teamId || '' });
    setIsModalOpen(true);
  };

  const openEdit = (s) => {
    setEditingSession(s);
    setForm({
      title: s.title,
      meetingDate: s.meetingDate ? new Date(s.meetingDate).toISOString().slice(0, 16) : '',
      notes: s.notes || '',
      actionItems: s.actionItems?.map(a => a.item || a) || [''],
      teamId: s.teamId?._id || s.teamId || '',
    });
    setIsModalOpen(true);
  };

  
  const handleDelete = (id) => {
    setDeleteTarget({ id });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await mentoringApi.deleteSession(deleteTarget.id);
      setSessions(sessions.filter(s => s._id !== deleteTarget.id));
      toast.success('Session deleted!');
      setDeleteTarget(null);
    } catch {
      toast.error('Failed to delete session');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.title || !form.meetingDate) { toast.error('Title and date required'); return; }
    if (user?.role !== 'STUDENT' && !form.teamId) { toast.error('Please select a team'); return; }
    setIsSubmitting(true);
    try {
      const payload = {
        ...form,
        teamId: user?.role === 'STUDENT' ? teamId : form.teamId,
        actionItems: form.actionItems.filter(a => a.trim()).map(a => ({ item: a, done: false })),
      };
      if (editingSession) {
        await mentoringApi.updateSession(editingSession._id, payload);
        toast.success('Session updated!');
      } else {
        await mentoringApi.createSession(payload);
        toast.success('Session scheduled!');
      }
      setIsModalOpen(false);
      await fetchData();
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calendar helpers
  const monthStart = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
  const daysInMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  const startWeekday = monthStart.getDay();

  const sessionsOnDay = (day) => {
    return sessions.filter(s => {
      const d = new Date(s.meetingDate);
      return d.getFullYear() === calMonth.getFullYear() && d.getMonth() === calMonth.getMonth() && d.getDate() === day;
    });
  };

  const upcomingSessions = sessions.filter(s => new Date(s.meetingDate) >= new Date()).sort((a, b) => new Date(a.meetingDate) - new Date(b.meetingDate));
  const pastSessions = sessions.filter(s => new Date(s.meetingDate) < new Date()).sort((a, b) => new Date(b.meetingDate) - new Date(a.meetingDate));

  const renderTimetable = () => {
    const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const slots = [1, 2, 3, 4];
    const slotTimes = {
      1: '07:30 - 09:00',
      2: '09:10 - 10:40',
      3: '12:30 - 14:00',
      4: '14:10 - 15:40'
    };

    const getClassForSlot = (day, slot) => {
      return myClasses.find(c => {
        return c.schedule && 
               c.schedule.dayOfWeek && 
               c.schedule.dayOfWeek.toUpperCase() === day.toUpperCase() && 
               parseInt(c.schedule.slot, 10) === slot;
      });
    };

    return (
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 overflow-x-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              {user?.role === 'LECTURER' || user?.role === 'LECTURE' ? 'Teaching Timetable' : 'Class Timetable'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Weekly schedule of all your classes and slots</p>
          </div>
        </div>
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr className="bg-slate-50/70 border-b border-slate-200">
              <th className="py-3 px-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-[150px]">Time / Slot</th>
              {days.map(d => (
                <th key={d} className="py-3 px-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {slots.map(slot => (
              <tr key={slot} className="hover:bg-slate-50/10 transition-colors">
                <td className="py-4 px-4 align-top border-r border-slate-100/60">
                  <div className="font-semibold text-slate-800 text-sm">Slot {slot}</div>
                  <div className="text-xs text-slate-400 mt-1">{slotTimes[slot]}</div>
                </td>
                {days.map(day => {
                  const cls = getClassForSlot(day, slot);
                  return (
                    <td key={day} className="py-3 px-3 align-middle border-r border-slate-100 last:border-r-0 text-center">
                      {cls ? (
                        <div className="p-3 rounded-xl bg-gradient-to-br from-primary-50/60 to-primary-100/30 border border-primary-200/60 shadow-xs inline-block w-full">
                          <div className="font-bold text-primary text-sm truncate">{cls.classCode}</div>
                          <div className="text-[11px] font-semibold text-slate-500 mt-1">{cls.subjectCode}</div>
                          <div className="inline-flex items-center gap-1 mt-2 text-[10px] bg-white px-2.5 py-0.5 rounded-full border border-primary-200 text-primary font-medium">
                            Room: {cls.schedule.room || 'TBD'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-300 text-xs italic">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Schedules & Timetable</h1>
          <p className="text-slate-500 mt-1">Manage your weekly learning classes and mentoring sessions</p>
        </div>
        {activeView === 'mentoring' && (
          <Button variant="gradient" size="sm" icon={Plus} onClick={openAdd}>Schedule Session</Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200/80 gap-6">
        <button
          onClick={() => setActiveView('timetable')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 relative ${
            activeView === 'timetable'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Clock className="w-4 h-4" />
          Weekly Timetable
        </button>
        <button
          onClick={() => setActiveView('mentoring')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 relative ${
            activeView === 'mentoring'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Mentoring Sessions
        </button>
      </div>

      {activeView === 'mentoring' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-slate-900">{MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}</h3>
            <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
              <button className="p-1.5 rounded-md hover:bg-white transition-all" onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1))}>
                <ChevronLeft className="w-4 h-4 text-slate-500" />
              </button>
              <button className="p-1.5 rounded-md hover:bg-white transition-all" onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1))}>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
              {DAYS.map(d => <div key={d} className="py-2.5 text-center text-xs text-slate-400 uppercase font-semibold">{d}</div>)}
            </div>
            <div className="grid grid-cols-7">
              {[...Array(startWeekday)].map((_, i) => <div key={`empty-${i}`} className="min-h-[72px] bg-slate-50/50 border-r border-b border-slate-100" />)}
              {[...Array(daysInMonth)].map((_, i) => {
                const day = i + 1;
                const today = new Date();
                const isToday = today.getDate() === day && today.getMonth() === calMonth.getMonth() && today.getFullYear() === calMonth.getFullYear();
                const daySessions = sessionsOnDay(day);
                return (
                  <div key={day} className={`min-h-[72px] border-r border-b border-slate-100 p-1.5 ${isToday ? 'bg-primary-50/30' : ''}`}>
                    <span className={`inline-flex w-6 h-6 items-center justify-center text-xs font-medium rounded-full ${isToday ? 'bg-primary text-white' : 'text-slate-700'}`}>{day}</span>
                    <div className="mt-0.5 space-y-0.5">
                      {daySessions.slice(0, 2).map(s => (
                        <div key={s._id} className="bg-primary text-white text-[9px] px-1.5 py-0.5 rounded truncate font-medium">{s.title}</div>
                      ))}
                      {daySessions.length > 2 && <div className="text-[9px] text-slate-400">+{daySessions.length - 2} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-5">
          {/* Upcoming */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-slate-900">Upcoming</h3>
              <span className="text-xs text-slate-400">{upcomingSessions.length} sessions</span>
            </div>
            {upcomingSessions.length === 0 ? (
              <EmptyState icon={Calendar} title="No upcoming sessions" size="sm" />
            ) : (
              <div className="space-y-3">
                {upcomingSessions.slice(0, 3).map(s => (
                  <div key={s._id} className="p-3 rounded-xl bg-primary-50/40 border border-primary-100 group relative">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-xl" />
                    <div className="flex justify-between items-start pl-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold text-slate-900 truncate">{s.title}</h4>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(s.meetingDate).toLocaleDateString()} {new Date(s.meetingDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2">
                        <button onClick={() => openEdit(s)} className="p-1 rounded text-slate-400 hover:text-primary hover:bg-white transition-all"><Edit className="w-3 h-3" /></button>
                        <button onClick={() => handleDelete(s._id)} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-white transition-all"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                    <button
                      className="mt-2 ml-2 w-full bg-primary text-white text-xs py-1.5 rounded-lg flex items-center justify-center gap-1 hover:bg-primary-dark transition-colors"
                      onClick={() => { toast.success('Opening Google Meet...', { icon: '🎥' }); setTimeout(() => window.open('https://meet.google.com/new', '_blank'), 800); }}
                    >
                      <Video className="w-3 h-3" /> Join Meet
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Sessions */}
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <h3 className="font-semibold text-slate-900 mb-3">Past Sessions</h3>
            {pastSessions.length === 0 ? (
              <p className="text-sm text-slate-400">No past sessions</p>
            ) : (
              <div className="space-y-2">
                {pastSessions.slice(0, 4).map(s => (
                  <div key={s._id} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-slate-50 group">
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700 truncate">{s.title}</p>
                      <p className="text-xs text-slate-400">{new Date(s.meetingDate).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button onClick={() => openEdit(s)} className="p-1 rounded text-slate-400 hover:text-primary"><Edit className="w-3 h-3" /></button>
                      <button onClick={() => handleDelete(s._id)} className="p-1 rounded text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      ) : (
        renderTimetable()
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSession ? 'Edit Session' : 'Schedule Mentoring Session'}
        submitText={editingSession ? 'Save' : 'Schedule'}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      >
        <div className="space-y-4">
          {user?.role !== 'STUDENT' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Team *</label>
              <select
                className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm bg-white"
                value={form.teamId}
                onChange={(e) => setForm({ ...form, teamId: e.target.value })}
              >
                <option value="">-- Choose Team --</option>
                {teams.map(t => (
                  <option key={t._id} value={t._id}>
                    {t.teamName} ({t.teamCode})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Session Title *</label>
            <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Business Model Review" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date & Time *</label>
            <input type="datetime-local" className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" value={form.meetingDate} onChange={(e) => setForm({ ...form, meetingDate: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Session agenda, topics to discuss..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Action Items</label>
            {form.actionItems.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input type="text" className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none" value={item} onChange={(e) => {
                  const arr = [...form.actionItems]; arr[i] = e.target.value; setForm({ ...form, actionItems: arr });
                }} placeholder={`Action item ${i + 1}`} />
                {i > 0 && <button type="button" onClick={() => setForm({ ...form, actionItems: form.actionItems.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600 px-1">✕</button>}
              </div>
            ))}
            <button type="button" onClick={() => setForm({ ...form, actionItems: [...form.actionItems, ''] })} className="text-sm text-primary hover:underline">+ Add action item</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={`Delete Session`}
        description={`Are you sure you want to delete ${deleteTarget?.name || deleteTarget?.title || 'this item'}? This action cannot be undone.`}
        isSubmitting={isDeleting}
      />
    </div>
  );
};
export default MentoringSessions;
