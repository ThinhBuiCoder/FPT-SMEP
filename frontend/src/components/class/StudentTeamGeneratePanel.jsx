import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Users, AlertTriangle, CheckCircle2, Loader2, Info, AlertCircle, Send } from 'lucide-react';
import { classApi } from '../../api/classApi';
import { getTeamGroupFromMajor } from '../../constants/majors';

const getTeamSizeSuggestion = (count) => {
  if (count === 0) return '';
  if (count < 4) return 'Số lượng sinh viên chưa có nhóm dưới 4. Nhóm 3 thành viên cần gửi đề xuất ngoại lệ.';

  const search = (remaining, groups = []) => {
    if (remaining === 0) return groups;
    if (remaining < 0) return null;
    for (const size of [5, 4, 6]) {
      const found = search(remaining - size, [...groups, size]);
      if (found) return found;
    }
    return null;
  };

  const sizes = search(count);
  if (!sizes) return 'Có thể chia nhóm 4-6 thành viên. Trường hợp dư đặc biệt cần gửi đề xuất ngoại lệ.';

  const summary = sizes.reduce((acc, size) => ({ ...acc, [size]: (acc[size] || 0) + 1 }), {});
  return `Gợi ý: ${Object.entries(summary).map(([size, qty]) => `${qty} nhóm x ${size} sinh viên`).join(', ')}.`;
};

