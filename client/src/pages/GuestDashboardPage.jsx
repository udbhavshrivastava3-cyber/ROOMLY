import { useCallback, useEffect, useState } from 'react';
import { Typography, Stack, Paper, Grid, Button, TextField, Alert, Skeleton, List, ListItem, ListItemText, Chip, Pagination, MenuItem, Select, ListItemButton } from '@mui/material';
import api, { apiError } from '../services/api';
import { useAuth } from '../store/authStore';
import { toast } from '../layouts/AppLayout';

export default function GuestDashboardPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState(null);
  const [requests, setRequests] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [srForm, setSrForm] = useState({ type: 'housekeeping', description: '' });
  const [cards, setCards] = useState([]);

  const load = useCallback(() => {
    api.get('/notifications?page=1&limit=10').then((r) => setNotifications(r.data.data)).catch((e) => setError(apiError(e)));
    api.get('/service-requests/my').then((r) => setRequests(r.data.data)).catch(() => setRequests({ serviceRequests: [] }));
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    api.get('/bookings/my?limit=50').then((r) => setCards(r.data.data.bookings.filter((b) => b.status === 'confirmed'))).catch(() => setCards([]));
  }, [user]);

  const saveProfile = async () => {
    try {
      await api.patch('/auth/me', profile);
      toast('Profile updated');
    } catch (e) { toast(apiError(e), 'error'); }
  };

  const markRead = async (n) => {
    try {
      await api.patch(`/notifications/${n._id}/read`);
      load();
    } catch (e) { setError(apiError(e)); }
  };

  const submitService = async () => {
    if (!cards[0]) return toast('Service requests need an active confirmed booking', 'info');
    try {
      await api.post('/service-requests', { ...srForm, bookingId: cards[0]._id });
      toast('Service request submitted');
      setSrForm({ type: 'housekeeping', description: '' });
      load();
    } catch (e) { toast(apiError(e), 'error'); }
  };

  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Stack spacing={3}>
      <Typography variant="h3">Welcome, {user?.name?.split(' ')[0]}</Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Profile</Typography>
            <Stack spacing={2}>
              <TextField label="Name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              <TextField label="Phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} helperText="Email cannot be changed here for security" />
              <Button variant="contained" color="secondary" onClick={saveProfile}>Save profile</Button>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Notifications</Typography>
            {!notifications ? <Skeleton height={180} /> : (
              <>
                {notifications.notifications.length === 0 && <Alert severity="info">No notifications yet.</Alert>}
                <List disablePadding>
                  {notifications.notifications.map((n) => (
                    <ListItem key={n._id} secondaryAction={
                      n.readAt ? <Chip size="small" label="read" /> : <Button size="small" onClick={() => markRead(n)}>Mark read</Button>
                    }>
                      <ListItemText primary={n.title} secondary={n.body} />
                    </ListItem>
                  ))}
                </List>
                {notifications.pagination.pages > 1 && <Pagination count={notifications.pagination.pages} page={page} onChange={(_, p) => setPage(p)} size="small" />}
              </>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Request a service during your stay</Typography>
            {cards.length === 0 && <Alert severity="info">Service requests require an upcoming confirmed booking.</Alert>}
            {cards.length > 0 && (
              <Stack spacing={2}>
                <Select value={srForm.type} onChange={(e) => setSrForm({ ...srForm, type: e.target.value })}>
                  {['housekeeping', 'extra_amenities', 'maintenance', 'food_beverage', 'other'].map((t) => <MenuItem key={t} value={t}>{t.replace(/_/g, ' ')}</MenuItem>)}
                </Select>
                <TextField multiline label="Describe your request" value={srForm.description} onChange={(e) => setSrForm({ ...srForm, description: e.target.value })} />
                <Button variant="contained" color="secondary" onClick={submitService}>Submit request</Button>
              </Stack>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>My service requests</Typography>
            {!requests ? <Skeleton height={120} /> : requests.serviceRequests.length === 0 ? (
              <Alert severity="info">Nothing requested yet.</Alert>
            ) : (
              requests.serviceRequests.map((s) => (
                <ListItemButton key={s._id} disableGutters dense>
                  <ListItemText
                    primary={s.type.replace(/_/g, ' ')}
                    secondary={`${s.description} — ${s.status}`}
                  />
                </ListItemButton>
              ))
            )}
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}
