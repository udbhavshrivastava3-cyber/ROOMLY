import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Box, Typography, Stack, Button, useMediaQuery, ThemeProvider as MuiThemeProvider } from '@mui/material';
import { lazy, Suspense } from 'react';
import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './routes/ProtectedRoute';
import HomePage from './pages/HomePage';
import theme from './theme';
import { useAuth } from './store/authStore';

const LoginPage = lazy(() => import('./pages/LoginRegisterPages').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('./pages/LoginRegisterPages').then((m) => ({ default: m.RegisterPage })));
const RoomsSearchPage = lazy(() => import('./pages/RoomsSearchPage'));
const RoomDetailPage = lazy(() => import('./pages/RoomDetailPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const ConfirmationPage = lazy(() => import('./pages/ConfirmationPage'));
const MyBookingsPage = lazy(() => import('./pages/MyBookingsPage'));
const GuestDashboardPage = lazy(() => import('./pages/GuestDashboardPage'));
const HotelDetailPage = lazy(() => import('./pages/HotelDetailPage'));
const StaffBoardPage = lazy(() => import('./pages/StaffBoardPage'));
const ManageDashboardPage = lazy(() => import('./pages/ManageDashboardPage'));
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));

function Loading() {
  return <Stack alignItems="center" py={8}><Typography color="text.secondary">Loading…</Typography></Stack>;
}

function NotFound() {
  return (
    <Stack spacing={2} alignItems="center" py={8} textAlign="center">
      <Typography variant="h1" color="primary">404</Typography>
      <Typography>This page wandered off.</Typography>
      <Button variant="contained" href="/">Back to Roomly</Button>
    </Stack>
  );
}

// Redirect signed-in guests with dashboards to their home after login.
function HomeGate() {
  const { user } = useAuth();
  const loc = useLocation();
  if (user && loc.pathname === '/') {
    if (user.role === 'staff') return <Navigate to="/staff" replace />;
    if (user.role === 'hotel_manager') return <Navigate to="/manage" replace />;
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
  }
  return null;
}

export default function App() {
  return (
    <MuiThemeProvider theme={theme}>
      <Box sx={{ bgcolor: 'background.default' }}>
        <HomeGate />
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<HomePage />} />
            <Route path="rooms" element={<Suspense fallback={<Loading />}><RoomsSearchPage /></Suspense>} />
            <Route path="rooms/:roomId" element={<Suspense fallback={<Loading />}><RoomDetailPage /></Suspense>} />
            <Route path="hotels/:hotelId" element={<Suspense fallback={<Loading />}><HotelDetailPage /></Suspense>} />
            <Route path="login" element={<Suspense fallback={<Loading />}><LoginPage /></Suspense>} />
            <Route path="register" element={<Suspense fallback={<Loading />}><RegisterPage /></Suspense>} />
            <Route path="checkout/:bookingId" element={<Suspense fallback={<Loading />}><CheckoutPage /></Suspense>} />
            <Route path="confirmation/:bookingId" element={<Suspense fallback={<Loading />}><ConfirmationPage /></Suspense>} />
            <Route path="my-bookings" element={<Suspense fallback={<Loading />}><MyBookingsPage /></Suspense>} />
            <Route path="account" element={<ProtectedRoute><Suspense fallback={<Loading />}><GuestDashboardPage /></Suspense></ProtectedRoute>} />
            <Route path="staff" element={<ProtectedRoute roles={['staff']}><Suspense fallback={<Loading />}><StaffBoardPage /></Suspense></ProtectedRoute>} />
            <Route path="manage" element={<ProtectedRoute roles={['hotel_manager']}><Suspense fallback={<Loading />}><ManageDashboardPage /></Suspense></ProtectedRoute>} />
            <Route path="admin" element={<ProtectedRoute roles={['admin']}><Suspense fallback={<Loading />}><AdminDashboardPage /></Suspense></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Box>
    </MuiThemeProvider>
  );
}
