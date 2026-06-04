// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { usePresence } from './hooks/usePresence';
import ProtectedRoute from './components/auth/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import ErrorBoundary from './components/ui/ErrorBoundary';

// Auth Pages
import Home from './pages/Home';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import ClassManagement from './pages/admin/ClassManagement';

// Lecturer Pages
import LecturerDashboard from './pages/lecturer/LecturerDashboard';
import LecturerClasses from './pages/lecturer/LecturerClasses';
import DataBankPage from './features/data-bank/DataBankPage';

// Mentor Pages
import MentorDashboard from './pages/mentor/MentorDashboard';

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import IdeaForm from './pages/student/IdeaForm';
import MyClasses from './pages/student/MyClasses';
import MyTeam from './pages/student/MyTeam';
import StudentClassDetail from './pages/student/StudentClassDetail';

// Common Pages
import Rankings from './pages/common/Rankings';
import AIAnalysis from './pages/common/AIAnalysis';
import IdeaDetail from './pages/common/IdeaDetail';
import ExecutionBoard from './pages/common/ExecutionBoard';
import MentoringSessions from './pages/common/MentoringSessions';
import GroupChat from './pages/common/GroupChat';
import TeamWorkspace from './pages/workspace/TeamWorkspace';
import StartupWorkspaceHub from './pages/workspace/StartupWorkspaceHub';
import ProposalEditor from './pages/workspace/ProposalEditor';
import Workshops from './pages/workshops/Workshops';

// Shared Pages
import ProfileSettings from './pages/shared/ProfileSettings';
import Forbidden from './pages/shared/Forbidden';
import NotFound from './pages/shared/NotFound';
import ClassDetail from './pages/shared/ClassDetail'; // Module 2

// Wrapper component to call usePresence inside AuthProvider
function PresenceProvider({ children }) {
  usePresence();
  return children;
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PresenceProvider>
        <Router>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                borderRadius: '12px',
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                padding: '12px 16px',
                boxShadow: '0 4px 16px -4px rgb(0 0 0 / 0.1)',
              },
              success: { iconTheme: { primary: '#51B848', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
          <Routes>
            {/* Public */}
            <Route path="/"                          element={<Home />} />
            <Route path="/login"                     element={<Login />} />
            <Route path="/register"                  element={<Register />} />
            <Route path="/forgot-password"           element={<ForgotPassword />} />
            <Route path="/reset-password/:token"     element={<ResetPassword />} />

            {/* Protected Dashboard Routes */}
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              {/* Admin */}
              <Route path="/admin"          element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/users"    element={<ProtectedRoute allowedRoles={['ADMIN']}><UserManagement /></ProtectedRoute>} />
              <Route path="/admin/classes"  element={<ProtectedRoute allowedRoles={['ADMIN']}><ClassManagement /></ProtectedRoute>} />

              {/* Lecturer & Mentor Dashboard */}
              <Route path="/lecturer"         element={<ProtectedRoute allowedRoles={['LECTURER', 'MENTOR']}><LecturerDashboard /></ProtectedRoute>} />
              <Route path="/lecturer/classes" element={<ProtectedRoute allowedRoles={['LECTURER', 'MENTOR']}><LecturerClasses /></ProtectedRoute>} />
              <Route path="/lecturer/data-bank" element={<ProtectedRoute allowedRoles={['ADMIN','LECTURER']}><DataBankPage /></ProtectedRoute>} />

              {/* Mentor Dashboard */}
              <Route path="/mentor"           element={<ProtectedRoute allowedRoles={['MENTOR']}><MentorDashboard /></ProtectedRoute>} />

              {/* Class Detail */}
              <Route path="/classes/:id"    element={<ProtectedRoute allowedRoles={['ADMIN','LECTURER','MENTOR']}><ClassDetail /></ProtectedRoute>} />

              {/* Student */}
              <Route path="/student"                              element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />
              <Route path="/student/idea/new"                     element={<ProtectedRoute allowedRoles={['STUDENT']}><IdeaForm /></ProtectedRoute>} />
              <Route path="/student/idea/:id"                     element={<IdeaDetail />} />
              <Route path="/student/feedback"                     element={<ProtectedRoute allowedRoles={['STUDENT']}><IdeaDetail /></ProtectedRoute>} />
              <Route path="/student/ai-analysis/:startupIdeaId"  element={<ProtectedRoute allowedRoles={['STUDENT']}><AIAnalysis /></ProtectedRoute>} />
              <Route path="/student/ai-analysis"                  element={<ProtectedRoute allowedRoles={['STUDENT']}><AIAnalysis /></ProtectedRoute>} />
              <Route path="/student/classes"                      element={<ProtectedRoute allowedRoles={['STUDENT']}><MyClasses /></ProtectedRoute>} />
              <Route path="/student/classes/:id"                  element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentClassDetail /></ProtectedRoute>} />
              <Route path="/student/team"                         element={<ProtectedRoute allowedRoles={['STUDENT']}><MyTeam /></ProtectedRoute>} />

              {/* Workspace Routes */}
              <Route path="/workspace" element={<ProtectedRoute allowedRoles={['ADMIN','LECTURER','MENTOR']}><StartupWorkspaceHub /></ProtectedRoute>} />
              <Route path="/student/workspace"          element={<ProtectedRoute allowedRoles={['STUDENT']}><TeamWorkspace /></ProtectedRoute>} />
              <Route path="/student/workspace/proposal" element={<ProtectedRoute allowedRoles={['STUDENT']}><ProposalEditor /></ProtectedRoute>} />
              <Route path="/workspace/teams/:teamId"          element={<ProtectedRoute allowedRoles={['ADMIN','LECTURER','MENTOR','STUDENT']}><TeamWorkspace /></ProtectedRoute>} />
              <Route path="/workspace/teams/:teamId/proposal" element={<ProtectedRoute allowedRoles={['ADMIN','LECTURER','MENTOR','STUDENT']}><ProposalEditor /></ProtectedRoute>} />

              {/* Shared */}
              <Route path="/rankings"   element={<Rankings />} />
              <Route path="/evaluations" element={<IdeaDetail />} />
              <Route path="/executionboard"  element={<ExecutionBoard />} />
              <Route path="/sessions"    element={<MentoringSessions />} />
              <Route path="/workshops"   element={<ProtectedRoute allowedRoles={['ADMIN','LECTURER','STUDENT','MENTOR']}><Workshops /></ProtectedRoute>} />
              <Route path="/chat"        element={<ProtectedRoute allowedRoles={['ADMIN','LECTURER','STUDENT','MENTOR']}><GroupChat /></ProtectedRoute>} />
              <Route path="/settings"    element={<ProfileSettings />} />
            </Route>

            {/* Error Pages */}
            <Route path="/403" element={<Forbidden />} />
            <Route path="*"    element={<NotFound />} />
          </Routes>
        </Router>
        </PresenceProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
