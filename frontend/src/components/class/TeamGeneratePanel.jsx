import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Users, AlertTriangle, CheckCircle2, Loader2, Info, AlertCircle } from 'lucide-react';
import { classApi } from '../../api/classApi';

// Same map as StudentTable for display
const MAJOR_MAP = {
  SE: 'Software Engineering',
  AI: 'Artificial Intelligence',
  IA: 'Information Assurance',
  IB: 'International Business',
  GD: 'Graphic Design',
  DM: 'Digital Marketing',
  MC: 'Multimedia Communication',
  HM: 'Hotel Management',
  TM: 'Tourism Management',
  JS: 'Japanese Studies',
  KS: 'Korean Studies',
  EL: 'English Language',
  DE: 'Design / Digital-related',
};

const majorDisplay = (code) => {
  if (!code) return code;
  const upper = code.toUpperCase();
  return MAJOR_MAP[upper] ? `${upper} (${MAJOR_MAP[upper]})` : upper;
};

export default function TeamGeneratePanel({ classId, selected: rawSelected, students: rawStudents, classMentors = [], onTeamCreated }) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState('');
  const students = Array.isArray(rawStudents) ? rawStudents : [];
  const selected = Array.isArray(rawSelected) ? rawSelected : [];

  // Real-time validation
  const validation = useMemo(() => {
    const selectedStudents = students.filter(s => selected.includes(s._id));

    // Valid majors: non-null, non-empty strings
    const validMajors = selectedStudents
      .map(s => s.major)
      .filter(m => typeof m === 'string' && m.trim().length > 0)
      .map(m => m.trim().toUpperCase());

    const uniqueMajors = [...new Set(validMajors)];
    const majorCount   = uniqueMajors.length;
    const studentCount = selectedStudents.length;

    // Students with missing/invalid major
    const missingMajorCount = selectedStudents.filter(
      s => !s.major || typeof s.major !== 'string' || !s.major.trim()
    ).length;

    const canAuto   = studentCount >= 6 && majorCount >= 2;
    const canManual = studentCount > 0 && majorCount >= 2 && studentCount < 6;
    const blocked   = studentCount > 0 && majorCount < 2;

    return { selectedStudents, majors: uniqueMajors, majorCount, studentCount, canAuto, canManual, blocked, missingMajorCount };
  }, [selected, students]);

  const { studentCount, majorCount, majors, canAuto, canManual, blocked, missingMajorCount } = validation;

  const generate = async (mode) => {
    setSubmitting(true);
    try {
      const res = await classApi.generateTeam(classId, {
        studentIds: selected,
        mode,
        mentorId: selectedMentorId || undefined
      });
      const teamName = res?.data?.team?.teamName || res?.team?.teamName || 'New Team';
      toast.success(`${teamName} created with chat group! 🎉`);
      setSelectedMentorId('');
      onTeamCreated();
    } catch (e) {
      toast.error(e?.message || 'Failed to create team');
    } finally {
      setSubmitting(false);
    }
  };

  if (selected.length === 0) {
    return (
      <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-4 flex items-center gap-3 text-slate-400">
        <Info className="w-5 h-5 shrink-0" />
        <p className="text-sm">Select students from the table below to create a team. Tick the circular checkboxes.</p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      blocked       ? 'bg-red-50 border-red-200'    :
      canAuto       ? 'bg-green-50 border-green-200' :
      canManual     ? 'bg-amber-50 border-amber-200' :
      'bg-slate-50 border-slate-200'
    }`}>
      <div className="flex flex-wrap items-center gap-4">
        {/* Status indicator */}
        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          {canAuto && <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />}
          {canManual && <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0" />}
          {blocked && <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />}
          {!blocked && !canAuto && !canManual && <Users className="w-6 h-6 text-slate-400 shrink-0" />}

          <div>
            <p className="font-semibold text-slate-800">
              {studentCount} student{studentCount !== 1 ? 's' : ''} selected
            </p>
            <p className="text-xs text-slate-500">
              {majorCount} major{majorCount !== 1 ? 's' : ''}: {majors.map(m => majorDisplay(m)).join(', ') || 'none'}
            </p>
          </div>
        </div>

        {/* Requirements checklist */}
        <div className="flex gap-4 text-xs">
          <span className={`flex items-center gap-1 font-medium ${studentCount >= 6 ? 'text-green-600' : 'text-slate-400'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] ${studentCount >= 6 ? 'bg-green-500' : 'bg-slate-300'}`}>✓</span>
            6+ students ({studentCount}/6)
          </span>
          <span className={`flex items-center gap-1 font-medium ${majorCount >= 2 ? 'text-green-600' : 'text-red-500'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] ${majorCount >= 2 ? 'bg-green-500' : 'bg-red-400'}`}>
              {majorCount >= 2 ? '✓' : '✗'}
            </span>
            2+ majors ({majorCount}/2)
          </span>
        </div>

        {/* Mentor Selection (visible when mentors exist in the class) */}
        {classMentors.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600">Assign Mentor:</span>
            <select
              value={selectedMentorId}
              onChange={(e) => setSelectedMentorId(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
            >
              <option value="">— Automatic / None —</option>
              {classMentors.map(m => (
                <option key={m._id} value={m._id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {blocked && (
            <div className="px-4 py-2 bg-red-100 text-red-600 rounded-xl text-sm font-medium">
              Team must include students from at least 2 different majors.
            </div>
          )}

          {canManual && !canAuto && (
            <button
              onClick={() => generate('manual')}
              disabled={submitting}
              className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create Team Manually
            </button>
          )}

          {canAuto && (
            <button
              onClick={() => generate('auto')}
              disabled={submitting}
              className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              ✨ Create Team
            </button>
          )}
        </div>
      </div>

      {/* Warning: students with missing major */}
      {missingMajorCount > 0 && (
        <div className="mt-3 flex items-start gap-2 bg-amber-50 rounded-xl p-3 border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            <strong>{missingMajorCount} student{missingMajorCount !== 1 ? 's' : ''}</strong> do not have a valid major.
            Please check their RollNumber — major is detected from the first 2 letters.
          </p>
        </div>
      )}
    </div>
  );
}
