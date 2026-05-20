import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Link2, Users } from 'lucide-react';
import { classApi } from '../../api/classApi';
import { workshopApi } from '../../api/workshopApi';
import toast from 'react-hot-toast';

const WorkshopForm = ({ isOpen, onClose, workshop, onSave }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('WORKSHOP');
  const [targetAudience, setTargetAudience] = useState('CLASS');
  const [classId, setClassId] = useState('');
  const [teamIds, setTeamIds] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [status, setStatus] = useState('PUBLISHED');

  const [classes, setClasses] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await classApi.getAll();
        const list = res.data?.classes || res.classes || res.data || [];
        setClasses(Array.isArray(list) ? list : []);
      } catch {
        toast.error('Failed to load classes');
      }
    };
    if (isOpen) {
      fetchClasses();
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchTeams = async () => {
      if (!classId) {
        setTeams([]);
        return;
      }
      try {
        const res = await classApi.getTeams(classId);
        const list = res.data || res || [];
        setTeams(Array.isArray(list) ? list : []);
      } catch {
        toast.error('Failed to load teams for selected class');
      }
    };
    fetchTeams();
  }, [classId]);

  useEffect(() => {
    if (workshop) {
      setTitle(workshop.title || '');
      setDescription(workshop.description || '');
      setType(workshop.type || 'WORKSHOP');
      setTargetAudience(workshop.targetAudience || 'CLASS');
      setClassId(workshop.classId?._id || workshop.classId || '');
      setTeamIds(workshop.teamIds?.map(t => t._id || t) || []);
      setStartDate(workshop.startDate ? new Date(workshop.startDate).toISOString().split('T')[0] : '');
      setEndDate(workshop.endDate ? new Date(workshop.endDate).toISOString().split('T')[0] : '');
      setStartTime(workshop.startTime || '');
      setEndTime(workshop.endTime || '');
      setLocation(workshop.location || '');
      setMeetingLink(workshop.meetingLink || '');
      setStatus(workshop.status || 'PUBLISHED');
    } else {
      setTitle('');
      setDescription('');
      setType('WORKSHOP');
      setTargetAudience('CLASS');
      setClassId('');
      setTeamIds([]);
      setStartDate('');
      setEndDate('');
      setStartTime('');
      setEndTime('');
      setLocation('');
      setMeetingLink('');
      setStatus('PUBLISHED');
    }
  }, [workshop, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !startDate || !endDate || !startTime || !endTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error('Start Date must be before or equal to End Date');
      return;
    }

    if (startDate === endDate && startTime >= endTime) {
      toast.error('Start Time must be before End Time on the same day');
      return;
    }

    const payload = {
      title,
      description,
      type,
      targetAudience,
      classId: ['CLASS', 'TEAM', 'LECTURER', 'MENTOR'].includes(targetAudience) ? classId : null,
      teamIds: targetAudience === 'TEAM' ? teamIds : [],
      startDate,
      endDate,
      startTime,
      endTime,
      location,
      meetingLink,
      status,
    };

    setLoading(true);
    try {
      if (workshop?._id) {
        await workshopApi.update(workshop._id, payload);
        toast.success('Workshop updated successfully');
      } else {
        await workshopApi.create(payload);
        toast.success('Workshop created successfully');
      }
      onSave();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save workshop');
    } finally {
      setLoading(false);
    }
  };

  const handleTeamToggle = (tId) => {
    setTeamIds(prev =>
      prev.includes(tId) ? prev.filter(id => id !== tId) : [...prev, tId]
    );
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl border border-slate-200/60 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {workshop?._id ? 'Edit Workshop / Seminar' : 'Schedule Workshop / Seminar'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Title & Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
                placeholder="e.g. Sprint Planning Session"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
              >
                <option value="WORKSHOP">Workshop</option>
                <option value="SEMINAR">Seminar</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
              placeholder="Provide a detailed description of the event..."
            />
          </div>

          {/* Audience Scopes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Audience</label>
              <select
                value={targetAudience}
                onChange={e => {
                  setTargetAudience(e.target.value);
                  if (e.target.value === 'ALL_STUDENTS') {
                    setClassId('');
                    setTeamIds([]);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
              >
                <option value="CLASS">Class Students</option>
                <option value="TEAM">Specific Teams</option>
                <option value="LECTURER">Lecturers</option>
                <option value="MENTOR">Mentors</option>
                <option value="ALL_STUDENTS">All Students</option>
              </select>
            </div>

            {targetAudience !== 'ALL_STUDENTS' && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Class Scoped</label>
                <select
                  value={classId}
                  onChange={e => {
                    setClassId(e.target.value);
                    setTeamIds([]);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
                  required={targetAudience !== 'ALL_STUDENTS'}
                >
                  <option value="">Select a class</option>
                  {classes.map(c => (
                    <option key={c._id} value={c._id}>{c.classCode} - {c.subjectCode}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Team Selectors */}
          {targetAudience === 'TEAM' && classId && (
            <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" /> Select Teams
              </label>
              {teams.length === 0 ? (
                <p className="text-xs text-slate-400">No teams generated in this class yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2">
                  {teams.map(t => (
                    <label key={t._id} className="flex items-center gap-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg p-2 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={teamIds.includes(t._id)}
                        onChange={() => handleTeamToggle(t._id)}
                        className="rounded text-primary focus:ring-primary"
                      />
                      <span className="truncate">{t.teamName}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Dates & Times */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> End Date *
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Start Time *
              </label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> End Time *
              </label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          {/* Location & Meeting Link */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Location (Offline Room)
              </label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
                placeholder="Room AL-L203"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Link2 className="w-3.5 h-3.5" /> Meeting Link (Online URL)
              </label>
              <input
                type="url"
                value={meetingLink}
                onChange={e => setMeetingLink(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
                placeholder="https://meet.google.com/abc-defg-hij"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Publish Status</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-slate-100 flex-1 justify-center">
                <input
                  type="radio"
                  name="status"
                  value="PUBLISHED"
                  checked={status === 'PUBLISHED'}
                  onChange={() => setStatus('PUBLISHED')}
                  className="text-primary focus:ring-primary"
                />
                <span>Publish Immediately (Sends Notifications)</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 cursor-pointer hover:bg-slate-100 flex-1 justify-center">
                <input
                  type="radio"
                  name="status"
                  value="DRAFT"
                  checked={status === 'DRAFT'}
                  onChange={() => setStatus('DRAFT')}
                  className="text-primary focus:ring-primary"
                />
                <span>Save as Draft</span>
              </label>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="bg-primary text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:shadow-glow-primary active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Saving...' : workshop?._id ? 'Update Event' : 'Schedule Event'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkshopForm;
