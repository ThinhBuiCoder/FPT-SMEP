import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Mail, Key, User, ShieldCheck } from 'lucide-react';
import Button from '../../components/ui/Button';
import axiosClient from '../../api/axiosClient';
import toast from 'react-hot-toast';

const ProfileSettings = () => {
  const { user, updateUser } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile state
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name is required');
    setIsSavingProfile(true);
    try {
      const res = await axiosClient.put('/auth/update-profile', { name, avatar });
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

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Account Settings</h1>
        <p className="text-slate-500 mt-1">Manage your profile and security preferences</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200/60 p-4">
          <div className="space-y-1">
            <button
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-white text-primary shadow-sm border border-slate-200/50' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              onClick={() => setActiveTab('profile')}
            >
              <User className="w-4 h-4" /> Profile Info
            </button>
            <button
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === 'password' ? 'bg-white text-primary shadow-sm border border-slate-200/50' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              onClick={() => setActiveTab('password')}
            >
              <Key className="w-4 h-4" /> Security
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-8">
          {activeTab === 'profile' && (
            <div className="max-w-md animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Profile Information</h2>
              <form onSubmit={handleUpdateProfile} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="email" value={user?.email} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-500 cursor-not-allowed" />
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" value={user?.role?.toUpperCase()} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-slate-500 cursor-not-allowed font-medium" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Avatar URL (Optional)</label>
                  <input type="url" value={avatar} onChange={e => setAvatar(e.target.value)} placeholder="https://..." className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>

                <div className="pt-2">
                  <Button type="submit" variant="primary" isLoading={isSavingProfile}>Save Changes</Button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="max-w-md animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Change Password</h2>
              <form onSubmit={handleChangePassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Password</label>
                  <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>

                <div className="w-full h-px bg-slate-100 my-4" />

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
                  <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm New Password</label>
                  <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all" />
                </div>

                <div className="pt-2">
                  <Button type="submit" variant="primary" isLoading={isSavingPassword}>Update Password</Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
