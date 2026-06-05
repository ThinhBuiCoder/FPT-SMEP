import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Users, AlertTriangle, CheckCircle2, Loader2, Info, AlertCircle } from 'lucide-react';
import { classApi } from '../../api/classApi';
import { getMajorName, getTeamGroupFromMajor, TEAM_MAJOR_GROUPS } from '../../constants/majors';

const majorDisplay = (code) => {
  if (!code) return code;
  const upper = code.toUpperCase();
  const name = getMajorName(upper);
  return name ? `${upper} (${name})` : upper;
};

export default function TeamGeneratePanel({ classId, selected: rawSelected, students: rawStudents, classMentors = [], onTeamCreated }) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState('');
  const students = Array.isArray(rawStudents) ? rawStudents : [];
  const selected = Array.isArray(rawSelected) ? rawSelected : [];

  // Real-time validation
  const validation = useMemo(() => {
    const selectedStudents = students.filter(s => selected.includes(s._id));
    const studentCount = selectedStudents.length;

    // Students with missing/invalid major
    const missingMajorCount = selectedStudents.filter(
      s => !s.major || typeof s.major !== 'string' || !s.major.trim()
    ).length;

    // Determine which team groups are represented
    const groupsPresent = new Set();
    const studentsByGroup = { GROUP_1: [], GROUP_2: [] };

    for (const s of selectedStudents) {
      const major = s.major;
      if (!major) continue;
      const group = getTeamGroupFromMajor(major);
      if (group) {
        groupsPresent.add(group);
        studentsByGroup[group] = [...(studentsByGroup[group] || []), s];
      }
    }

    const hasGroup1 = groupsPresent.has('GROUP_1');
    const hasGroup2 = groupsPresent.has('GROUP_2');
    const hasBothGroups = hasGroup1 && hasGroup2;

    const isValidSize = studentCount >= 4 && studentCount <= 6;
    const isValidGroups = hasBothGroups;
    const canCreate = isValidSize && isValidGroups;
    const sizeError = studentCount > 0 && !isValidSize;
    const groupError = studentCount > 0 && !isValidGroups;

    // Unique majors for display
    const uniqueMajors = [...new Set(
      selectedStudents
        .map(s => s.major)
        .filter(m => typeof m === 'string' && m.trim())
        .map(m => m.trim().toUpperCase())
    )];

    return {
      selectedStudents,
      studentCount,
      uniqueMajors,
      hasGroup1,
      hasGroup2,
      hasBothGroups,
      canCreate,
      sizeError,
      groupError,
      missingMajorCount,
      studentsByGroup,
    };
  }, [selected, students]);

  const {
    studentCount, uniqueMajors,
    hasGroup1, hasGroup2, hasBothGroups,
    canCreate, sizeError, groupError, missingMajorCount,
  } = validation;

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
      <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-4 flex items-start gap-3 text-slate-400">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-slate-500">Chọn sinh viên để tạo nhóm</p>
          <p className="text-xs mt-1">
            Nhóm cần <strong>4–6 thành viên</strong> từ <strong>cả 2 nhóm ngành</strong>:
            {' '}Nhóm 1 (BBA: BBA_HM, BBA_IB, BBA_MC, BBA_MKT, BEN, BBA_TM) và Nhóm 2 (BIT: BIT_AI, BIT_GD, BIT_IA, BIT_SE).
            Tỉ lệ không quan trọng.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      (sizeError || groupError) ? 'bg-red-50 border-red-200' :
      canCreate ? 'bg-green-50 border-green-200' :
      'bg-slate-50 border-slate-200'
    }`}>
      <div className="flex flex-wrap items-start gap-4">
        {/* Status indicator */}
        <div className="flex items-start gap-3 flex-1 min-w-[200px]">
          {canCreate && <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />}
          {(sizeError || groupError) && <AlertTriangle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />}
          {!canCreate && !sizeError && !groupError && <Users className="w-6 h-6 text-slate-400 shrink-0 mt-0.5" />}

          <div>
            <p className="font-semibold text-slate-800">
              {studentCount} sinh viên đã chọn
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {uniqueMajors.length > 0
                ? uniqueMajors.map(m => majorDisplay(m)).join(', ')
                : 'Chưa có chuyên ngành'}
            </p>
          </div>
        </div>

        {/* Requirements checklist */}
        <div className="flex flex-col gap-2 text-xs min-w-[260px]">
          {/* Size check */}
          <span className={`flex items-center gap-1.5 font-medium ${(studentCount >= 4 && studentCount <= 6) ? 'text-green-600' : studentCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] ${(studentCount >= 4 && studentCount <= 6) ? 'bg-green-500' : studentCount > 0 ? 'bg-red-400' : 'bg-slate-300'}`}>
              {(studentCount >= 4 && studentCount <= 6) ? '✓' : '✗'}
            </span>
            4–6 thành viên ({studentCount}/6)
          </span>

          {/* Group 1 check */}
          <span className={`flex items-center gap-1.5 font-medium ${hasGroup1 ? 'text-green-600' : studentCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] shrink-0 ${hasGroup1 ? 'bg-green-500' : studentCount > 0 ? 'bg-red-400' : 'bg-slate-300'}`}>
              {hasGroup1 ? '✓' : '✗'}
            </span>
            <span>
              {TEAM_MAJOR_GROUPS[0].label}:{' '}
              <span className="font-normal text-slate-500">{TEAM_MAJOR_GROUPS[0].majors.map(m => m.code).join(', ')}</span>
            </span>
          </span>

          {/* Group 2 check */}
          <span className={`flex items-center gap-1.5 font-medium ${hasGroup2 ? 'text-green-600' : studentCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] shrink-0 ${hasGroup2 ? 'bg-green-500' : studentCount > 0 ? 'bg-red-400' : 'bg-slate-300'}`}>
              {hasGroup2 ? '✓' : '✗'}
            </span>
            <span>
              {TEAM_MAJOR_GROUPS[1].label}:{' '}
              <span className="font-normal text-slate-500">{TEAM_MAJOR_GROUPS[1].majors.map(m => m.code).join(', ')}</span>
            </span>
          </span>
        </div>

        {/* Mentor Selection */}
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
        <div className="flex gap-2 items-center">
          {groupError && !sizeError && (
            <div className="px-3 py-2 bg-red-100 text-red-600 rounded-xl text-xs font-medium max-w-[220px]">
              Nhóm phải có SV từ cả 2 nhóm ngành.
            </div>
          )}
          {sizeError && (
            <div className="px-3 py-2 bg-red-100 text-red-600 rounded-xl text-xs font-medium">
              Nhóm cần 4–6 thành viên.
            </div>
          )}

          {canCreate && (
            <button
              onClick={() => generate('auto')}
              disabled={submitting}
              className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              ✨ Tạo nhóm
            </button>
          )}
        </div>
      </div>

      {/* Warning: students with missing major */}
      {missingMajorCount > 0 && (
        <div className="mt-3 flex items-start gap-2 bg-amber-50 rounded-xl p-3 border border-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700">
            <strong>{missingMajorCount} sinh viên</strong> chưa có chuyên ngành.
            Vui lòng yêu cầu họ cập nhật hồ sơ hoặc kiểm tra dữ liệu đăng ký.
          </p>
        </div>
      )}
    </div>
  );
}
