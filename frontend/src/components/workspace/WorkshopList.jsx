import { Calendar, Clock, MapPin, ExternalLink, Edit2, Trash2 } from 'lucide-react';
import Badge from '../ui/Badge';
import { useAuth } from '../../hooks/useAuth';

const WorkshopList = ({ workshops, onEdit, onDelete }) => {
  const { user } = useAuth();

  const getAudienceLabel = (scope, cCode) => {
    switch (scope) {
      case 'ALL_STUDENTS': return 'All Students';
      case 'CLASS': return cCode ? `Class ${cCode}` : 'Class Students';
      case 'TEAM': return 'Selected Teams';
      case 'LECTURER': return 'Lecturers Only';
      case 'MENTOR': return 'Mentors Only';
      default: return scope;
    }
  };

  const isAuthor = (ws) => {
    return user.role === 'ADMIN' || (ws.createdBy?._id || ws.createdBy) === user.id;
  };

  if (!Array.isArray(workshops) || workshops.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-12 text-center text-slate-400">
        <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-200" />
        <h3 className="font-semibold text-slate-700 text-sm">No Events Scheduled</h3>
        <p className="text-xs text-slate-400 mt-1">There are no upcoming workshops or seminars scheduled at this time.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {workshops.map((ws) => {
        const classCode = ws.classId?.classCode;
        const formattedDate = new Date(ws.startDate).toLocaleDateString(undefined, {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });

        return (
          <div key={ws._id} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between gap-4 relative overflow-hidden group">
            {/* Background pill decoration */}
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${ws.type === 'SEMINAR' ? 'from-indigo-50 to-indigo-100/30' : 'from-primary-50 to-primary-100/30'} rounded-bl-full -z-10`} />

            {/* Header info */}
            <div className="space-y-2">
              <div className="flex justify-between items-start gap-4">
                <div className="flex gap-2 items-center">
                  <Badge variant={ws.type === 'SEMINAR' ? 'Review' : 'Submitted'}>
                    {ws.type}
                  </Badge>
                  <Badge variant={ws.status === 'DRAFT' ? 'Draft' : 'Approved'}>
                    {ws.status}
                  </Badge>
                </div>
                {isAuthor(ws) && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(ws)}
                      className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors"
                      title="Edit Event"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(ws._id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors"
                      title="Delete Event"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-[15px] group-hover:text-primary transition-colors">
                  {ws.title}
                </h4>
                <p className="text-xs text-slate-500 font-semibold uppercase mt-0.5 tracking-wider">
                  Target: {getAudienceLabel(ws.targetAudience, classCode)}
                </p>
              </div>

              <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed pt-1">
                {ws.description || 'No description provided for this session.'}
              </p>
            </div>

            {/* Event schedule and joining options */}
            <div className="pt-2 border-t border-slate-100 space-y-3 shrink-0">
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate font-medium">{formattedDate}</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate font-medium">{ws.startTime} - {ws.endTime}</span>
                </div>
              </div>

              <div className="flex gap-2">
                {ws.location && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-xl text-xs text-slate-600 flex-1 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate font-semibold">{ws.location}</span>
                  </div>
                )}
                {ws.meetingLink && (
                  <a
                    href={ws.meetingLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary/5 hover:bg-primary/10 border border-primary/10 rounded-xl text-xs font-bold text-primary transition-all flex-1 min-w-0"
                  >
                    <span>Join Session</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-semibold">
                <span>By: {ws.createdBy?.name || 'Instructor'}</span>
                <span>Scheduled {new Date(ws.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WorkshopList;
