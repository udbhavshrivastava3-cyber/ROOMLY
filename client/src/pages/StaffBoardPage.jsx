import { useCallback, useEffect, useState } from 'react';
import { Typography, Stack, Paper, Table, TableBody, TableCell, TableHead, TableRow, Chip, Button, Select, MenuItem, FormControl, InputLabel, Alert, Grid, Skeleton } from '@mui/material';
import api, { apiError } from '../services/api';
import { toast } from '../layouts/AppLayout';

const HK_OPTIONS = ['clean', 'dirty', 'cleaning_in_progress', 'inspected', 'maintenance'];
const SR_OPTIONS = ['submitted', 'in_progress', 'resolved', 'rejected'];

export default function StaffBoardPage() {
  const [hotels, setHotels] = useState(null);
  const [hotelId, setHotelId] = useState(null);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/manage/hotels').then((r) => {
      setHotels(r.data.data.hotels);
      if (r.data.data.hotels[0]) setHotelId(r.data.data.hotels[0]._id);
    }).catch((e) => setError(apiError(e)));
  }, []);

  const load = useCallback(() => {
    if (!hotelId) return;
    api.get(`/operations/board?hotelId=${hotelId}`).then((r) => setBoard(r.data.data)).catch((e) => setError(apiError(e)));
  }, [hotelId]);
  useEffect(() => { load(); }, [load]);

  const checkIn = async (b) => {
    try {
      await api.post(`/operations/bookings/${b._id}/checkin`);
      toast(`Checked in ${b.guest?.name} (${b.reference})`);
      load();
    } catch (e) { setError(apiError(e)); }
  };
  const checkOut = async (b) => {
    try {
      await api.post(`/operations/bookings/${b._id}/checkout`);
      toast(`Checked out ${b.guest?.name} (${b.reference})`);
      load();
    } catch (e) { setError(apiError(e)); }
  };
  const setServiceRequestStatus = async (sr, status) => {
    try {
      await api.patch(`/operations/service-requests/${sr._id}`, { status });
      toast(`Service request → ${status.replace(/_/g, ' ')}`);
      load();
    } catch (e) { setError(apiError(e)); }
  };
  const setHousekeeping = async (room, status) => {
    try {
      await api.patch(`/operations/rooms/${room._id}/housekeeping`, { housekeepingStatus: status });
      toast(`Room ${room.roomNumber} → ${status.replace(/_/g, ' ')}`);
      load();
    } catch (e) { setError(apiError(e)); }
  };

  if (!hotels) return error ? <Alert severity="error" onClose={() => setError('')}>{error}</Alert> : <Skeleton height={240} />;

  return (
    <Stack spacing={3}>
      <Typography variant="h3">Operations board</Typography>
      {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
      <FormControl sx={{ minWidth: 260 }}>
        <InputLabel>Hotel</InputLabel>
        <Select label="Hotel" value={hotelId || ''} onChange={(e) => setHotelId(e.target.value)}>
          {hotels.map((h) => <MenuItem key={h._id} value={h._id}>{h.name}</MenuItem>)}
        </Select>
      </FormControl>

      {!board ? <Skeleton height={400} /> : (
        <>
          <Grid container spacing={2}>
            {[['Occupancy', `${board.occupancy.totalRooms ? Math.round((board.occupancy.occupiedRooms / board.occupancy.totalRooms) * 100) : 0}%`], ['Rooms', board.occupancy.totalRooms],
              ['Housekeeping needed', board.occupancy.housekeepingNeeded], ['Maintenance rooms', board.occupancy.maintenanceRooms]]
              .map(([k, v]) => (
                <Grid item xs={6} md={3} key={k}>
                  <Paper sx={{ p: 2 }}>
                    <Typography color="text.secondary" variant="body2">{k}</Typography>
                    <Typography variant="h5">{v}</Typography>
                  </Paper>
                </Grid>
              ))}
          </Grid>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Today's arrivals</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>Guest</TableCell><TableCell>Ref</TableCell><TableCell>Room</TableCell><TableCell>Action</TableCell></TableRow></TableHead>
              <TableBody>
                {board.arrivals.length === 0 && <TableRow><TableCell colSpan={4}>No arrivals today</TableCell></TableRow>}
                {board.arrivals.map((b) => (
                  <TableRow key={b._id}>
                    <TableCell>{b.guest?.name}</TableCell><TableCell>{b.reference}</TableCell><TableCell>{b.room?.roomNumber}</TableCell>
                    <TableCell><Button size="small" variant="contained" onClick={() => checkIn(b)}>Check in</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>In-house (departures)</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>Guest</TableCell><TableCell>Ref</TableCell><TableCell>Room</TableCell><TableCell>Action</TableCell></TableRow></TableHead>
              <TableBody>
                {board.departures.length === 0 && <TableRow><TableCell colSpan={4}>No in-house departures due today</TableCell></TableRow>}
                {board.departures.map((b) => (
                  <TableRow key={b._id}>
                    <TableCell>{b.guest?.name}</TableCell><TableCell>{b.reference}</TableCell><TableCell>{b.room?.roomNumber}</TableCell>
                    <TableCell><Button size="small" variant="outlined" color="secondary" onClick={() => checkOut(b)}>Check out</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Housekeeping status</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>Room</TableCell><TableCell>Category</TableCell><TableCell>Operational</TableCell><TableCell>Housekeeping</TableCell><TableCell>Set status</TableCell></TableRow></TableHead>
              <TableBody>
                {board.rooms.map((r) => (
                  <TableRow key={r._id}>
                    <TableCell>{r.roomNumber}</TableCell>
                    <TableCell>{r.roomCategory?.name}</TableCell>
                    <TableCell><Chip size="small" label={r.operationalStatus} /></TableCell>
                    <TableCell><Chip size="small" label={r.housekeepingStatus.replace(/_/g, ' ')} /></TableCell>
                    <TableCell sx={{ minWidth: 170 }}>
                      <Select size="small" fullWidth value={r.housekeepingStatus} onChange={(e) => setHousekeeping(r, e.target.value)}>
                        {HK_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o.replace(/_/g, ' ')}</MenuItem>)}
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Open service requests</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>Guest</TableCell><TableCell>Type</TableCell><TableCell>Detail</TableCell><TableCell>Status</TableCell><TableCell>Update</TableCell></TableRow></TableHead>
              <TableBody>
                {board.serviceRequests.length === 0 && <TableRow><TableCell colSpan={5}>No open requests</TableCell></TableRow>}
                {board.serviceRequests.map((s) => (
                  <TableRow key={s._id}>
                    <TableCell>{s.guest?.name}</TableCell><TableCell>{s.type.replace(/_/g, ' ')}</TableCell>
                    <TableCell>{s.description}</TableCell><TableCell><Chip size="small" label={s.status} /></TableCell>
                    <TableCell sx={{ minWidth: 170 }}>
                      <Select size="small" fullWidth value={s.status} onChange={(e) => setServiceRequestStatus(s, e.target.value)}>
                        {SR_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o.replace(/_/g, ' ')}</MenuItem>)}
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </Stack>
  );
}
