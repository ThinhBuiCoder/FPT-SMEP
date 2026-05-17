// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
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

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard';
import IdeaForm from './pages/student/IdeaForm';

// Common Pages
import Rankings from './pages/common/Rankings';
import AIAnalysis from './pages/common/AIAnalysis';
import IdeaDetail from './pages/common/IdeaDetail';
import MilestoneTracking from './pages/common/MilestoneTracking';
import MentoringSessions from './pages/common/MentoringSessions';

// Shared Pages
import ProfileSettings from './pages/shared/ProfileSettings';
import Forbidden from './pages/shared/Forbidden';
import NotFound from './pages/shared/NotFound';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                borderRadius: '12px',
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                padding: '12px 16px',
                boxShadow: '0 4px 16px -4px rgb(0 0 0 / 0.1)',
              },
              success: {
                iconTheme: { primary: '#51B848', secondary: '#fff' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#fff' },
              },
            }}
          />
          <Routes>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />

            {/* Protected Dashboard Routes */}
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              {/* Admin */}
              <Route path="/admin" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['ADMIN']}><UserManagement /></ProtectedRoute>} />
              <Route path="/admin/classes" element={<ProtectedRoute allowedRoles={['ADMIN']}><ClassManagement /></ProtectedRoute>} />

              {/* Lecturer */}
              <Route path="/lecturer" element={<ProtectedRoute allowedRoles={['LECTURER']}><LecturerDashboard /></ProtectedRoute>} />
              <Route path="/lecturer/classes/:id" element={<ProtectedRoute allowedRoles={['LECTURER', 'ADMIN']}><ClassManagement /></ProtectedRoute>} />

              {/* Student */}
              <Route path="/student" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />
              <Route path="/student/idea/new" element={<ProtectedRoute allowedRoles={['STUDENT']}><IdeaForm /></ProtectedRoute>} />
              <Route path="/student/idea/:id" element={<IdeaDetail />} />
              <Route path="/student/feedback" element={<ProtectedRoute allowedRoles={['STUDENT']}><IdeaDetail /></ProtectedRoute>} />
              <Route path="/student/ai-analysis/:startupIdeaId" element={<ProtectedRoute allowedRoles={['STUDENT']}><AIAnalysis /></ProtectedRoute>} />
              <Route path="/student/ai-analysis" element={<ProtectedRoute allowedRoles={['STUDENT']}><AIAnalysis /></ProtectedRoute>} />

              {/* Shared */}
              <Route path="/rankings" element={<Rankings />} />
              <Route path="/evaluations" element={<IdeaDetail />} />
              <Route path="/milestones" element={<MilestoneTracking />} />
              <Route path="/sessions" element={<MentoringSessions />} />
              <Route path="/settings" element={<ProfileSettings />} />
            </Route>

            {/* Error Pages */}
            <Route path="/403" element={<Forbidden />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