export default function StudentTeamGeneratePanel({ classId, selected: rawSelected, students: rawStudents, onTeamCreated, currentStudentId }) {
  const [submitting, setSubmitting] = useState(false);
  const students = useMemo(() => (Array.isArray(rawStudents) ? rawStudents : []), [rawStudents]);
  const selected = useMemo(() => (Array.isArray(rawSelected) ? rawSelected : []), [rawSelected]);

  const [groupName, setGroupName] = useState('');
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [isProjectNameSameAsGroup, setIsProjectNameSameAsGroup] = useState(true);

  const suggestionInfo = useMemo(() => {
    const unassignedCount = students.filter(s => !s.teamId).length;
    if (unassignedCount === 0) return null;

    return {
      total: students.length,
      unassigned: unassignedCount,
      suggestion: getTeamSizeSuggestion(unassignedCount)
    };
  }, [students]);

  // Real-time validation
  const validation = useMemo(() => {
    const selectedStudents = students.filter(s => selected.includes(s._id));
    const studentCount = selectedStudents.length;

    const missingMajorCount = selectedStudents.filter(
      s => !s.major || typeof s.major !== 'string' || !s.major.trim()
    ).length;

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
    
    const isFullyValid = isValidSize && isValidGroups && studentCount > 0;
    // Cho phép gửi đề xuất nếu count > 0 nhưng không FullyValid
    const canPropose = (studentCount === 3 || studentCount === 7) && isValidGroups;

    const uniqueMajors = [...new Set(
      selectedStudents
        .map(s => s.major)
        .filter(m => typeof m === 'string' && m.trim())
        .map(m => m.trim().toUpperCase())
    )];

    // Form validation
    const isGroupNameValid = groupName.trim().length >= 3 && groupName.trim().length <= 60;
    const isProjectNameValid = isProjectNameSameAsGroup || (projectName.trim().length >= 3 && projectName.trim().length <= 60);
    const isDescriptionValid = !description.trim() || (description.trim().length >= 20 && description.trim().length <= 500);
    const hasCurrentUser = selected.includes(currentStudentId);

    const isFormValid = isGroupNameValid && isProjectNameValid && isDescriptionValid && hasCurrentUser;

    return {
      selectedStudents,
      studentCount,
      uniqueMajors,
      hasGroup1,
      hasGroup2,
      hasBothGroups,
      isFullyValid,
      canPropose,
      missingMajorCount,
      isFormValid,
      hasCurrentUser
    };
  }, [selected, students, groupName, projectName, description, isProjectNameSameAsGroup, currentStudentId]);

  const {
    studentCount, uniqueMajors,
    hasGroup1, hasGroup2, isFullyValid, canPropose,
    missingMajorCount, isFormValid, hasCurrentUser
  } = validation;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        studentIds: selected,
        groupName: groupName.trim(),
        projectName: isProjectNameSameAsGroup ? groupName.trim() : projectName.trim(),
        description: description.trim(),
        isProjectNameSameAsGroup
      };
      
      const res = await classApi.studentProposeTeam(classId, payload);
      toast.success(res.message || 'Tạo nhóm thành công!');
      
      // Reset form
      setGroupName('');
      setProjectName('');
      setDescription('');
      setIsProjectNameSameAsGroup(true);
      onTeamCreated();
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || 'Lỗi khi tạo nhóm');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border p-4 shadow-sm">
      <div className="mb-4 pb-4 border-b border-slate-100 flex flex-col gap-2">
        <h3 className="font-bold text-lg text-slate-800">Tạo nhóm của bạn</h3>
        {suggestionInfo && (
          <div className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-50 px-3 py-2 rounded-xl w-fit">
            <Info className="w-4 h-4 shrink-0" />
            <span>
              Lớp có {suggestionInfo.unassigned} SV chưa có nhóm. {suggestionInfo.suggestion}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Tên Nhóm (Group Name) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="VD: Nhóm 1, Alpha Team..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              maxLength={60}
            />
            {groupName.trim() && groupName.trim().length < 3 && (
              <p className="text-xs text-red-500 mt-1">Tên nhóm phải từ 3-60 ký tự</p>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
              <input
                type="checkbox"
                checked={isProjectNameSameAsGroup}
                onChange={e => setIsProjectNameSameAsGroup(e.target.checked)}
                className="rounded border-slate-300 text-primary focus:ring-primary"
              />
              Dùng Tên Nhóm làm Tên Dự Án (Project Name)
            </label>
            
            {!isProjectNameSameAsGroup && (
              <div>
                <input
                  type="text"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="Nhập tên dự án..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                  maxLength={60}
                />
                {projectName.trim() && projectName.trim().length < 3 && (
                  <p className="text-xs text-red-500 mt-1">Tên dự án phải từ 3-60 ký tự</p>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Mô tả dự án (Tùy chọn)
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Mô tả ngắn về ý tưởng dự án..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none h-20"
              maxLength={500}
            />
            {description.trim() && description.trim().length < 20 && (
              <p className="text-xs text-red-500 mt-1">Mô tả cần ít nhất 20 ký tự (nếu có)</p>
            )}
          </div>
        </div>

        {/* Validation Info & Submit */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-slate-700 mb-3 text-sm flex items-center gap-2">
              <Users className="w-4 h-4" /> Thành viên đã chọn ({studentCount})
            </h4>
            
            <div className="flex flex-col gap-2 text-xs mb-4">
              <span className={`flex items-center gap-1.5 font-medium ${(studentCount >= 4 && studentCount <= 6) ? 'text-green-600' : studentCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] ${(studentCount >= 4 && studentCount <= 6) ? 'bg-green-500' : studentCount > 0 ? 'bg-red-400' : 'bg-slate-300'}`}>
                  {(studentCount >= 4 && studentCount <= 6) ? '✓' : '✗'}
                </span>
                4–6 thành viên ({studentCount}/6)
              </span>

              <span className={`flex items-center gap-1.5 font-medium ${hasGroup1 ? 'text-green-600' : studentCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] shrink-0 ${hasGroup1 ? 'bg-green-500' : studentCount > 0 ? 'bg-red-400' : 'bg-slate-300'}`}>
                  {hasGroup1 ? '✓' : '✗'}
                </span>
                <span>Ít nhất 1 SV Nhóm 1 (BBA)</span>
              </span>

              <span className={`flex items-center gap-1.5 font-medium ${hasGroup2 ? 'text-green-600' : studentCount > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] shrink-0 ${hasGroup2 ? 'bg-green-500' : studentCount > 0 ? 'bg-red-400' : 'bg-slate-300'}`}>
                  {hasGroup2 ? '✓' : '✗'}
                </span>
                <span>Ít nhất 1 SV Nhóm 2 (BIT)</span>
              </span>
              
              <span className={`flex items-center gap-1.5 font-medium ${hasCurrentUser ? 'text-green-600' : 'text-red-500'}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] shrink-0 ${hasCurrentUser ? 'bg-green-500' : 'bg-red-400'}`}>
                  {hasCurrentUser ? '✓' : '✗'}
                </span>
                <span>Bạn phải nằm trong danh sách nhóm</span>
              </span>
            </div>

            {uniqueMajors.length > 0 && (
              <p className="text-xs text-slate-500 mb-3">
                Chuyên ngành: {uniqueMajors.join(', ')}
              </p>
            )}

            {missingMajorCount > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 rounded-xl p-2 border border-amber-200 mb-3">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700">
                  Có {missingMajorCount} SV chưa có chuyên ngành.
                </p>
              </div>
            )}
            
            {studentCount > 0 && !isFullyValid && (
              <div className="flex items-start gap-2 bg-orange-50 rounded-xl p-2 border border-orange-200 mb-3">
                <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
                <p className="text-xs text-orange-700 font-medium">
                  Nhóm chưa đạt chuẩn 4-6 thành viên. Chỉ nhóm 3 hoặc 7 thành viên, có đủ 2 nhóm ngành, mới được gửi đề xuất ngoại lệ.
                </p>
              </div>
            )}
          </div>

          <div>
            <button
              onClick={handleSubmit}
              disabled={submitting || !isFormValid || (!isFullyValid && !canPropose)}
              className={`w-full py-2.5 rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all disabled:opacity-50
                ${isFullyValid 
                  ? 'bg-green-500 text-white hover:bg-green-600' 
                  : 'bg-orange-500 text-white hover:bg-orange-600'
                }`}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                (isFullyValid ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />)
              }
              {isFullyValid ? 'Tạo Nhóm Chính Thức' : 'Gửi Đề Xuất Duyệt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


