import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { aiApi } from '../../api/aiApi';
import { startupApi } from '../../api/startupApi';
import { dashboardApi } from '../../api/dashboardApi';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import Button from '../../components/ui/Button';
import { Brain, Zap, AlertTriangle, TrendingUp, ShieldAlert, Lightbulb, Link2, CheckCircle, XCircle } from 'lucide-react';

const ScoreRing = ({ score }) => {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  const circumference = 2 * Math.PI * 45;
  const dash = (score / 100) * circumference;

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" stroke="#f1f5f9" strokeWidth="8" />
        <circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black text-slate-900">{score}</span>
        <span className="text-xs text-slate-400 font-medium">/100</span>
      </div>
    </div>
  );
};

const AIAnalysis = () => {
  const { startupIdeaId } = useParams();
  const [searchParams] = useSearchParams();
  const ideaId = startupIdeaId || searchParams.get('ideaId');

  const [analysis, setAnalysis] = useState(null);
  const [idea, setIdea] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (ideaId) {
          const [analysisRes, ideaRes] = await Promise.all([
            aiApi.getAnalysis(ideaId),
            startupApi.getById(ideaId)
          ]);
          setAnalysis(analysisRes.data?.analysis || analysisRes.analysis || analysisRes.data);
          setIdea(ideaRes.data?.startupIdea || ideaRes.startupIdea || ideaRes.data);
        } else {
          // Get from student dashboard
          const res = await dashboardApi.getStudent();
          const dashData = res.data || res;
          setAnalysis(dashData.aiAnalysis);
          setIdea(dashData.startupIdea);
        }
      } catch {
        toast.error('Failed to load analysis');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [ideaId]);

  const handleAnalyze = async () => {
    const id = idea?._id || ideaId;
    if (!id) { toast.error('No startup idea found'); return; }
    setAnalyzing(true);
    try {
      const res = await aiApi.analyze(id);
      const newAnalysis = res.data?.analysis || res.analysis || res.data;
      setAnalysis(newAnalysis);
      toast.success('AI Analysis complete!');
    } catch (err) {
      toast.error(err.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-primary-600 via-secondary-600 to-cyan-600 rounded-2xl p-8 text-white">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div className="text-center">
            {analysis ? <ScoreRing score={analysis.aiScore} /> : (
              <div className="w-36 h-36 mx-auto bg-white/10 rounded-full flex items-center justify-center">
                <Brain className="w-16 h-16 text-white/60" />
              </div>
            )}
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-5 h-5" />
              <span className="text-white/70 text-sm font-medium uppercase tracking-wider">AI Powered Analysis</span>
            </div>
            <h1 className="text-3xl font-bold mb-1">{idea?.startupName || 'AI Startup Analysis'}</h1>
            <p className="text-white/70 mb-4">{analysis ? `Model: ${analysis.model || 'GPT-4 Mock'} • ${analysis.createdAt ? new Date(analysis.createdAt).toLocaleDateString() : "Unknown date"}` : 'No analysis generated yet'}</p>
            <Button variant="outline" size="md" icon={Zap} isLoading={analyzing} className="border-white/30 text-white hover:bg-white/10" onClick={handleAnalyze}>
              {analysis ? 'Re-Analyze' : 'Run AI Analysis'}
            </Button>
          </div>
        </div>
      </motion.div>

      {!analysis ? (
        <EmptyState icon={Brain} title="No AI analysis yet" description="Run AI analysis to get insights about your startup idea" action={{ label: 'Run Analysis', onClick: handleAnalyze }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Strengths */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-green-500" />Strengths</h3>
            {analysis.strengths?.length ? (
              <ul className="space-y-2">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                    </div>
                    {s}
                  </li>
                ))}
              </ul>
            ) : <p className="text-slate-400 text-sm">No strengths identified</p>}
          </motion.div>

          {/* Weaknesses */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2"><XCircle className="w-5 h-5 text-red-500" />Weaknesses</h3>
            {analysis.weaknesses?.length ? (
              <ul className="space-y-2">
                {analysis.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                    </div>
                    {w}
                  </li>
                ))}
              </ul>
            ) : <p className="text-slate-400 text-sm">No weaknesses identified</p>}
          </motion.div>

          {/* Feasibility */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />Feasibility Analysis</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{analysis.feasibilityAnalysis || 'No analysis available'}</p>
          </motion.div>

          {/* Market Potential */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-green-500" />Market Potential</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{analysis.marketPotential || 'No analysis available'}</p>
          </motion.div>

          {/* Risks */}
          {analysis.risks?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-amber-50 rounded-2xl border border-amber-200 p-6">
              <h3 className="text-lg font-semibold text-amber-900 mb-4 flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-amber-500" />Risk Factors</h3>
              <ul className="space-y-2">
                {analysis.risks.map((r, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    {r}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Suggestions */}
          {analysis.suggestions?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="bg-blue-50 rounded-2xl border border-blue-200 p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-blue-500" />AI Suggestions</h3>
              <ul className="space-y-2">
                {analysis.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-blue-800">
                    <div className="w-5 h-5 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-bold text-blue-600 text-xs">{i + 1}</div>
                    {s}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Similar Ideas */}
          {analysis.similarIdeas?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="md:col-span-2 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2"><Link2 className="w-5 h-5 text-secondary" />Similar Ideas in Market</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {analysis.similarIdeas.map((s, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <p className="font-semibold text-slate-900 text-sm">{s.name || s}</p>
                    {s.similarity && <p className="text-xs text-slate-400 mt-1">Similarity: {s.similarity}%</p>}
                    {s.notes && <p className="text-xs text-slate-500 mt-1">{s.notes}</p>}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIAnalysis;
