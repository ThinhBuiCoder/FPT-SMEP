import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { Users, GraduationCap, Rocket, Brain, TrendingUp, Trophy, BarChart3, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { dashboardApi } from '../../api/dashboardApi';
import StatCard from '../../components/ui/StatCard';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#034EA2', '#F37021', '#51B848', '#3371b8', '#f58f4d'];

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await dashboardApi.getAdmin();
        setData(res.data || res);
      } catch (err) {
        setError(err.message || 'Failed to load dashboard');
        toast.error('Could not load dashboard data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <LoadingSkeleton />;
  if (error) return <EmptyState icon={Activity} title="Error Loading Dashboard" description={error} action={{ label: 'Retry', onClick: () => window.location.reload() }} />;
  if (!data) return null;

  const { stats = {}, usersByRole = [], ideasByStatus = [], topTeams = [] } = data;

  const roleChartData = usersByRole.map(r => ({ name: r.role, value: r.count }));
  const statusChartData = ideasByStatus.map(s => ({ name: s.status, value: s.count }));

  const scoreBarData = topTeams.slice(0, 8).map((t, i) => ({
    name: t.team?.name || `Team ${i + 1}`,
    score: t.avgScore || 0,
  }));

  const fade = (i = 0) => ({ initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.07 } });

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div {...fade(0)} className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Admin Overview</h1>
          <p className="text-slate-500 mt-1">Platform analytics and system health</p>
        </div>
        <Button variant="outline" size="sm" icon={BarChart3} onClick={() => navigate('/rankings')}>View Rankings</Button>
      </motion.div>

      {/* Stat Cards */}
      <motion.div {...fade(1)} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard title="Total Users" value={(stats.totalUsers || 0).toLocaleString()} icon={Users} color="primary" change="+12% this month" trend="up" />
        <StatCard title="Classes" value={stats.totalClasses || 0} icon={GraduationCap} color="cyan" change="Active semester" trend="up" />
        <StatCard title="Teams" value={stats.totalTeams || 0} icon={Rocket} color="secondary" change="Startup teams" trend="up" />
        <StatCard title="Ideas" value={stats.totalIdeas || 0} icon={Brain} color="success" change="Registered ideas" trend="up" />
        <StatCard title="Evaluations" value={stats.totalEvaluations || 0} icon={TrendingUp} color="warning" change="Submitted" trend="up" />
      </motion.div>

      {/* Charts Row */}
      <motion.div {...fade(2)} className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-5 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-primary" />Top Team Rankings</h3>
          {scoreBarData.length === 0 ? (
            <EmptyState icon={Trophy} title="No data yet" description="Complete some evaluations first" size="sm" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={scoreBarData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v.toFixed(2), 'Score']} />
                <Bar dataKey="score" radius={[6, 6, 0, 0]} fill="#034EA2" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie charts */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-3">Users by Role</h3>
            {roleChartData.length > 0 ? (
              <div className="flex items-center gap-4">
                <PieChart width={100} height={100}>
                  <Pie data={roleChartData} cx={45} cy={45} innerRadius={25} outerRadius={45} dataKey="value">
                    {roleChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                </PieChart>
                <div className="space-y-1.5">
                  {roleChartData.map((r, i) => (
                    <div key={r.name} className="flex items-center gap-2 text-sm">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-slate-600">{r.name}</span>
                      <span className="font-bold text-slate-900">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <p className="text-slate-400 text-sm">No data</p>}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
            <h3 className="text-base font-semibold text-slate-900 mb-3">Ideas by Status</h3>
            {statusChartData.length > 0 ? (
              <div className="space-y-2">
                {statusChartData.map((s, i) => (
                  <div key={s.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-sm text-slate-600">{s.name}</span>
                    </div>
                    <span className="font-bold text-slate-900 text-sm">{s.value}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-slate-400 text-sm">No data</p>}
          </div>
        </div>
      </motion.div>

      {/* Top Teams Table */}
      <motion.div {...fade(3)} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="p-6 flex items-center justify-between border-b border-slate-100">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" />Top Teams Leaderboard</h3>
          <Button variant="ghost-primary" size="xs" onClick={() => navigate('/rankings')}>View All →</Button>
        </div>
        {topTeams.length === 0 ? (
          <div className="p-8"><EmptyState icon={Trophy} title="No evaluations yet" description="Evaluations will appear here" size="sm" /></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-400 uppercase">
                <th className="px-6 py-3 text-left">Rank</th>
                <th className="px-6 py-3 text-left">Team</th>
                <th className="px-6 py-3 text-left">Class</th>
                <th className="px-6 py-3 text-left">Startup</th>
                <th className="px-6 py-3 text-right">Score</th>
              </tr>
            </thead>
            <tbody>
              {topTeams.slice(0, 10).map((t, i) => (
                <tr key={i} className="border-t border-slate-50 hover:bg-primary-50/20 transition-colors">
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex w-7 h-7 items-center justify-center rounded-lg text-sm font-bold ${i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'text-slate-500'}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 font-semibold text-slate-900">{t.team?.name || '—'}</td>
                  <td className="px-6 py-3.5 text-slate-500 text-sm">{t.team?.classId?.name || '—'}</td>
                  <td className="px-6 py-3.5 text-slate-700 text-sm">{t.startupName || '—'}</td>
                  <td className="px-6 py-3.5 text-right">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg text-sm font-bold ${t.avgScore >= 8 ? 'bg-green-100 text-green-700' : t.avgScore >= 6 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                      {t.avgScore?.toFixed(2) || '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
