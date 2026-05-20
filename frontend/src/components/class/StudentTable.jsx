import { useState, useMemo } from 'react';
import { Search, Users } from 'lucide-react';
import EmptyState from '../ui/EmptyState';

// ─── Major Display Map (optional cosmetic labels) ──────────────────────────────
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

/**
 * Get display label for a major code.
 * If the code is in MAJOR_MAP, returns "CODE — Full Name".
 * Otherwise returns just the code.
 * Returns "-" if major is null/empty.
 */
const majorLabel = (major) => {
  if (!major || typeof major !== 'string' || !major.trim()) return '-';
  const code = major.trim().toUpperCase();
  return MAJOR_MAP[code] ? `${code}` : code;
};

const majorTooltip = (major) => {
  if (!major || typeof major !== 'string' || !major.trim()) return '';
  const code = major.trim().toUpperCase();
  return MAJOR_MAP[code] || code;
};

const teamStatusBadge = (student) => {
  if (student.teamId) return (
    <span className="px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700 rounded-full">Assigned</span>
  );
  return (
    <span className="px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-500 rounded-full">Unassigned</span>
  );
};

// Deterministic color from major code
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

export default function StudentTable({ students: rawStudents, selected, onSelectionChange, onRefresh }) {
  const students = Array.isArray(rawStudents) ? rawStudents : [];
  const [search,      setSearch]      = useState('');
  const [filterMajor, setFilterMajor] = useState('');

  const majors = useMemo(() => {
    const codes = students
      .map(s => s.major)
      .filter(m => typeof m === 'string' && m.trim().length > 0)
      .map(m => m.trim().toUpperCase());
    return [...new Set(codes)].sort();
  }, [students]);

  const filtered = useMemo(() => {
    return students.filter(s => {
      const matchSearch = !search || [s.fullName, s.rollNumber, s.email]
        .some(v => v?.toLowerCase().includes(search.toLowerCase()));
      const matchMajor = !filterMajor || (s.major && s.major.toUpperCase() === filterMajor);
      return matchSearch && matchMajor;
    });
  }, [students, search, filterMajor]);

  const toggleSelect = (id) => {
    onSelectionChange(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    const unassigned = filtered.filter(s => !s.teamId).map(s => s._id);
    const allSelected = unassigned.length > 0 && unassigned.every(id => selected.includes(id));
    if (allSelected) {
      onSelectionChange(prev => prev.filter(id => !unassigned.includes(id)));
    } else {
      onSelectionChange(prev => [...new Set([...prev, ...unassigned])]);
    }
  };

  const canSelect = (s) => !s.teamId;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 p-4 border-b border-slate-100">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, roll, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <select
          value={filterMajor}
          onChange={(e) => setFilterMajor(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          <option value="">All Majors</option>
          {majors.map(m => (
            <option key={m} value={m}>{m}{MAJOR_MAP[m] ? ` — ${MAJOR_MAP[m]}` : ''}</option>
          ))}
        </select>
        {selected.length > 0 && (
          <span className="flex items-center px-3 py-1.5 bg-primary-50 text-primary rounded-xl text-sm font-medium">
            {selected.length} selected
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="p-8">
          <EmptyState icon={Users} title="No students found" description="Try adjusting your search or filters" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={filtered.filter(s => !s.teamId).length > 0 && filtered.filter(s => !s.teamId).every(s => selected.includes(s._id))}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Roll No.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Major</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">Team</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((s) => {
                const isSelected = selected.includes(s._id);
                const selectable = canSelect(s);
                const mLabel = majorLabel(s.major);
                const mTooltip = majorTooltip(s.major);
                return (
                  <tr
                    key={s._id}
                    onClick={() => selectable && toggleSelect(s._id)}
                    className={`transition-colors ${selectable ? 'cursor-pointer hover:bg-slate-50' : 'opacity-60'} ${isSelected ? 'bg-primary-50' : ''}`}
                  >
                    {/* Circular checkbox */}
                    <td className="px-4 py-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-primary border-primary' : 'border-slate-300'
                        } ${!selectable ? 'opacity-30' : ''}`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </td>

                    {/* Name + Avatar */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-300 to-secondary flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {s.fullName?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <span className="font-medium text-slate-800 truncate max-w-[140px]">{s.fullName || 'Unknown'}</span>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell font-mono text-xs">{s.rollNumber || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell truncate max-w-[180px]">{s.email || '—'}</td>

                    {/* Major badge */}
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${majorColor(s.major)}`}
                        title={mTooltip}
                      >
                        {mLabel}
                      </span>
                    </td>

                    {/* Team status */}
                    <td className="px-4 py-3 text-center">{teamStatusBadge(s)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
        Showing {filtered.length} of {students.length} students · {students.filter(s => s.teamId).length} assigned
      </div>
    </div>
  );
}
