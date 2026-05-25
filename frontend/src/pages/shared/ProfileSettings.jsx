import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Mail, Key, User, ShieldCheck, Camera } from 'lucide-react';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import axiosClient from '../../api/axiosClient';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { PROGRAM_GROUPS } from '../../constants/majors';

const roleBadgeVariant = { ADMIN: 'Approved', LECTURER: 'Submitted', MENTOR: 'Review', STUDENT: 'Reviewed' };
const roleLabel = { ADMIN: 'Administrator', LECTURER: 'Lecturer', MENTOR: 'Mentor', STUDENT: 'Student' };

const ProfileSettings = () => {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile state
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [programGroup, setProgramGroup] = useState(user?.programGroup || '');
  const [major, setMajor] = useState(user?.major || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const role = user?.role?.toUpperCase() || 'STUDENT';

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name is required');
    if (role === 'STUDENT') {
      if (!programGroup || !major) return toast.error('Program Group and Major are required for students.');
    }
    
    setIsSavingProfile(true);
    try {
      const payload = { name, avatar };
      if (role === 'STUDENT') {
        payload.programGroup = programGroup;
        payload.major = major;
      }
      const res = await axiosClient.put('/auth/update-profile', payload);
      updateUser(res.user);
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      return toast.error('Please fill all password fields');
    }
    if (newPassword.length < 6) {
      return toast.error('New password must be at least 6 characters');
    }
    if (newPassword !== confirmPassword) {
      return toast.error('New passwords do not match');
    }
    
    setIsSavingPassword(true);
    try {
      await axiosClient.put('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile Info', icon: User },
    { id: 'password', label: 'Security', icon: Key },
  ];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-slate-500 mt-1">Manage your profile and security preferences</p>
      </motion.div>

      {/* Profile Banner */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="bg-gradient-to-r from-primary to-secondary rounded-2xl p-6 sm:p-8 mb-6 text-white relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-1/3 w-24 h-24 bg-white/5 rounded-full translate-y-1/2" />
        <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center overflow-hidden shrink-0">
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl sm:text-3xl font-bold">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
            )}
          </div>
          <div className="text-center sm:text-left">
            <h2 className="text-xl sm:text-2xl font-bold">{user?.name || 'User'}</h2>
            <p className="text-white/70 text-sm">{user?.email || ''}</p>
            <Badge variant={roleBadgeVariant[role]} size="sm" className="mt-2 bg-white/20 border-white/30 text-white">
              {roleLabel[role] || role}
            </Badge>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[420px]"
      >
        {/* Sidebar Tabs */}
        <div className="w-full md:w-56 bg-slate-50/50 border-b md:border-b-0 md:border-r border-slate-200/60 p-3 md:p-4 flex md:flex-col gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-primary shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="w-4 h-4 shrink-0" /> {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 p-5 sm:p-8">
          {activeTab === 'profile' && (
            <div className="max-w-md">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Profile Information</h2>
              <p className="text-sm text-slate-500 mb-6">Update your personal details</p>
              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div>
                  <label htmlFor="profile-email" className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input id="profile-email" type="email" value={user?.email || ''} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-500 cursor-not-allowed text-sm" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">Email cannot be changed</p>
                </div>

                <div>
                  <label htmlFor="profile-role" className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input id="profile-role" type="text" value={roleLabel[role] || role} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-500 cursor-not-allowed font-medium text-sm" />
                  </div>
                </div>

                <div>
                  <label htmlFor="profile-name" className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                  <input id="profile-name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                </div>

                <div>
                  <label htmlFor="profile-avatar" className="block text-sm font-medium text-slate-700 mb-1.5">Avatar URL (Optional)</label>
                  <div className="relative">
                    <Camera className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input id="profile-avatar" type="url" value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="https://..." className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                  </div>
                </div>

                {role === 'STUDENT' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Program Group</label>
                      <select
                        value={programGroup} onChange={e => { setProgramGroup(e.target.value); setMajor(''); }} required
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
                      >
                        <option value="">-- Select Program Group --</option>
                        {PROGRAM_GROUPS.map(g => (
                          <option key={g.code} value={g.code}>{g.code} - {g.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Major</label>
                      <select
                        value={major} onChange={e => setMajor(e.target.value)} required disabled={!programGroup}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value="">-- Select Major --</option>
                        {programGroup && PROGRAM_GROUPS.find(g => g.code === programGroup)?.majors.map(m => (
                          <option key={m.code} value={m.code}>{m.code} - {m.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="pt-2">
                  <Button type="submit" variant="gradient" isLoading={isSavingProfile}>Save Changes</Button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="max-w-md">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Change Password</h2>
              <p className="text-sm text-slate-500 mb-6">Ensure your account is secure</p>
              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <label htmlFor="current-pw" className="block text-sm font-medium text-slate-700 mb-1.5">Current Password</label>
                  <input id="current-pw" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required placeholder="••••••••" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                </div>

                <div className="w-full h-px bg-slate-100 my-2" />

                <div>
                  <label htmlFor="new-pw" className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
                  <input id="new-pw" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} placeholder="Min 6 characters" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                </div>

                <div>
                  <label htmlFor="confirm-pw" className="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
                  <input id="confirm-pw" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} placeholder="Re-enter new password" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" />
                </div>

                <div className="pt-2">
                  <Button type="submit" variant="gradient" isLoading={isSavingPassword}>Update Password</Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ProfileSettings;
