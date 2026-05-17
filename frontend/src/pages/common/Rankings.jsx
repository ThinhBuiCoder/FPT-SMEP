import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { startupApi } from '../../api/startupApi';
import { evaluationApi } from '../../api/evaluationApi';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import { Trophy, Medal, Star } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Rankings = () => {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('table'); // table | chart

  useEffect(() => {
    const fetchRankings = async () => {
      try {
        // Get all startup ideas with their evaluations
        const ideasRes = await startupApi.getAll({ status: 'REVIEWED,APPROVED,SUBMITTED' });
        const ideas = ideasRes.data?.startupIdeas || ideasRes.startupIdeas || ideasRes.data || [];

        const rankData = await Promise.all(
          (Array.isArray(ideas) ? ideas : []).map(async (idea) => {
            try {
              const evalRes = await evaluationApi.getByStartup(idea._id);
              const evals = evalRes.data?.evaluations || evalRes.evaluations || evalRes.data || [];
              const avgScore = Array.isArray(evals) && evals.length > 0
                ? evals.reduce((s, e) => s + (e.totalScore || 0), 0) / evals.length
                : null;
              return {
                id: idea._id,
                startupName: idea.startupName,
                teamName: idea.teamId?.name || '—',
                className: idea.teamId?.classId?.name || '—',
                avgScore,
                evaluationCount: Array.isArray(evals) ? evals.length : 0,
                status: idea.status,
              };
            } catch {
              return { id: idea._id, startupName: idea.startupName, teamName: idea.teamId?.name, avgScore: null, evaluationCount: 0, status: idea.status };
            }
          })
        );

        // Sort by score
        rankData.sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0));
        setRankings(rankData);
      } catch {
        toast.error('Failed to load rankings');
      } finally {
        setLoading(false);
      }
    };
    fetchRankings();
  }, []);

  if (loading) return <LoadingSkeleton />;

  const top3 = rankings.slice(0, 3);
  const chartData = rankings.slice(0, 10).map(r => ({ name: r.teamName, score: r.avgScore || 0 }));

  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const podiumHeight = ['h-24', 'h-32', 'h-20'];
  const podiumRank = [2, 1, 3];
  const podiumIcon = [
    <Medal key="2" className="w-6 h-6 text-slate-400" />,
    <Trophy key="1" className="w-7 h-7 text-amber-500" />,
    <Medal key="3" className="w-6 h-6 text-orange-400" />,
  ];

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">🏆 Startup Rankings</h1>
          <p className="text-slate-500 mt-1">{rankings.length} startups • Ranked by evaluation scores</p>
        </div>
        <div className="flex gap-2 bg-slate-100 rounded-xl p-1">
          {[{ id: 'table', label: 'Table' }, { id: 'chart', label: 'Chart' }].map(v => (
            <button key={v.id} onClick={() => setView(v.id)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === v.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{v.label}</button>
          ))}
        </div>
      </motion.div>

      {rankings.length === 0 ? (
        <EmptyState icon={Trophy} title="No rankings yet" description="Rankings will appear after evaluations are submitted" />
      ) : (
        <>
          {/* Podium */}
          {top3.length >= 2 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} className="bg-gradient-to-br from-primary-600 via-secondary-600 to-cyan-600 rounded-2xl p-8 text-white">
              <h3 className="text-center text-white/70 text-sm font-semibold uppercase tracking-wider mb-8">Top 3 Teams</h3>
              <div className="flex items-end justify-center gap-4">
                {podiumOrder.map((team, i) => team && (
                  <div key={team.id} className={`flex flex-col items-center gap-3 ${i === 1 ? 'order-first md:order-none' : ''}`}>
                    <div className={`w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black`}>
                      {team.startupName?.charAt(0)}
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-sm">{team.startupName}</p>
                      <p className="text-white/60 text-xs">{team.teamName}</p>
                      <p className={`text-xl font-black mt-1 ${team.avgScore >= 8 ? 'text-green-300' : 'text-white'}`}>
                        {team.avgScore?.toFixed(2) || '—'}
                      </p>
                    </div>
                    {podiumIcon[i]}
                    <div className={`${podiumHeight[i]} w-20 bg-white/10 rounded-t-xl flex items-end justify-center pb-2 border-t-2 border-white/20`}>
                      <span className="text-white font-black text-lg">#{podiumRank[i]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {view === 'chart' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-5">Score Distribution</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [v.toFixed(2), 'Score']} />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]} fill="#034EA2" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Table */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.21 }} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="py-3 px-6 text-xs text-slate-400 uppercase text-left font-semibold tracking-wider w-16">Rank</th>
                  <th className="py-3 px-6 text-xs text-slate-400 uppercase text-left font-semibold tracking-wider">Startup</th>
                  <th className="py-3 px-6 text-xs text-slate-400 uppercase text-left font-semibold tracking-wider">Team</th>
                  <th className="py-3 px-6 text-xs text-slate-400 uppercase text-left font-semibold tracking-wider">Class</th>
                  <th className="py-3 px-6 text-xs text-slate-400 uppercase text-left font-semibold tracking-wider">Evals</th>
                  <th className="py-3 px-6 text-xs text-slate-400 uppercase text-right font-semibold tracking-wider">Score</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r, i) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-primary-50/20 transition-colors">
                    <td className="py-3.5 px-6">
                      {i < 3 ? (
                        <span className={`inline-flex w-8 h-8 items-center justify-center rounded-xl font-black text-sm ${i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-slate-200 text-slate-700' : 'bg-orange-100 text-orange-600'}`}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-bold text-sm pl-2">#{i + 1}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-6">
                      <p className="font-semibold text-slate-900">{r.startupName}</p>
                    </td>
                    <td className="py-3.5 px-6 text-sm text-slate-600">{r.teamName}</td>
                    <td className="py-3.5 px-6 text-sm text-slate-400">{r.className}</td>
                    <td className="py-3.5 px-6 text-sm text-slate-400">{r.evaluationCount}</td>
                    <td className="py-3.5 px-6 text-right">
                      {r.avgScore !== null ? (
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg font-bold text-sm ${r.avgScore >= 8 ? 'bg-green-100 text-green-700' : r.avgScore >= 6 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          <Star className="w-3 h-3" />{r.avgScore.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-sm">No score</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </>
      )}
    </div>
  );
};

export default Rankings;
