import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, Play, GraduationCap, Users, Brain, BarChart3, Rocket, Zap, Menu, X } from 'lucide-react';
import Button from '../components/ui/Button';
import { useState } from 'react';
import logo from '../assets/logo.png';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] } }),
};

const Home = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [videoOpen, setVideoOpen] = useState(false);

  const features = [
    { icon: GraduationCap, title: 'Smart Classroom', desc: 'Organize startup incubation classes with multi-level role management and real-time team coordination.', color: 'primary', span: 'md:col-span-7' },
    { icon: Users, title: 'Mentoring Hub', desc: 'Connect mentors and startups for 1-on-1 sessions with scheduling, notes, and feedback tracking.', color: 'secondary', span: 'md:col-span-5' },
    { icon: Brain, title: 'AI Evaluation Engine', desc: 'Leverage AI to analyze startup feasibility, market potential, and business model viability in seconds.', color: 'cyan', span: 'md:col-span-5' },
    { icon: BarChart3, title: 'Progress Tracking', desc: 'Visualize milestones with Kanban boards, charts, and real-time KPI dashboards for every team.', color: 'primary', span: 'md:col-span-7' },
  ];

  const iconColors = { primary: 'bg-primary-50 text-primary', secondary: 'bg-secondary-50 text-secondary', cyan: 'bg-cyan-50 text-cyan-600' };

  return (
    <div className="text-slate-900 font-sans antialiased overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-white border border-slate-200 flex items-center justify-center">
              <img src={logo} alt="FPT-SMEP logo" className="w-full h-full object-cover" />
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">FPT-SMEP</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a className="text-body text-slate-500 hover:text-slate-900 transition-colors font-medium" href="#features">Features</a>
            <a className="text-body text-slate-500 hover:text-slate-900 transition-colors font-medium" href="#about">About</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-body font-medium text-slate-600 hover:text-primary transition-colors hidden sm:block">
              Sign in
            </Link>
            <Link to="/login" className="hidden sm:block">
              <Button variant="primary" size="sm" iconRight={ArrowRight}>Get Started</Button>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 md:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white/95 backdrop-blur-xl animate-slide-down">
            <div className="px-4 py-4 space-y-3">
              <a className="block text-body text-slate-600 hover:text-primary font-medium py-2" href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a className="block text-body text-slate-600 hover:text-primary font-medium py-2" href="#about" onClick={() => setMobileMenuOpen(false)}>About</a>
              <div className="pt-2 border-t border-slate-100 flex gap-3">
                <Link to="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full">Sign in</Button>
                </Link>
                <Link to="/login" className="flex-1" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" size="sm" className="w-full" iconRight={ArrowRight}>Start</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section className="pt-28 sm:pt-32 pb-16 sm:pb-20 bg-gradient-hero relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary-100/30 rounded-full blur-[100px]" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary-100/20 rounded-full blur-[120px]" />
          <div className="absolute top-40 right-1/4 w-48 h-48 bg-cyan-100/30 rounded-full blur-[80px]" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 border border-primary-100 mb-6 sm:mb-8"
              >
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-caption font-semibold text-primary">Academic Startup Incubator Platform</span>
              </motion.div>

              <motion.h1 initial="hidden" animate="visible" variants={fadeUp} custom={1}
                className="text-3xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.1] mb-5 sm:mb-6 tracking-tight"
              >
                Startup Mentoring & Evaluation Platform for{' '}
                <span className="text-gradient-primary">FPT University</span>
              </motion.h1>

              <motion.p initial="hidden" animate="visible" variants={fadeUp} custom={2}
                className="text-base sm:text-lg text-slate-500 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed"
              >
                A centralized platform for managing startup classes, mentoring workflows, proposal reviews, and student startup development across academic semesters.
              </motion.p>

              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3}
                className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center"
              >
                <Link to="/login">
                  <Button variant="gradient" size="lg" iconRight={ArrowRight} className="w-full sm:w-auto">Start Now</Button>
                </Link>
                <Button variant="outline" size="lg" icon={Play} className="w-full sm:w-auto" onClick={() => setVideoOpen(true)} > Watch Introduction </Button>
              </motion.div>

              {/* Stats */}
              <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4}
                className="mt-12 sm:mt-16 grid grid-cols-3 gap-4 sm:gap-8 max-w-md mx-auto"
              >
                {[
                  { value: '500+', label: 'Projects' },
                  { value: '1,200', label: 'Students' },
                  { value: '98%', label: 'Satisfaction' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-xl sm:text-2xl font-bold text-slate-900">{stat.value}</p>
                    <p className="text-caption text-slate-400 mt-1">{stat.label}</p>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Dashboard Preview */}
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.8 }}
              className="mt-16 sm:mt-20 relative max-w-5xl mx-auto hidden sm:block"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-slate-50 via-transparent to-transparent z-10 pointer-events-none" />
              <div className="bg-white rounded-2xl border border-slate-200 shadow-float overflow-hidden p-1">
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 sm:p-8">
                  <div className="grid grid-cols-4 gap-3 sm:gap-4 mb-6">
                    {['Total Users', 'Active Classes', 'Startup Teams', 'AI Evaluations'].map((label, i) => (
                      <div key={label} className="bg-white rounded-xl border border-slate-200/60 p-3 sm:p-4 shadow-xs">
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
                        <p className="text-lg sm:text-heading font-bold text-slate-900">{[1247, 12, 48, 156][i]}</p>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 bg-white rounded-xl border border-slate-200/60 p-4 h-40 shadow-xs">
                      <p className="text-caption font-semibold text-slate-400 mb-3">Platform Activity</p>
                      <div className="flex items-end gap-1.5 sm:gap-2 h-24">
                        {[40, 65, 45, 80, 55, 70, 60, 85, 50, 75, 90, 65].map((h, i) => (
                          <div key={i} className="flex-1 bg-primary/15 rounded-t" style={{ height: `${h}%` }}>
                            <div className="w-full bg-primary rounded-t" style={{ height: '60%' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-xs">
                      <p className="text-caption font-semibold text-slate-400 mb-3">AI Score</p>
                      <div className="flex items-center justify-center h-24">
                        <div className="relative w-20 h-20">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#034EA2" strokeWidth="3" strokeDasharray="86, 100" strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-subheading font-bold text-slate-900">86</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-16 sm:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
              className="text-center mb-12 sm:mb-16"
            >
              <h2 className="text-2xl sm:text-display text-slate-900 mb-4">Everything you need to run<br className="hidden sm:block" /> startup incubation</h2>
              <p className="text-base sm:text-lg text-slate-500 max-w-2xl mx-auto">Powerful tools designed for FPT University educators and students to mentor, evaluate, and grow startup ideas.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5">
              {features.map((f, i) => (
                <motion.div key={f.title} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={i}
                  className={`${f.span} bg-slate-25 rounded-2xl border border-slate-200/60 p-6 sm:p-8 hover:shadow-elevated hover:-translate-y-1 transition-all duration-300 group`}
                >
                  <div className={`w-11 h-11 rounded-xl ${iconColors[f.color]} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg sm:text-heading text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-body-lg text-slate-500 leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section id="about" className="py-16 sm:py-24 bg-gradient-hero">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
              <div className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-6">
                <Rocket className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl sm:text-display text-slate-900 mb-4">Ready to launch?</h2>
              <p className="text-base sm:text-lg text-slate-500 mb-8 sm:mb-10 max-w-xl mx-auto">Join hundreds of FPT University students and lecturers already using FPT-SMEP to build the next generation of startups.</p>
              <Link to="/login">
                <Button variant="gradient" size="xl" iconRight={ArrowRight}>Get Started Today</Button>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-body font-bold text-slate-900">FPT-SMEP</span>
          </div>
          <p className="text-body-sm text-slate-400 text-center">
            © 2024 Startup Mentoring & Evaluation Platform — FPT University
          </p>
        </div>
      </footer>
      {videoOpen && ( <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4">
        <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <button
            onClick={() => setVideoOpen(false)}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-700 transition-colors"
            aria-label="Close video"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="aspect-video w-full bg-slate-950">
            <iframe
              src="https://app.heygen.com/embeds/718d4f5c2a3b4fea941888184e7458a8"
              title="SMEP Introduction Video"
              className="h-full w-full"
              allow="autoplay; fullscreen; clipboard-write; encrypted-media"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default Home;
