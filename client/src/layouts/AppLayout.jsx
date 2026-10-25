import { useState } from 'react';
import { Outlet, useNavigate, Link as RouterLink } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box, Container, Stack, IconButton, Snackbar, Alert } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { useAuth } from '../store/authStore';


const bus = { listeners: [] };
export function toast(msg, severity = 'success') {
  bus.listeners.forEach((fn) => fn({ msg, severity }));
}

export default function AppLayout() {
  const { user, logout, homeFor } = useAuth();
  const nav = useNavigate();
  const [toast_, setToast] = useState(null);
  if (!bus.listeners.includes(setToast)) bus.listeners.push(setToast);
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [];
  if (!user) links.push({ to: '/login', label: 'Sign in' });
  if (!user || user.role === 'guest') links.push({ to: '/my-bookings', label: 'My bookings' });
  if (['staff', 'hotel_manager'].includes(user?.role)) links.push({ to: '/staff', label: 'Operations' });
  if (user?.role === 'hotel_manager') links.push({ to: '/manage', label: 'Management' });
  if (user?.role === 'admin') links.push({ to: '/admin', label: 'Admin' });

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <AppBar position="static" sx={{ bgcolor: '#101820' }}>
        <Toolbar sx={{ gap: 2 }}>
          <Typography
            component={RouterLink}
            to="/"
            variant="h6"
            sx={{ color: '#C6A66B', fontFamily: '"Playfair Display", serif', textDecoration: 'none', mr: 'auto', letterSpacing: '0.06em' }}
          >
            ROOMLY
          </Typography>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1 }}>
            {links.map((l) => (
              <Button key={l.to} component={RouterLink} to={l.to} sx={{ color: '#F7F4EE' }}>{l.label}</Button>
            ))}
            {user && (
              <Button color="secondary" onClick={async () => { await logout(); nav('/'); }}>
                Sign out
              </Button>
            )}
          </Box>
          <IconButton sx={{ color: '#F7F4EE', display: { md: 'none' } }} onClick={() => setMobileOpen(!mobileOpen)}>
            <MenuIcon />
          </IconButton>
        </Toolbar>
        {mobileOpen && (
          <Box sx={{ p: 2, display: { md: 'none' }, flexDirection: 'column', bgcolor: 'rgba(16,24,32,0.98)' }}>
            <Stack>
              {links.map((l) => (
                <Button key={l.to} component={RouterLink} to={l.to} sx={{ color: '#F7F4EE' }} onClick={() => setMobileOpen(false)}>{l.label}</Button>
              ))}
              {user && <Button color="secondary" onClick={async () => { await logout(); nav('/'); }}>Sign out</Button>}
            </Stack>
          </Box>
        )}
      </AppBar>
      <Container sx={{ flex: 1, py: { xs: 2, md: 4 }, maxWidth: { xl: 'lg' } }}>
        <Outlet />
      </Container>
      <Box component="footer" sx={{ bgcolor: '#101820', color: '#E8E1D5', py: 4, mt: 'auto' }}>
        <Container>
          <Typography fontFamily='"Playfair Display", serif' sx={{ color: '#C6A66B' }}>Roomly</Typography>
          <Typography variant="body2">Premium hospitality management · demo project for university coursework</Typography>
        </Container>
      </Box>
      <Snackbar
        open={!!toast_}
        autoHideDuration={4500}
        onClose={() => setToast(null)}
        message={toast_?.msg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast_ ? <Alert severity={toast_?.severity} onClose={() => setToast(null)}>{toast_?.msg}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
