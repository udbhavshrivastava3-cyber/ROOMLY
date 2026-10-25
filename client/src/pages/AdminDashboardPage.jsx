import { useCallback, useEffect, useState } from 'react';
import {
  Typography, Stack, Paper, Tabs, Tab, Table, TableBody, TableCell, TableHead, TableRow, Chip, Button, Select, MenuItem, Grid, Alert, Skeleton,
} from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api, { apiError } from '../services/api';
import { dateTimeIN, inrPrecise } from '../utils/format';
import { toast } from '../layouts/AppLayout';

export default function AdminDashboardPage() {
  const [tab, setTab] = useState(0);
  const [users, setUsers] = useState(null);
  const [overview, setOverview] = useState(null);
  const [audit, setAudit] = useState(null);
  const [hotels, setHotels] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([
      api.get('/admin/users?limit=50'),
      api.get('/reports/overview?days=30'),
      api.get('/admin/audit-logs?limit=50'),
      api.get('/hotels?limit=50&includeInactive=1'),
    ]).then(([u, o, a, h]) => {
      setUsers(u.data.data); setOverview(o.data.data); setAudit(a.data.data); setHotels(h.data.data.hotels);
    }).catch((e) => setError(apiError(e)));
  }, []);
  useEffect(() => { load(); }, [load]);

  const setRole = async (id, role) => {
    try {
      await api.patch(`/admin/users/${id}/role`, { role });
      toast(`Role updated to ${role}`);
      load();
    } catch (e) { setError(apiError(e)); }
  };
  const toggleActive = async (h) => {
    try {
      await api.patch(`/admin/hotels/${h._id}/active`, { active: !h.active });
      load();
    } catch (e) { setError(apiError(e)); }
  };

  if (!users) return error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : <Skeleton height={300} />;

  const chart = (overview?.bookingsByDay || []).map((d) => ({ day: d._id, bookings: d.count }));

  return (
    <Stack spacing={3}>
      <Typography variant="h3">Platform administration</Typography>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <Grid container spacing={2}>
        {overview && [['Users', overview.counters.users], ['Hotels', overview.counters.hotels], ['Active bookings', overview.counters.activeBookings],                   ['Collected (succeeded, 30d)', inrPrecise(overview.metrics.collected)]].map(([k, v]) => (
          <Grid item xs={6} md={3} key={String(k)}>
            <Paper sx={{ p: 2 }}><Typography variant="body2" color="text.secondary">{k}</Typography><Typography variant="h5">{v}</Typography></Paper>
          </Grid>
        ))}
      </Grid>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Users" /><Tab label="Hotels" /><Tab label="Analytics" /><Tab label="Audit log" />
      </Tabs>

      {tab === 0 && (
        <Paper sx={{ p: 2 }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell>Change role</TableCell></TableRow></TableHead>
            <TableBody>
              {users.users.map((u) => (
                <TableRow key={u._id}>
                  <TableCell>{u.name}</TableCell><TableCell>{u.email}</TableCell>
                  <TableCell><Chip size="small" label={u.role} /></TableCell>
                  <TableCell sx={{ minWidth: 180 }}>
                    <Select size="small" fullWidth value={u.role || 'guest'} onChange={(e) => setRole(u._id, e.target.value)}>
                      {['guest', 'staff', 'hotel_manager', 'admin'].map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 1 && (
        <Paper sx={{ p: 2 }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>Hotel</TableCell><TableCell>City</TableCell><TableCell>Status</TableCell><TableCell>Toggle</TableCell></TableRow></TableHead>
            <TableBody>
              {(hotels || []).map((h) => (
                <TableRow key={h._id}>
                  <TableCell>{h.name}</TableCell><TableCell>{h.address?.city}</TableCell>
                  <TableCell><Chip size="small" color={h.active ? 'success' : 'default'} label={h.active ? 'active' : 'inactive'} /></TableCell>
                  <TableCell><Button size="small" onClick={() => toggleActive(h)}>{h.active ? 'Deactivate' : 'Activate'}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {tab === 2 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>Bookings per day (30 days)</Typography>
          {(chart || []).length === 0 ? <Alert severity="info">No bookings in this window.</Alert> : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <RTooltip />
                <Bar dataKey="bookings" fill="#101820" name="Bookings" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Paper>
      )}

      {tab === 3 && (
        <Paper sx={{ p: 2 }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>When</TableCell><TableCell>Actor</TableCell><TableCell>Action</TableCell><TableCell>Target</TableCell></TableRow></TableHead>
            <TableBody>
              {audit.logs.map((l) => (
                <TableRow key={l._id}>                   <TableCell>{dateTimeIN(l.createdAt)}</TableCell>
                  <TableCell>{l.actor?.name || '—'} ({l.actor?.role || l.actorRole})</TableCell>
                  <TableCell>{l.action}</TableCell>
                  <TableCell>{l.targetType} {l.targetId?.slice(-6)}</TableCell>
                </TableRow>
              ))}
              {audit.logs.length === 0 && <TableRow><TableCell colSpan={4}>No audit entries yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
}
