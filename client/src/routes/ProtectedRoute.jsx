import { Navigate, useLocation } from 'react-router-dom';
import { Alert, CircularProgress, Stack } from '@mui/material';
import { useAuth } from '../store/authStore';

export default function ProtectedRoute({ roles = [], children }) {
  const { user, booted } = useAuth();
  const loc = useLocation();

  if (!booted) return <Stack alignItems="center" py={8}><CircularProgress sx={{ color: '#C6A66B' }} /></Stack>;
  if (!user) return <Navigate to="/login" state={{ next: loc.pathname + loc.search }} replace />;
  if (roles.length) {
    // Exact role match: each operations page belongs to its own role.
    // Admins may open any page (the backend allows admin on every scoped route).
    const ok = user.role === 'admin' || roles.includes(user.role);
    if (!ok) {
      return (
        <Alert severity="error">
          Your account does not have permission to view this page (role: {user.role}).
          {` `}The backend enforces this boundary too.
        </Alert>
      );
    }
  }
  return children;
}
