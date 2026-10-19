import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import InvitationPage from './pages/InvitationPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MyTasksPage from './pages/MyTasksPage.jsx';
import ProjectPage from './pages/ProjectPage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import SsoCallbackPage from './pages/SsoCallbackPage.jsx';
import UsersPage from './pages/UsersPage.jsx';

function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/connexion" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<LoginPage />} />
      <Route path="/connexion/sso" element={<SsoCallbackPage />} />
      <Route path="/inscription" element={<RegisterPage />} />
      <Route path="/invitation/:token" element={<InvitationPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="mes-taches" element={<MyTasksPage />} />
        <Route path="projets" element={<ProjectsPage />} />
        <Route path="projets/:id" element={<ProjectPage />} />
        <Route
          path="admin/utilisateurs"
          element={
            <RequireAuth roles={['admin']}>
              <UsersPage />
            </RequireAuth>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
