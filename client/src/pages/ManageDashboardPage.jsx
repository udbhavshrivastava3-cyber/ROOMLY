import { useCallback, useEffect, useState } from 'react';
import {
  Typography, Stack, Paper, Tabs, Tab, Grid, Button, TextField, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableHead, TableRow, Alert, Skeleton, Chip, Box,
} from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api, { apiError } from '../services/api';
import { inr, inrPrecise } from '../utils/format';
import { toast } from '../layouts/AppLayout';

const HOTEL_OPTION_CITIES = ['Lisbon', 'Paris', 'Vienna', 'Singapore'];

export default function ManageDashboardPage() {
  const [hotels, setHotels] = useState(null);
  const [hotelId, setHotelId] = useState(null);
  const [tab, setTab] = useState(0);
  const [data, setData] = useState({ rooms: null, report: null });
  const [error, setError] = useState('');

  // hotel profile creation (admin-only action; managers see their hotels only)
  const [newRoom, setNewRoom] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api.get('/manage/hotels').then((r) => {
      setHotels(r.data.data.hotels);
      if (r.data.data.hotels[0]) setHotelId(r.data.data.hotels[0]._id);
    }).catch((e) => setError(apiError(e)));
  }, []);

  const load = useCallback(() => {
    if (!hotelId) return;
    Promise.all([
      api.get(`/manage/hotels/${hotelId}/rooms`),
      api.get(`/hotels/${hotelId}`),
      api.get(`/reports/hotels/${hotelId}?days=30`),
    ]).then(([rooms, hotelDetail, report]) => {
      setCategories(hotelDetail.data.data.roomCategories);
      setData({ rooms: rooms.data.data.rooms, report: report.data.data });
    }).catch((e) => setError(apiError(e)));
  }, [hotelId]);
  useEffect(() => { load(); }, [load]);

  const createRoom = async () => {
    try {
      await api.post('/manage/rooms', { hotelId, roomNumber: newRoom.roomNumber, roomCategoryId: newRoom.roomCategoryId, floor: newRoom.floor });
      toast(`Room ${newRoom.roomNumber} added`);
      setNewRoom(null);
      load();
    } catch (e) { setError(apiError(e)); }
  };

  const setRoomStatus = async (room, patch) => {
    try {
      await api.patch(`/manage/rooms/${room._id}`, patch);
      load();
    } catch (e) { setError(apiError(e)); }
  };

  const replaceCategoryPrice = async (cat, basePrice) => {
    try {
      await api.patch(`/manage/categories/${cat._id}`, { basePrice: Number(basePrice) });
      toast(`${cat.name} price updated to ${inr(basePrice)}/night for NEW bookings`); // snapshots on bookings preserve existing price
      load();
    } catch (e) { setError(apiError(e)); }
  };

  if (!hotels) return error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : <Skeleton height={300} />;

  const report = data.report;
  const chartData = (report?.bookingsByDay || []).map((d) => ({ day: d._id, bookings: d.count, value: Number(d.value.toFixed(2)) }));

  return (
    <Stack spacing={3}>
      <Typography variant="h3">Hotel management</Typography>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <Grid container spacing={2} alignItems="center">
        <Grid item xs={12} sm={6}>
          <Select fullWidth value={hotelId || ''} onChange={(e) => setHotelId(e.target.value)}>
            {hotels.map((h) => <MenuItem key={h._id} value={h._id}>{h.name} — {h.address?.city}</MenuItem>)}
          </Select>
        </Grid>
      </Grid>
      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label="Rooms & pricing" />
        <Tab label="Reports" />
      </Tabs>

      {tab === 0 && (
        <>
          <Paper sx={{ p: 2 }}>
            <Stack direction="row" justifyContent="space-between" mb={2}>
              <Typography variant="h6">Room inventory</Typography>
              <Button variant="contained" color="secondary" onClick={() => setNewRoom({ roomNumber: '', roomCategoryId: categories[0]?._id || '', floor: 1 })}>Add room</Button>
            </Stack>
            <Table size="small">
              <TableHead><TableRow><TableCell>Room</TableCell><TableCell>Floor</TableCell><TableCell>Category</TableCell><TableCell>Operational</TableCell><TableCell>Housekeeping</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
              <TableBody>
                {(data.rooms || []).map((r) => (
                  <TableRow key={r._id}>
                    <TableCell>{r.roomNumber}</TableCell><TableCell>{r.floor}</TableCell><TableCell>{r.roomCategory?.name}</TableCell>
                    <TableCell><Chip size="small" label={r.operationalStatus} /></TableCell>
                    <TableCell><Chip size="small" label={r.housekeepingStatus.replace(/_/g, ' ')} /></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Select size="small" value={r.operationalStatus} onChange={(e) => setRoomStatus(r, { operationalStatus: e.target.value })}>
                          {['available', 'maintenance', 'out_of_service'].map((s) => <MenuItem key={s} value={s}>{s.replace(/_/g, ' ')}</MenuItem>)}
                          {/* 'occupied' is set by check-in, not by managers — shown but not selectable */}
                          {r.operationalStatus === 'occupied' && <MenuItem value="occupied" disabled>occupied</MenuItem>}
                        </Select>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {data.rooms && data.rooms.length === 0 && <TableRow><TableCell colSpan={6}>No rooms yet — add the first one.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Category pricing (applies to new bookings)</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>Category</TableCell><TableCell>Capacity</TableCell><TableCell>Base price</TableCell><TableCell>Update price</TableCell></TableRow></TableHead>
              <TableBody>
                {categories.map((c) => (
                  <TableRow key={c._id}>
                    <TableCell>{c.name}</TableCell><TableCell>{c.capacity}</TableCell><TableCell>{inr(c.basePrice)}</TableCell>
                    <TableCell>
                      <PricingEditor original={c.basePrice} onSave={(v) => replaceCategoryPrice(c, v)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}

      {tab === 1 && (
        <>
          {!report ? <Skeleton height={300} /> : (
            <>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary" variant="body2">Gross booking value (booked)</Typography><Typography variant="h5">{inrPrecise(report.metrics.grossBookingValue)}</Typography></Paper></Grid>
                <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary" variant="body2">Collected (verified payments)</Typography><Typography variant="h5">{inrPrecise(report.metrics.collected)}</Typography></Paper></Grid>
                <Grid item xs={12} md={4}><Paper sx={{ p: 2 }}><Typography color="text.secondary" variant="body2">Occupancy</Typography><Typography variant="h5">{report.occupancy.pct}%</Typography></Paper></Grid>
              </Grid>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>Bookings per day (last 30 days)</Typography>
                {chartData.length === 0 ? <Alert severity="info">No bookings in this window yet.</Alert> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />                       <RTooltip formatter={(v, name) => (name === 'value' ? inrPrecise(v) : v)} />
                      <Bar dataKey="bookings" fill="#C6A66B" name="Bookings" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </>
          )}
        </>
      )}

      <Dialog open={!!newRoom} onClose={() => setNewRoom(null)}>
        <DialogTitle>Add room</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Room number" value={newRoom?.roomNumber || ''} onChange={(e) => setNewRoom({ ...newRoom, roomNumber: e.target.value })} />
            <Select value={newRoom?.roomCategoryId || ''} onChange={(e) => setNewRoom({ ...newRoom, roomCategoryId: e.target.value })} displayEmpty>
              <MenuItem value="" disabled>Select category</MenuItem>
              {categories.map((c) => <MenuItem key={c._id} value={c._id}>{c.name}</MenuItem>)}
            </Select>
            <TextField label="Floor" type="number" value={newRoom?.floor ?? 1} onChange={(e) => setNewRoom({ ...newRoom, floor: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewRoom(null)}>Cancel</Button>
          <Button variant="contained" onClick={createRoom} disabled={!newRoom?.roomNumber || !newRoom?.roomCategoryId}>Create room</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function PricingEditor({ original, onSave }) {
  const [value, setValue] = useState(original);
  return (
    <Stack direction="row" spacing={1} justifyContent="flex-end">
      <TextField size="small" type="number" value={value} onChange={(e) => setValue(e.target.value)} sx={{ width: 110 }} inputProps={{ min: 0 }} />
      <Button size="small" variant="contained" disabled={Number(value) === original || Number(value) <= 0} onClick={() => onSave(value)}>Save</Button>
    </Stack>
  );
}
