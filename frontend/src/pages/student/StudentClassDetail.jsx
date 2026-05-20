import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, GraduationCap, Users, Calendar, Mail, Loader2, Sparkles, LayoutGrid } from 'lucide-react';
import toast from 'react-hot-toast';
import { classApi } from '../../api/classApi';
import TeamList from '../../components/class/TeamList';

const semesterLabel = (sem) => {
  if (sem === 'SP') return 'Spring';
  if (sem === 'SU') return 'Summer';
  if (sem === 'FA') return 'Fall';
  return sem;
};

const majorColor = (major) => {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-cyan-100 text-cyan-700',
    'bg-orange-100 text-orange-700',
    'bg-pink-100 text-pink-700',
    'bg-teal-100 text-teal-700',
  ];
  if (!major) return 'bg-slate-100 text-slate-400';
  let hash = 0;
  for (const c of major) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

export default function StudentClassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('classmates');

  useEffect(() => {
    const fetchClassDetail = async () => {
      try {
        const res = await classApi.getMyClassDetail(id);
        setData(res?.data || res || null);
      } catch (err) {
        toast.error(err?.message || 'Failed to load class details');
        navigate('/student/classes');
      } finally {
        setLoading(false);
      }
    };
    fetchClassDetail();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-sm text-slate-400 mt-2 font-medium">Loading class details...</p>
      </div>
    );
  }

  const cls      = data?.class;
  const students = Array.isArray(data?.students) ? data.students : [];
  const teams    = Array.isArray(data?.teams) ? data.teams : [];
  const lecturer = cls?.lectureId;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back link */}
      <button
        onClick={() => navigate('/student/classes')}
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors text-sm font-semibold"
      >
        <ChevronLeft className="w-4 h-4" /> Back to My Classes
      </button>

      {/* Hero Header */}
      <div className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-sm flex flex-wrap justify-between items-start gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary flex items-center justify-center text-white shrink-0 shadow-sm">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 bg-primary-50 text-primary border border-primary-100 rounded-md uppercase">
                {cls?.subjectCode}
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200/40 rounded-md">
                {semesterLabel(cls?.semester)} {cls?.year}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1.5">{cls?.classCode}</h1>
            <p className="text-sm text-slate-500 mt-0.5">{cls?.description || 'Classroom for Startup Idea Development.'}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 shrink-0">
          {/* Lecturer card */}
          {lecturer && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 min-w-[220px]">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Lecturer</p>
              <p className="font-bold text-slate-800 text-sm mt-1">{lecturer.name}</p>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5 text-slate-300" />
                {lecturer.email}
              </p>
            </div>
          )}

          {/* Mentors card */}
          {cls?.mentorIds && cls.mentorIds.length > 0 && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 min-w-[220px] max-w-[280px]">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Mentors</p>
              <p className="font-bold text-slate-800 text-sm mt-1 truncate">
                {cls.mentorIds.map(m => m.name || 'Unknown').join(', ')}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {cls.mentorIds.length} assigned to class
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('classmates')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'classmates'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Users className="w-4 h-4" /> Classmates ({students.length})
        </button>
        <button
          onClick={() => setActiveTab('teams')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'teams'
              ? 'border-primary text-primary'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <LayoutGrid className="w-4 h-4" /> Class Teams ({teams.length})
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'classmates' ? (
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Classmate</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Roll Number</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Major</th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Team Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.map((student) => (
                <tr key={student._id} className="hover:bg-slate-50/40 transition-colors">
                  <td className="px-6 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-secondary flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {student.fullName?.charAt(0)?.toUpperCase()}
                    </div>
                    <span className="font-semibold text-slate-800">{student.fullName}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">{student.rollNumber}</td>
                  <td className="px-6 py-4">
                    {student.major ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${majorColor(student.major)}`}>
                        {student.major}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {student.teamId ? (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-green-50 text-green-600 rounded-full border border-green-100">
                        Assigned
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-400 rounded-full border border-slate-200/40">
                        Unassigned
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <TeamList teams={teams} onRefresh={() => {}} />
      )}
    </div>
  );
}
