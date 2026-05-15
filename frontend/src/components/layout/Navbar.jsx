import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { Search, Bell, ChevronDown, User, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../ui/Badge';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  if (!user) return null;

  const roleLabels = {
    admin: 'Administrator',
    lecturer: 'Lecturer',
    student: 'Student',
  };

  const roleBadgeVariant = {
    admin: 'Approved',
    lecturer: 'Submitted',
    student: 'Reviewed',
  };

  return (
    <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-40 h-16 flex items-center justify-between px-6 gap-6">
      {/* Search Bar */}
      <div className="flex-1 max-w-md">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
          <input
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-body text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white transition-all"
            placeholder="Search teams, ideas, students..."
            type="text"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex h-5 items-center gap-1 rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-400">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        {/* Notification */}
        <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all" onClick={() => toast('No new notifications at this time.', { icon: '🔔' })}>
          <Bell className="w-[18px] h-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full ring-2 ring-white" />
        </button>

        <div className="w-px h-6 bg-slate-200" />

        {/* Profile */}
        <button className="flex items-center gap-3 hover:bg-slate-50 py-1.5 px-2.5 rounded-xl transition-all group" onClick={() => setShowProfileMenu(!showProfileMenu)}>
          <div className="flex flex-col items-end">
            <span className="text-body font-semibold text-slate-800 leading-tight">{user.name}</span>
            <Badge variant={roleBadgeVariant[user.role]} size="xs">
              {roleLabels[user.role]}
            </Badge>
          </div>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 overflow-hidden border border-primary-100 flex items-center justify-center">
            {user.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="font-display font-bold text-primary text-body">{user.name?.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600" />
        </button>
        {showProfileMenu && (
          <div className="absolute right-6 top-16 w-48 bg-white rounded-xl shadow-elevated border border-slate-100 overflow-hidden py-1">
            <button className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors flex items-center gap-2" onClick={() => { setShowProfileMenu(false); navigate('/settings'); }}>
              <User className="w-4 h-4" /> Profile
            </button>
            <div className="h-px w-full bg-slate-100 my-1" />
            <button className="w-full text-left px-4 py-2.5 text-sm text-danger hover:bg-danger-50 transition-colors flex items-center gap-2 font-medium" onClick={() => { logout(); navigate('/login'); }}>
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
