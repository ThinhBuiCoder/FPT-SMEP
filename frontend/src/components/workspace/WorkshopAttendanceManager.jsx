import { useState, useEffect } from 'react';
import { X, Check, AlertTriangle, Eye, Loader, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { workshopApi } from '../../api/workshopApi';
import { useAuth } from '../../hooks/useAuth';

export default function WorkshopAttendanceManager({ isOpen, onClose, workshop }) {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [verifyingStudentId, setVerifyingStudentId] = useState(null);
  const [verifyingAll, setVerifyingAll] = useState(false);
  
  // Preview State for evidence image
  const [previewImage, setPreviewImage] = useState(null);
  
  // Rejection State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [studentToReject, setStudentToReject] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedClassId('');
      setStudents([]);
      setPreviewImage(null);
      fetchClasses();
    }
  }, [isOpen, workshop]);

  useEffect(() => {
    if (selectedClassId) {
      fetchAttendance();
    } else {
      setStudents([]);
    }
  }, [selectedClassId]);

  const fetchClasses = async () => {
    setLoadingClasses(true);
    try {
      if (!workshop) return;

      // Extract and format online and offline classes from populated workshop fields
      const onlineList = workshop.onlineClassIds?.map(c => ({
        _id: c._id || c,
        classCode: `${c.classCode || 'Unknown'} (Online)`,
        mode: 'ONLINE'
      })) || [];

      const offlineList = workshop.offlineClassIds?.map(c => ({
        _id: c._id || c,
        classCode: `${c.classCode || 'Unknown'} (Offline)`,
        mode: 'OFFLINE'
      })) || [];

      const list = [...onlineList, ...offlineList];
      setClasses(list);
      
      // Auto select first class if list is not empty
      if (list.length > 0) {
        setSelectedClassId(list[0]._id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải danh sách lớp học.');
    } finally {
      setLoadingClasses(false);
    }
  };

  const fetchAttendance = async () => {
    if (!selectedClassId || !workshop?._id) return;
    setLoadingStudents(true);
    try {
      const res = await workshopApi.getAttendance(workshop._id, selectedClassId);
      const list = res.data || res || [];
      setStudents(list);
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải danh sách điểm danh.');
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleVerify = async (studentId, status, reason = '') => {
    if (status === 'REJECTED' && !reason) {
      setStudentToReject(studentId);
      setRejectReason('');
      setRejectModalOpen(true);
      return;
    }

    setVerifyingStudentId(studentId);
    try {
      await workshopApi.verifyAttendance(workshop._id, studentId, status, reason);
      toast.success(status === 'VERIFIED' ? 'Đã duyệt minh chứng!' : 'Đã từ chối minh chứng.');
      
      // Update local state realtime
      setStudents(prev => prev.map(s => {
        if (s.studentId === studentId) {
          return { ...s, status, rejectReason: reason };
        }
        return s;
      }));

      if (rejectModalOpen) {
        setRejectModalOpen(false);
        setStudentToReject(null);
      }
    } catch (err) {
      console.error(err);
      toast.error('Không thể cập nhật trạng thái điểm danh.');
    } finally {
      setVerifyingStudentId(null);
    }
  };

  const handleVerifyAll = async () => {
    const checkedInCount = students.filter(s => s.status === 'CHECKED_IN').length;
    if (checkedInCount === 0) return;

    if (!window.confirm(`Bạn có chắc chắn muốn duyệt tất cả ${checkedInCount} sinh viên đã check-in?`)) return;

    setVerifyingAll(true);
    try {
      const res = await workshopApi.verifyAllAttendance(workshop._id, selectedClassId);
      toast.success(res.data?.message || res.message || 'Đã duyệt tất cả thành công!');
      
      // Update local state realtime
      setStudents(prev => prev.map(s => {
        if (s.status === 'CHECKED_IN') {
          return { ...s, status: 'VERIFIED', rejectReason: '' };
        }
        return s;
      }));
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi duyệt tất cả.');
    } finally {
      setVerifyingAll(false);
    }
  };

  if (!isOpen) return null;

  const stats = {
    total: students.length,
    checkedIn: students.filter(s => s.status === 'CHECKED_IN').length,
    verified: students.filter(s => s.status === 'VERIFIED').length,
    rejected: students.filter(s => s.status === 'REJECTED').length,
    notParticipated: students.filter(s => s.status === 'NOT_PARTICIPATED').length,
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'NOT_PARTICIPATED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">Chưa tham gia</span>;
      case 'CHECKED_IN':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200">Đã check-in</span>;
      case 'VERIFIED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200">Đã xác nhận</span>;
      case 'REJECTED':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200">Bị từ chối</span>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Main Container */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl mx-4 overflow-hidden border border-slate-100 transform transition-all h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-primary" />
              Quản lý điểm danh
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl truncate">
              {workshop?.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-8 py-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-500">Lớp học:</span>
            {loadingClasses ? (
              <Loader className="w-4 h-4 animate-spin text-primary" />
            ) : (
              <select
                value={selectedClassId}
                onChange={e => setSelectedClassId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all cursor-pointer min-w-[240px]"
              >
                <option value="">-- Chọn lớp --</option>
                {classes.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.classCode}
                  </option>
                ))}
              </select>
            )}
          </div>
          
          {selectedClassId && students.length > 0 && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleVerifyAll}
                disabled={stats.checkedIn === 0 || verifyingAll}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-600/50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-sm active:scale-[0.98]"
              >
                {verifyingAll ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Xác nhận tất cả ({stats.checkedIn})
              </button>
            </div>
          )}
        </div>

        {/* Stats Row */}
        {selectedClassId && students.length > 0 && (
          <div className="px-8 py-3 bg-slate-50/50 border-b border-slate-100 flex flex-wrap gap-4 shrink-0">
            <div className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
              Tổng số: <span className="text-slate-800">{stats.total}</span>
            </div>
            <div className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg shadow-sm">
              Đã duyệt: <span>{stats.verified}</span>
            </div>
            <div className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg shadow-sm">
              Đã check-in (Chờ): <span>{stats.checkedIn}</span>
            </div>
            <div className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-lg shadow-sm">
              Từ chối: <span>{stats.rejected}</span>
            </div>
            <div className="text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
              Chưa tham gia: <span>{stats.notParticipated}</span>
            </div>
          </div>
        )}

        {/* Table/List Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
          {loadingStudents ? (
            <div className="h-full flex items-center justify-center flex-col gap-3">
              <Loader className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm text-slate-500 font-medium">Đang tải danh sách điểm danh...</p>
            </div>
          ) : !selectedClassId ? (
            <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-3 text-center">
              <AlertTriangle className="w-12 h-12 text-slate-300" />
              <h3 className="font-semibold text-slate-700 text-sm">Chưa Chọn Lớp</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">Vui lòng chọn một lớp học từ danh sách phía trên để xem và duyệt điểm danh.</p>
            </div>
          ) : students.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 flex-col gap-3 text-center">
              <AlertTriangle className="w-12 h-12 text-slate-300" />
              <h3 className="font-semibold text-slate-700 text-sm">Không Có Sinh Viên</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">Lớp học này hiện chưa có sinh viên nào.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Sinh viên</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">MSSV</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Thời gian check-in</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Minh chứng</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Trạng thái</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map(s => {
                    const checkInDate = s.checkInTime ? new Date(s.checkInTime).toLocaleString([], {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '—';
                    
                    return (
                      <tr key={s.studentId} className="hover:bg-slate-50/40 transition-colors">
                        <td className="px-6 py-4 align-middle">
                          <div className="font-bold text-slate-700 text-sm">{s.studentName}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{s.email}</div>
                          <div className="mt-1">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${s.mode === 'ONLINE' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                              Hình thức: {s.mode || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 align-middle text-sm font-semibold text-slate-600">
                          {s.rollNumber || '—'}
                        </td>
                        <td className="px-6 py-4 align-middle text-xs font-medium text-slate-500">
                          {checkInDate}
                        </td>
                        <td className="px-6 py-4 align-middle text-center">
                          {s.evidenceUrl ? (
                            <button
                              type="button"
                              onClick={() => setPreviewImage(s.evidenceUrl)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-600 text-xs font-bold rounded-xl transition-all shadow-xs"
                            >
                              <Eye size={14} />
                              <span>Xem</span>
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300 italic">Không có</span>
                          )}
                        </td>
                        <td className="px-6 py-4 align-middle">
                          {getStatusBadge(s.status)}
                          {s.status === 'REJECTED' && s.rejectReason && (
                            <div className="text-[10px] text-rose-500 mt-1 max-w-[150px] truncate" title={s.rejectReason}>
                              Lý do: {s.rejectReason}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 align-middle text-right">
                          {s.status === 'CHECKED_IN' ? (
                            <div className="flex gap-2 justify-end">
                              <button
                                type="button"
                                disabled={verifyingStudentId !== null}
                                onClick={() => handleVerify(s.studentId, 'VERIFIED')}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-600 hover:text-emerald-700 rounded-xl transition-all disabled:opacity-50"
                                title="Duyệt"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                type="button"
                                disabled={verifyingStudentId !== null}
                                onClick={() => handleVerify(s.studentId, 'REJECTED')}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-600 hover:text-rose-700 rounded-xl transition-all disabled:opacity-50"
                                title="Từ chối"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : s.status === 'VERIFIED' || s.status === 'REJECTED' ? (
                            <button
                              type="button"
                              disabled={verifyingStudentId !== null}
                              onClick={() => handleVerify(s.studentId, s.status === 'VERIFIED' ? 'REJECTED' : 'VERIFIED')}
                              className="text-xs font-semibold text-slate-400 hover:text-slate-600 underline transition-all disabled:opacity-50"
                            >
                              {s.status === 'VERIFIED' ? 'Đổi thành từ chối' : 'Đổi thành duyệt'}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300 font-semibold">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Image Preview Overlay Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 p-2 bg-black/70 hover:bg-black/90 text-white rounded-xl transition-all shadow-md z-10"
            >
              <X size={20} />
            </button>
            <div className="p-8 overflow-auto flex items-center justify-center min-h-[300px]">
              <img
                src={previewImage}
                alt="Evidence Large Preview"
                className="max-w-full max-h-[70vh] object-contain rounded-2xl"
              />
            </div>
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setPreviewImage(null)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold rounded-xl transition-all"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200/60 shadow-2xl p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Lý do từ chối</h3>
            <p className="text-sm text-slate-500 mb-4">
              Vui lòng cung cấp lý do từ chối minh chứng này để sinh viên có thể khắc phục.
            </p>
            <textarea
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all mb-4"
              rows={3}
              placeholder="VD: Hình ảnh mờ, không đúng định dạng..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setRejectModalOpen(false);
                  setStudentToReject(null);
                }}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim()}
                onClick={() => handleVerify(studentToReject, 'REJECTED', rejectReason)}
                className="bg-rose-500 text-white font-semibold px-4 py-2 rounded-xl text-sm hover:bg-rose-600 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
