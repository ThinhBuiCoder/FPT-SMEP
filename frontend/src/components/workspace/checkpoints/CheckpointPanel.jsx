// Full-screen checkpoint detail view
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, CheckCircle2, Award, FileText, Download, Trash2, Loader2,
  MessageSquare, ArrowLeft, Users, BarChart2, Layers, TrendingUp, Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { checkpointApi } from '../../../api/checkpointApi';
import { useAuth } from '../../../hooks/useAuth';
import FileUploadZone from './FileUploadZone';
import FeedbackThread from './FeedbackThread';

const ICONS = { Users, BarChart2, Layers, TrendingUp };

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
};

const FILE_TYPE_STYLES = {
  pdf:  { bg: 'bg-red-50',    text: 'text-red-600',    label: 'PDF' },
  docx: { bg: 'bg-blue-50',   text: 'text-blue-600',   label: 'DOCX' },
  pptx: { bg: 'bg-orange-50', text: 'text-orange-600', label: 'PPTX' },
};

function SectionTitle({ icon: Icon, children, count }) {
  return (
    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
      <span className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
        <Icon className="w-4 h-4 text-orange-500" />
      </span>
      {children}
      {count != null && (
        <span className="ml-auto text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </h3>
  );
}

export default function CheckpointPanel({ checkpoint, teamId, isEditable, onClose }) {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);
  const isStudent = user?.role?.toUpperCase() === 'STUDENT';
  const Icon = ICONS[checkpoint?.icon] || FileText;

  const fetchData = useCallback(async () => {
    if (!teamId || !checkpoint) return;
    setLoading(true);
    try {
      const res = await checkpointApi.getCheckpointData(teamId);
      if (res.success) {
        const sub = res.data.submissions.find(
          (s) => s.checkpointNumber === checkpoint.number
        );
        setFiles(sub?.files || []);
        setFeedbacks(
          res.data.feedbacks.filter((f) => f.checkpointNumber === checkpoint.number)
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [teamId, checkpoint]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const handleDownload = async (file) => {
    setDownloadingId(file._id);
    try {
      await checkpointApi.downloadFile(
        teamId,
        checkpoint.number,
        file._id,
        file.originalName
      );
    } catch (e) {
      toast.error(e?.message || 'Failed to download file.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (fileId) => {
    if (!window.confirm('Delete this file?')) return;
    try {
      const res = await checkpointApi.deleteFile(teamId, checkpoint.number, fileId);
      if (res.success) {
        setFiles(res.data?.files || []);
        toast.success('File deleted.');
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to delete file.');
    }
  };

  if (!checkpoint) return null;

  const content = (
    <div className="fixed inset-0 z-[100] flex flex-col">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-checkpoint-overlay"
        onClick={onClose}
        aria-hidden
      />

      <div className="relative flex flex-col h-full w-full bg-slate-50 animate-checkpoint-panel shadow-2xl">
        {/* Hero header */}
        <header className="shrink-0 relative overflow-hidden bg-gradient-to-br from-primary via-[#1a5fbf] to-secondary text-white">
          <div className="absolute inset-0 opacity-30 pointer-events-none">
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-32 left-1/4 w-80 h-80 rounded-full bg-orange-400/20 blur-3xl" />
          </div>

          <div className="relative px-5 sm:px-8 lg:px-12 py-6 lg:py-8">
            <div className="flex items-start gap-4 max-w-7xl mx-auto">
              <button
                type="button"
                onClick={onClose}
                className="mt-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-semibold transition-all shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </button>

              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-white/15 backdrop-blur border border-white/25 flex items-center justify-center shrink-0 shadow-lg">
                  <Icon className="w-7 h-7 lg:w-8 lg:h-8" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/70">
                    Checkpoint {checkpoint.number} of 4
                  </p>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1 leading-tight truncate">
                    {checkpoint.title}
                  </h1>
                  <p className="text-sm text-white/80 mt-2 max-w-3xl leading-relaxed line-clamp-2">
                    {checkpoint.shortDescription}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center transition-all shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-3 mt-6 max-w-7xl mx-auto">
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-sm font-semibold">
                <FileText className="w-4 h-4 text-orange-200" />
                {loading ? '…' : `${files.length} file${files.length !== 1 ? 's' : ''}`}
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-sm font-semibold">
                <MessageSquare className="w-4 h-4 text-orange-200" />
                {loading ? '…' : `${feedbacks.length} feedback`}
              </span>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-200" />
                {checkpoint.requirements?.length || 0} requirements
              </span>
            </div>
          </div>
        </header>

        {/* Body: sidebar + main */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Left sidebar — requirements */}
          <aside className="lg:w-[360px] xl:w-[400px] shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200/80 overflow-y-auto scrollbar-thin">
            <div className="p-6 lg:p-8 space-y-6">
              <section className="space-y-3">
                <SectionTitle icon={CheckCircle2}>Requirements</SectionTitle>
                <ul className="space-y-2">
                  {checkpoint.requirements.map((req, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-700"
                    >
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      {req}
                    </li>
                  ))}
                </ul>
              </section>

              {checkpoint.rubrics?.length > 0 && (
                <section className="space-y-3">
                  <SectionTitle icon={Award}>Evaluation rubric</SectionTitle>
                  <ul className="space-y-2">
                    {checkpoint.rubrics.map((r, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-xl bg-amber-50/80 border border-amber-100 text-sm text-slate-700"
                      >
                        <Award className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <p className="text-xs text-slate-400 leading-relaxed pt-2 border-t border-slate-100">
                Accepted formats: PDF, DOCX, PPTX · Max 15 MB per file
              </p>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-y-auto scrollbar-thin bg-gradient-to-b from-slate-50 to-white">
            <div className="p-6 lg:p-10 max-w-5xl mx-auto w-full space-y-8">
              {/* Upload */}
              {isEditable && isStudent && (
                <section className="space-y-4">
                  <SectionTitle icon={Upload}>Upload documents</SectionTitle>
                  <FileUploadZone
                    teamId={teamId}
                    checkpointNumber={checkpoint.number}
                    onUploaded={fetchData}
                    variant="large"
                  />
                </section>
              )}

              {/* Submissions */}
              <section className="space-y-4">
                <SectionTitle icon={FileText} count={loading ? '…' : files.length}>
                  Submitted files
                </SectionTitle>

                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-slate-200 bg-white">
                    <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                    <p className="text-sm text-slate-500 mt-3">Loading submissions…</p>
                  </div>
                ) : files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-dashed border-slate-200 bg-white text-center px-6">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                      <FileText className="w-7 h-7 text-slate-300" />
                    </div>
                    <p className="text-sm font-semibold text-slate-600">No documents yet</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      {isStudent && isEditable
                        ? 'Upload your milestone files using the form above.'
                        : 'The team has not submitted files for this checkpoint.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {files.map((file) => {
                      const isOwner = file.uploadedBy?._id === user?._id;
                      const isAdmin = user?.role?.toUpperCase() === 'ADMIN';
                      const canDelete = isOwner || isAdmin;
                      const style = FILE_TYPE_STYLES[file.fileType] || {
                        bg: 'bg-slate-50',
                        text: 'text-slate-600',
                        label: file.fileType?.toUpperCase() || 'FILE',
                      };

                      return (
                        <div
                          key={file._id}
                          className="group flex flex-col p-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md hover:border-orange-200/80 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-12 h-12 rounded-xl ${style.bg} flex items-center justify-center shrink-0`}
                            >
                              <span className={`text-xs font-extrabold ${style.text}`}>
                                {style.label}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p
                                className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug"
                                title={file.originalName}
                              >
                                {file.originalName}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                {formatBytes(file.fileSize)} · {file.uploadedBy?.name || 'Unknown'}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {new Date(file.uploadedAt).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleDownload(file)}
                              disabled={downloadingId === file._id}
                              className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-xl bg-primary/5 text-primary text-xs font-bold hover:bg-primary/10 border border-primary/10 transition-all disabled:opacity-50"
                            >
                              {downloadingId === file._id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                              Download
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => handleDelete(file._id)}
                                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Feedback */}
              <section className="space-y-4 pb-8">
                <SectionTitle icon={MessageSquare} count={feedbacks.length}>
                  Mentor & lecturer feedback
                </SectionTitle>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 lg:p-6 shadow-sm">
                  {loading ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
                    </div>
                  ) : (
                    <FeedbackThread
                      feedbacks={feedbacks}
                      teamId={teamId}
                      checkpointNumber={checkpoint.number}
                      onPosted={fetchData}
                      fullHeight
                    />
                  )}
                </div>
              </section>
            </div>
          </main>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
