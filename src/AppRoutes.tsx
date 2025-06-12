import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import SearchExport from './pages/SearchExport';
import ScreenRecorder from './pages/ScreenRecorder';
import TechPage from './pages/Tech';
import ResetPassword from './pages/ResetPassword';
import RecordingsManagement from './pages/RecordingsManagement';

const ProtectedRoute: React.FC<{ role: 'user' | 'admin'; children: React.ReactNode }> = ({ role, children }) => {
  const { user, role: userRole, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (userRole !== role) return <Navigate to={userRole === 'admin' ? '/admin' : '/user'} replace />;
  return <>{children}</>;
};

const DashboardProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role: userRole, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (userRole !== 'user' && userRole !== 'admin') return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role: userRole, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (userRole !== 'admin') return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />
    <Route
      path="/user"
      element={
        <ProtectedRoute role="user">
          <UserDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/admin"
      element={
        <ProtectedRoute role="admin">
          <AdminDashboard />
        </ProtectedRoute>
      }
    />
    <Route
      path="/dashboard"
      element={
        <DashboardProtectedRoute>
          <UserDashboard />
        </DashboardProtectedRoute>
      }
    />
    <Route path="/search-export" element={<SearchExport />} />
    <Route path="/recorder" element={<ScreenRecorder />} />
    <Route path="/Tech" element={<TechPage />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route
      path="/recordings-management"
      element={
        <AdminOnlyRoute>
          <RecordingsManagement />
        </AdminOnlyRoute>
      }
    />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);

const App: React.FC = () => (
  <AuthProvider>
    <Router>
      <AppRoutes />
    </Router>
  </AuthProvider>
);

export default App;