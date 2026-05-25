import { useState, useEffect } from 'react';
import { X, Calendar, Clock, MapPin, Link2, Users, Upload, Image as ImageIcon, FileText, Trash2, Globe, Monitor } from 'lucide-react';
import { classApi } from '../../api/classApi';
import { workshopApi } from '../../api/workshopApi';
import { userApi } from '../../api/userApi';
import { chatApi } from '../../api/chatApi';
import toast from 'react-hot-toast';

const WorkshopForm = ({ isOpen, onClose, workshop, onSave }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('WORKSHOP');
  const [targetAudience, setTargetAudience] = useState('CLASS');
  
  const [onlineClassIds, setOnlineClassIds] = useState([]);
  const [offlineClassIds, setOfflineClassIds] = useState([]);
  const [teamIds, setTeamIds] = useState([]);
  
  const [bannerUrl, setBannerUrl] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [checkInDeadline, setCheckInDeadline] = useState('');
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  
  const [selectedMentors, setSelectedMentors] = useState([]);
  const [status, setStatus] = useState('PUBLISHED');

  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [availableMentors, setAvailableMentors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clsRes, userRes] = await Promise.all([
          classApi.getAll(),
          userApi.getAll({ role: 'MENTOR' })
        ]);
        
        const cList = clsRes.data?.classes || clsRes.classes || clsRes.data || [];
        setAvailableClasses(Array.isArray(cList) ? cList : []);

        const uList = userRes.data?.users || userRes.users || userRes.data || [];
        setAvailableMentors(Array.isArray(uList) ? uList : []);
      } catch (err) {
        toast.error('Failed to load initial data');
      }
    };
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchTeams = async () => {
      const allSelectedClassIds = [...onlineClassIds, ...offlineClassIds];
      if (allSelectedClassIds.length === 0) {
        setAvailableTeams([]);
        return;
      }
      try {
        const promises = allSelectedClassIds.map(id => classApi.getTeams(id));
        const results = await Promise.all(promises);
        let allTeams = [];
        results.forEach(res => {
          const list = res.data || res || [];
          if (Array.isArray(list)) {
            allTeams = [...allTeams, ...list];
          }
        });
        setAvailableTeams(allTeams);
      } catch (err) {
        toast.error('Failed to load teams');
      }
    };
    fetchTeams();
  }, [onlineClassIds, offlineClassIds]);

  useEffect(() => {
    if (workshop) {
      setTitle(workshop.title || '');
      setDescription(workshop.description || '');
      setType(workshop.type || 'WORKSHOP');
      setTargetAudience(workshop.targetAudience || 'CLASS');
      
      const onIds = workshop.onlineClassIds?.map(c => c._id || c) || [];
      const offIds = workshop.offlineClassIds?.map(c => c._id || c) || [];
      setOnlineClassIds(onIds);
      setOfflineClassIds(offIds);

      setTeamIds(workshop.teamIds?.map(t => t._id || t) || []);
      setBannerUrl(workshop.bannerUrl || '');
      setAttachments(workshop.attachments || []);
      setCheckInDeadline(workshop.checkInDeadline ? new Date(workshop.checkInDeadline).toISOString().slice(0, 16) : '');
      
      setStartDate(workshop.startDate ? new Date(workshop.startDate).toISOString().split('T')[0] : '');
      setEndDate(workshop.endDate ? new Date(workshop.endDate).toISOString().split('T')[0] : '');
      setStartTime(workshop.startTime || '');
      setEndTime(workshop.endTime || '');
      setLocation(workshop.location || '');
      setMeetingLink(workshop.meetingLink || '');
      setSelectedMentors(workshop.mentors?.map(m => m._id || m) || []);
      setStatus(workshop.status || 'PUBLISHED');
    } else {
      resetForm();
    }
  }, [workshop, isOpen]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setType('WORKSHOP');
    setTargetAudience('CLASS');
    setOnlineClassIds([]);
    setOfflineClassIds([]);
    setTeamIds([]);
    setBannerUrl('');
    setAttachments([]);
    setCheckInDeadline('');
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setLocation('');
    setMeetingLink('');
    setSelectedMentors([]);
    setStatus('PUBLISHED');
  };

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

    if (targetAudience === 'CLASS' && onlineClassIds.length === 0 && offlineClassIds.length === 0) {
      toast.error('Please select at least one online or offline class');
      return;
    }

    if (onlineClassIds.length > 0 && !meetingLink) {
      toast.error('Meeting Link is required for online classes');
      return;
    }

    if (offlineClassIds.length > 0 && !location) {
      toast.error('Location is required for offline classes');
      return;
    }

    const payload = {
      title,
      description,
      type,
      targetAudience,
      onlineClassIds: ['CLASS', 'TEAM', 'LECTURER', 'MENTOR'].includes(targetAudience) ? onlineClassIds : [],
      offlineClassIds: ['CLASS', 'TEAM', 'LECTURER', 'MENTOR'].includes(targetAudience) ? offlineClassIds : [],
      teamIds: targetAudience === 'TEAM' ? teamIds : [],
      bannerUrl,
      attachments,
      checkInDeadline: checkInDeadline || null,
      mentors: selectedMentors,
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

  const handleFileUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await chatApi.uploadFile(formData);
      const url = res.data?.url || res.url;
      
      if (type === 'banner') {
        setBannerUrl(url);
      } else {
        setAttachments(prev => [...prev, url]);
      }
    } catch (err) {
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const addOnlineClass = (classId) => {
    if (!classId) return;
    if (onlineClassIds.includes(classId)) return;
    if (offlineClassIds.includes(classId)) {
      toast.error('Class is already in Offline group');
      return;
    }
    setOnlineClassIds(prev => [...prev, classId]);
  };

  const addOfflineClass = (classId) => {
    if (!classId) return;
    if (offlineClassIds.includes(classId)) return;
    if (onlineClassIds.includes(classId)) {
      toast.error('Class is already in Online group');
      return;
    }
    setOfflineClassIds(prev => [...prev, classId]);
  };

  const removeOnlineClass = (classId) => {
    setOnlineClassIds(prev => prev.filter(id => id !== classId));
  };

  const removeOfflineClass = (classId) => {
    setOfflineClassIds(prev => prev.filter(id => id !== classId));
  };

  const toggleTeam = (tId) => {
    setTeamIds(prev => prev.includes(tId) ? prev.filter(id => id !== tId) : [...prev, tId]);
  };

  const toggleMentor = (mId) => {
    setSelectedMentors(prev => prev.includes(mId) ? prev.filter(id => id !== mId) : [...prev, mId]);
  };

  const getDerivedFormat = () => {
    if (onlineClassIds.length > 0 && offlineClassIds.length > 0) return 'HYBRID';
    if (onlineClassIds.length > 0) return 'ONLINE';
    return 'OFFLINE';
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl border border-slate-200/60 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {workshop?._id ? 'Edit Event / Workshop' : 'Schedule Event / Workshop'}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
              Format: {getDerivedFormat()}
            </span>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Main Info */}
            <div className="col-span-1 lg:col-span-2 space-y-5">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Title *</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Type</label>
                  <select
                    value={type}
                    onChange={e => setType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  >
                    <option value="WORKSHOP">Workshop</option>
                    <option value="SEMINAR">Seminar</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={4}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                />
              </div>

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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Check-in Deadline
                  </label>
                  <input
                    type="datetime-local"
                    value={checkInDeadline}
                    onChange={e => setCheckInDeadline(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
              </div>

              {/* Online/Offline Settings */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-800">Location & Connection details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" /> Offline Location {offlineClassIds.length > 0 && '*'}
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      placeholder="e.g. Room AL-L203"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Link2 className="w-3.5 h-3.5" /> Online Link {onlineClassIds.length > 0 && '*'}
                    </label>
                    <input
                      type="url"
                      value={meetingLink}
                      onChange={e => setMeetingLink(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      placeholder="https://meet.google.com/..."
                    />
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column - Assignments & Media */}
            <div className="col-span-1 space-y-6">
              
              {/* Media & Attachments */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Media & Files</h3>
                
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Banner Image</label>
                  {bannerUrl ? (
                    <div className="relative rounded-xl overflow-hidden group">
                       <img src={bannerUrl} alt="Banner" className="w-full h-24 object-cover" />
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" onClick={() => setBannerUrl('')} className="p-2 bg-rose-500 text-white rounded-full hover:bg-rose-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-primary hover:bg-white transition-colors">
                      <ImageIcon className="w-6 h-6 text-slate-400 mb-1" />
                      <span className="text-xs text-slate-500">Upload Banner</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleFileUpload(e, 'banner')} disabled={uploading} />
                    </label>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Attachments</label>
                  <div className="space-y-2 mb-2">
                    {attachments.map((url, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <span className="text-xs text-slate-600 truncate">Attachment {idx + 1}</span>
                        </div>
                        <button type="button" onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-rose-500">
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center justify-center gap-2 w-full py-2 border border-slate-200 bg-white rounded-xl text-xs font-semibold text-slate-600 hover:border-primary hover:text-primary cursor-pointer transition-colors">
                    <Upload size={14} /> Add File
                    <input type="file" className="hidden" onChange={e => handleFileUpload(e, 'attachment')} disabled={uploading} />
                  </label>
                </div>
              </div>

              {/* Target Audience & Class Groups Selection */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Participants</h3>
                
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Audience Scope</label>
                <select
                  value={targetAudience}
                  onChange={e => {
                    setTargetAudience(e.target.value);
                    if (e.target.value === 'ALL_STUDENTS') {
                      setOnlineClassIds([]);
                      setOfflineClassIds([]);
                      setTeamIds([]);
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary mb-4"
                >
                  <option value="CLASS">Class Students</option>
                  <option value="TEAM">Specific Teams</option>
                  <option value="LECTURER">Lecturers</option>
                  <option value="MENTOR">Mentors</option>
                  <option value="ALL_STUDENTS">All Students</option>
                </select>

                {['CLASS', 'TEAM', 'LECTURER', 'MENTOR'].includes(targetAudience) && (
                  <div className="space-y-4">
                    {/* A. Online Classes */}
                    <div className="border border-slate-200/60 rounded-xl p-3 bg-white">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">
                        <Monitor className="w-3.5 h-3.5" /> Online Classes
                      </div>
                      <select
                        onChange={e => { addOnlineClass(e.target.value); e.target.value = ''; }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary mb-2"
                      >
                        <option value="">-- Add Online Class --</option>
                        {availableClasses.map(c => (
                          <option key={c._id} value={c._id}>{c.classCode} - {c.subjectCode}</option>
                        ))}
                      </select>
                      
                      <div className="space-y-1 max-h-[100px] overflow-y-auto">
                        {onlineClassIds.map(id => {
                          const cls = availableClasses.find(c => c._id === id);
                          return (
                            <div key={id} className="flex items-center justify-between p-1.5 bg-indigo-50/50 rounded-lg text-xs">
                              <span className="font-semibold text-slate-700">{cls?.classCode || 'Class'}</span>
                              <button type="button" onClick={() => removeOnlineClass(id)} className="text-slate-400 hover:text-rose-500">
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                        {onlineClassIds.length === 0 && (
                          <p className="text-[11px] text-slate-400 text-center py-1">No online classes assigned</p>
                        )}
                      </div>
                    </div>

                    {/* B. Offline Classes */}
                    <div className="border border-slate-200/60 rounded-xl p-3 bg-white">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">
                        <Globe className="w-3.5 h-3.5" /> Offline Classes
                      </div>
                      <select
                        onChange={e => { addOfflineClass(e.target.value); e.target.value = ''; }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-primary mb-2"
                      >
                        <option value="">-- Add Offline Class --</option>
                        {availableClasses.map(c => (
                          <option key={c._id} value={c._id}>{c.classCode} - {c.subjectCode}</option>
                        ))}
                      </select>
                      
                      <div className="space-y-1 max-h-[100px] overflow-y-auto">
                        {offlineClassIds.map(id => {
                          const cls = availableClasses.find(c => c._id === id);
                          return (
                            <div key={id} className="flex items-center justify-between p-1.5 bg-amber-50/50 rounded-lg text-xs">
                              <span className="font-semibold text-slate-700">{cls?.classCode || 'Class'}</span>
                              <button type="button" onClick={() => removeOfflineClass(id)} className="text-slate-400 hover:text-rose-500">
                                <X size={12} />
                              </button>
                            </div>
                          );
                        })}
                        {offlineClassIds.length === 0 && (
                          <p className="text-[11px] text-slate-400 text-center py-1">No offline classes assigned</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Team Selectors */}
                {targetAudience === 'TEAM' && (onlineClassIds.length > 0 || offlineClassIds.length > 0) && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> Select Teams
                    </label>
                    {availableTeams.length === 0 ? (
                      <p className="text-xs text-slate-400">No teams generated yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2 max-h-[120px] overflow-y-auto">
                        {availableTeams.map(t => (
                          <label key={t._id} className="flex items-center gap-2 text-xs text-slate-700 bg-white border border-slate-200 rounded p-1.5 cursor-pointer">
                            <input type="checkbox" checked={teamIds.includes(t._id)} onChange={() => toggleTeam(t._id)} className="rounded text-primary" />
                            <span className="truncate">{t.teamName}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Mentors Selection */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Assigned Mentors/Lecturers</h3>
                <div className="grid grid-cols-1 gap-2 max-h-[120px] overflow-y-auto">
                  {availableMentors.map(m => (
                    <label key={m._id} className="flex items-center gap-2 text-xs text-slate-700 bg-white border border-slate-200 rounded p-1.5 cursor-pointer">
                      <input type="checkbox" checked={selectedMentors.includes(m._id)} onChange={() => toggleMentor(m._id)} className="rounded text-primary" />
                      <span className="truncate">{m.name}</span>
                    </label>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="radio" name="status" value="PUBLISHED" checked={status === 'PUBLISHED'} onChange={() => setStatus('PUBLISHED')} className="text-primary" />
              <span>Publish</span>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="radio" name="status" value="DRAFT" checked={status === 'DRAFT'} onChange={() => setStatus('DRAFT')} className="text-primary" />
              <span>Draft</span>
            </label>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={loading || uploading} className="bg-primary text-white font-semibold px-6 py-2.5 rounded-xl text-sm hover:shadow-glow-primary active:scale-[0.98] transition-all disabled:opacity-50">
              {loading ? 'Saving...' : workshop?._id ? 'Update Event' : 'Schedule Event'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkshopForm;
