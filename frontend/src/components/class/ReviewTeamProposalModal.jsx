import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { X, CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { teamApi } from '../../api/teamApi';
import { getMajorName, getTeamGroupFromMajor, TEAM_MAJOR_GROUPS } from '../../constants/majors';

const majorDisplay = (code) => {
  if (!code) return code;
  const upper = code.toUpperCase();
  const name = getMajorName(upper);
  return name ? `${upper} (${name})` : upper;
};

export default function ReviewTeamProposalModal({ team, classStudents, onClose, onRefresh }) {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('APPROVED');
  const [rejectReason, setRejectReason] = useState('');
  
  // Maintain a local list of member IDs to allow lecturer to add/remove members before approving
  const initialMemberIds = useMemo(() => {
    return team.members.map(m => typeof m.studentId === 'string' ? m.studentId : m.studentId._id);
  }, [team]);
  
  const [memberIds, setMemberIds] = useState(initialMemberIds);

  const validation = useMemo(() => {
    const selectedStudents = classStudents.filter(s => memberIds.includes(s._id));
    const studentCount = selectedStudents.length;

    const groupsPresent = new Set();
    for (const s of selectedStudents) {
      if (s.major) {
        const group = getTeamGroupFromMajor(s.major);
        if (group) groupsPresent.add(group);
      }
    }

    const hasGroup1 = groupsPresent.has('GROUP_1');
    const hasGroup2 = groupsPresent.has('GROUP_2');
    const isValidSize = studentCount >= 4 && studentCount <= 6;
    const isFullyValid = isValidSize && hasGroup1 && hasGroup2;

    return {
      selectedStudents,
      studentCount,
      hasGroup1,
      hasGroup2,
      isValidSize,
      isFullyValid
    };
  }, [memberIds, classStudents]);

  const toggleMember = (id) => {
    setMemberIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleReview = async () => {
    if (status === 'REJECTED' && !rejectReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối');
      return;
    }
    
    setSubmitting(true);
    try {
      await teamApi.reviewProposal(team._id, {
        status,
        rejectReason: status === 'REJECTED' ? rejectReason.trim() : null,
        newMemberIds: status === 'APPROVED' ? memberIds : undefined
      });
      toast.success(status === 'APPROVED' ? 'Đã duyệt nhóm' : 'Đã từ chối nhóm');
      onRefresh();
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Lỗi khi duyệt nhóm');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">Duyệt đề xuất nhóm</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
          {/* Team Info */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs uppercase font-bold text-slate-400 mb-1">Tên Nhóm</p>
                <p className="font-semibold text-slate-800">{team.groupName}</p>
              </div>
              <div>
                <p className="text-xs uppercase font-bold text-slate-400 mb-1">Tên Dự Án</p>
                <p className="font-semibold text-slate-800">{team.projectName}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs uppercase font-bold text-slate-400 mb-1">Mô tả dự án</p>
                <p className="text-sm text-slate-700">{team.description || 'Không có mô tả'}</p>
              </div>
            </div>
          </div>

          {/* Members */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-700">Thành viên ({validation.studentCount})</h4>
              
              {!validation.isFullyValid && status === 'APPROVED' && (
                <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-1 rounded-lg flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Chưa đạt chuẩn ({validation.studentCount}/6 thành viên, {validation.hasGroup1 ? 'Có N1' : 'Thiếu N1'}, {validation.hasGroup2 ? 'Có N2' : 'Thiếu N2'})
                </span>
              )}
            </div>

            {status === 'APPROVED' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* When approving, lecturer can adjust members. Show all class students. */}
                {classStudents.map(s => {
                  const isSelected = memberIds.includes(s._id);
                  const isOriginal = initialMemberIds.includes(s._id);
                  const leaderId = team.leaderId?._id || team.leaderId;
                  const isLeader = s._id === leaderId;
                  
                  // Disable if assigned to another team AND not part of this proposal
                  const isAssignedElse = s.teamId && s.teamId.toString() !== team._id.toString();

                  return (
                    <label key={s._id} className={`flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-all ${
                      isSelected ? 'border-primary bg-primary-50' : isAssignedElse ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'border-slate-200 hover:border-primary/50 hover:bg-slate-50'
                    }`}>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        disabled={isAssignedElse}
                        onChange={() => toggleMember(s._id)}
                        className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800 truncate">{s.fullName}</span>
                          {isLeader && <span className="text-[10px] bg-amber-100 text-amber-700 px-1 rounded font-bold">Leader</span>}
                        </div>
                        <span className="text-xs text-slate-500 block truncate">{s.major}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Just view the original members */}
                {validation.selectedStudents.map(s => (
                  <div key={s._id} className="flex items-center gap-3 p-2 rounded-xl border border-slate-200 bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-slate-800 truncate block">{s.fullName}</span>
                      <span className="text-xs text-slate-500 block truncate">{s.major}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action form */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="font-bold text-slate-700 mb-3">Quyết định</h4>
            <div className="flex gap-4 mb-4">
              <button
                onClick={() => setStatus('APPROVED')}
                className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  status === 'APPROVED' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500 hover:border-green-200 hover:bg-slate-50'
                }`}
              >
                <CheckCircle2 className={`w-6 h-6 mb-1 ${status === 'APPROVED' ? 'text-green-500' : 'text-slate-400'}`} />
                <span className="font-semibold">Chấp nhận</span>
                <span className="text-[10px] text-center mt-1 opacity-70">Có thể điều chỉnh thành viên trước khi duyệt</span>
              </button>

              <button
                onClick={() => setStatus('REJECTED')}
                className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${
                  status === 'REJECTED' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500 hover:border-red-200 hover:bg-slate-50'
                }`}
              >
                <XCircle className={`w-6 h-6 mb-1 ${status === 'REJECTED' ? 'text-red-500' : 'text-slate-400'}`} />
                <span className="font-semibold">Từ chối</span>
                <span className="text-[10px] text-center mt-1 opacity-70">Bắt buộc nhập lý do từ chối</span>
              </button>
            </div>

            {status === 'REJECTED' && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Lý do từ chối <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Nhập lý do để sinh viên biết và sửa..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none resize-none h-20"
                />
              </div>
            )}
            
            {status === 'APPROVED' && !validation.isFullyValid && (
              <div className="bg-amber-50 text-amber-700 p-3 rounded-xl text-sm border border-amber-200 mb-4 flex gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>Bạn đang duyệt một nhóm không đủ chuẩn. Hãy chắc chắn rằng bạn muốn cấp quyền ngoại lệ cho nhóm này.</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
          >
            Hủy
          </button>
          <button
            onClick={handleReview}
            disabled={submitting || (status === 'REJECTED' && !rejectReason.trim())}
            className={`px-6 py-2 text-sm font-bold text-white rounded-xl transition-all flex items-center gap-2 ${
              status === 'APPROVED' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
            } disabled:opacity-50`}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Xác nhận {status === 'APPROVED' ? 'Duyệt' : 'Từ chối'}
          </button>
        </div>
      </div>
    </div>
  );
}
