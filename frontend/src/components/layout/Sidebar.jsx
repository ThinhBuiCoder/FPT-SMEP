import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../utils/cn';
import {
  LayoutDashboard, Users, GraduationCap, Trophy, CalendarDays,
  Kanban, Brain, Video, Rocket, LogOut, Plus, Sparkles, PanelLeftClose, PanelLeft
} from 'lucide-react';

const iconMap = {
  dashboard: LayoutDashboard,
  group: Users,
  school: GraduationCap,
  leaderboard: Trophy,
  calendar_month: CalendarDays,
  view_kanban: Kanban,
  analytics: Brain,
  event: CalendarDays,
  military_tech: Trophy,
  rocket_launch: Rocket,
  task_alt: Kanban,
  video_chat: Video,
};

const Sidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = {
    admin: [
      { path: '/admin', icon: 'dashboard', label: 'Overview' },
      { path: '/admin/users', icon: 'group', label: 'Users' },
      { path: '/admin/classes', icon: 'school', label: 'Classes' },
      { path: '/rankings', icon: 'leaderboard', label: 'Rankings' },
      { path: '/sessions', icon: 'calendar_month', label: 'Schedules' },
    ],
    lecturer: [
      { path: '/lecturer', icon: 'dashboard', label: 'Dashboard' },
      { path: '/milestones', icon: 'view_kanban', label: 'Milestones' },
      { path: '/evaluations', icon: 'analytics', label: 'AI Reports' },
      { path: '/sessions', icon: 'event', label: 'Sessions' },
      { path: '/rankings', icon: 'military_tech', label: 'Rankings' },
    ],
    student: [
      { path: '/student', icon: 'dashboard', label: 'Dashboard' },
      { path: '/student/idea', icon: 'rocket_launch', label: 'My Idea' },
      { path: '/milestones', icon: 'task_alt', label: 'Milestones' },
      { path: '/sessions', icon: 'video_chat', label: 'Mentoring' },
    ],
  };

  const items = navItems[user?.role] || [];

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-screen z-50 flex flex-col bg-white border-r border-slate-200/80 transition-all duration-300',
      collapsed ? 'w-[68px]' : 'w-[260px]'
    )}>
      {/* Brand */}
      <div className={cn('flex items-center h-16 border-b border-slate-100 px-4', collapsed ? 'justify-center' : 'gap-3')}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="text-body-lg font-bold text-slate-900 leading-tight">FPT-SMEP</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Startup Portal</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shrink-0"
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto scrollbar-thin">
        {!collapsed && (
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2 mt-1">Navigation</p>
        )}
        {items.map((item) => {
          const IconComp = iconMap[item.icon] || LayoutDashboard;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin' || item.path === '/lecturer' || item.path === '/student'}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-xl transition-all duration-200 group relative',
                collapsed ? 'justify-center px-0 py-2.5 mx-0.5' : 'px-3 py-2.5',
                isActive
                  ? 'bg-primary-50 text-primary font-semibold'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              )}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-primary rounded-r-full" />
                  )}
                  <IconComp className={cn('w-[18px] h-[18px] shrink-0', isActive ? 'text-primary' : 'text-slate-400 group-hover:text-slate-600')} />
                  {!collapsed && <span className="text-body truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className={cn('border-t border-slate-100 p-2.5 space-y-1', collapsed && 'px-1.5')}>
        {user?.role === 'student' && !collapsed && (
          <button
            onClick={() => navigate('/student/idea/new')}
            className="w-full bg-gradient-to-r from-primary to-secondary text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 mb-2 shadow-sm hover:shadow-glow-primary transition-all active:scale-[0.98] text-body"
          >
            <Plus className="w-4 h-4" />
            New Idea
          </button>
        )}

        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center gap-3 rounded-xl text-danger hover:bg-danger-50 transition-all text-body font-medium',
            collapsed ? 'justify-center py-2.5' : 'px-3 py-2.5'
          )}
        >
          <LogOut className="w-[18px] h-[18px]" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
