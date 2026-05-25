import { Users, BarChart2, Layers, TrendingUp, FileText, ChevronRight, CheckCircle2 } from 'lucide-react';

const ICONS = { Users, BarChart2, Layers, TrendingUp };

export default function CheckpointCard({ checkpoint, submissionStats, onOpen }) {
  const Icon = ICONS[checkpoint.icon] || FileText;
  const stat = submissionStats[checkpoint.number] || {};
  const fileCount = stat.count || 0;
  const latest = stat.latest || null;
  const hasFiles = fileCount > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group w-full text-left rounded-2xl border p-5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2
        ${hasFiles
          ? 'bg-gradient-to-br from-orange-50/50 to-white border-orange-200/70 shadow-sm hover:shadow-lg hover:border-orange-300'
          : 'bg-white border-slate-200/80 hover:border-orange-200 hover:shadow-md'}`}
    >
      <div className="flex items-start gap-4">
        {/* Number badge */}
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 font-bold text-lg shadow-sm transition-colors
            ${hasFiles
              ? 'bg-orange-500 text-white'
              : 'bg-slate-100 text-slate-400 group-hover:bg-orange-100 group-hover:text-orange-600'}`}
        >
          {hasFiles ? <CheckCircle2 className="w-6 h-6" /> : checkpoint.number}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Checkpoint {checkpoint.number}
              </p>
              <h3 className="text-sm font-bold text-slate-900 mt-0.5 group-hover:text-orange-600 transition-colors line-clamp-1">
                {checkpoint.title}
              </h3>
            </div>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                ${hasFiles ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-500'}`}
            >
              <Icon className="w-4 h-4" />
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
            {checkpoint.shortDescription}
          </p>

          {hasFiles && latest && (
            <p className="text-[10px] text-slate-400 mt-2 truncate flex items-center gap-1">
              <FileText className="w-3 h-3 text-orange-400 shrink-0" />
              <span className="truncate">{latest.originalName}</span>
            </p>
          )}

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100/80">
            {hasFiles ? (
              <span className="text-[10px] font-bold px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg">
                {fileCount} file{fileCount !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="text-[10px] font-medium px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg">
                Not submitted
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 group-hover:text-orange-600">
              Open <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
