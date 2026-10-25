import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, Typography, Card, CardMedia, CardContent, Chip, Button, Stack, Grid, TextField, MenuItem, Paper, Alert, Skeleton, Divider,
} from '@mui/material';
import api, { apiError } from '../services/api';
import { perNight } from '../utils/format';
import { useAuth } from '../store/authStore';

export default function RoomDetailPage() {
  const { roomId } = useParams();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { user } = useAuth();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [checkIn, setCheckIn] = useState(sp.get('checkIn') || '');
  const [checkOut, setCheckOut] = useState(sp.get('checkOut') || '');
  const [guests, setGuests] = useState(sp.get('guests') || '2');
  const [quote, setQuote] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState('');

  const minCI = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  useEffect(() => {
    api.get(`/rooms/${roomId}`).then((r) => setRoom(r.data.data)).catch((e) => setError(apiError(e)));
  }, [roomId]);

  const validDates = checkIn && checkOut && checkOut > checkIn && Number(guests) >= 1;
  // GET /rooms/:roomId wraps the room at data.room (with bookableRoomIds inside).
  const roomBookable = room?.room?.bookableRoomIds?.[0] || room?.room?._id;
  const roomCategory = room?.category || room?.room?.roomCategory;

  const getQuote = async () => {
    if (!validDates || !roomBookable) return;
    try {
      if (Number(guests) > roomCategory.capacity) return;
      // Availability preview then create pending booking server-side.
      await api.get(`/availability`, { params: { hotelId: room.hotel._id, checkIn, checkOut, guests } });
      setQuote({ preview: true });
    } catch (e) {
      setSubmitErr(apiError(e));
    }
  };

  const bookNow = async () => {
    setSubmitErr('');
    if (!user) return nav(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    if (!validDates) return setSubmitErr('Select valid check-in and check-out dates.');
    setSubmitting(true);
    try {
      const r = await api.post('/bookings', { roomId: roomBookable, checkIn, checkOut, guestCount: Number(guests) });
      nav(`/checkout/${r.data.data.booking._id}`);
    } catch (e) {
      setSubmitErr(apiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!room) return <Skeleton variant="rounded" height={400} />;

  return (
    <Grid container spacing={4}>
      <Grid item xs={12} md={7}>
        <Card>
          <CardMedia component="img" height="360" image={room.category?.images?.[0] || 'https://placehold.co/900x500/E8E1D5/101820?text=Roomly'} alt={room.category?.name} />
          <CardContent>
            <Typography variant="h3" sx={{ mb: 0.5 }}>{room.category?.name}</Typography>
            <Typography color="text.secondary" gutterBottom>{room.hotel?.name} · {room.hotel?.address?.city}, {room.hotel?.address?.country} · Room {room.room.roomNumber}</Typography>
            <Stack direction="row" spacing={1} sx={{ my: 2 }}>
              <Chip label={`${room.category?.capacity} guests`} />
              <Chip label={room.category?.bedConfiguration} />
              {(room.category?.amenities || []).map((a) => <Chip key={a} variant="outlined" color="secondary" label={a} />)}
            </Stack>
            <Typography>{room.category?.description || 'An elegantly appointed room with premium amenities.'}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={5}>
        <Paper sx={{ p: 3, position: 'sticky', top: 16 }}>
          <Typography variant="h5">Reserve this room</Typography>
          <Typography color="secondary" sx={{ mb: 2 }}>{perNight(room.category?.basePrice)}</Typography>
          <Stack spacing={2}>
            <TextField label="Check-in" type="date" fullWidth InputLabelProps={{ shrink: true }} value={checkIn} inputProps={{ min: minCI }} onChange={(e) => { setCheckIn(e.target.value); setQuote(null); }} />
            <TextField label="Check-out" type="date" fullWidth InputLabelProps={{ shrink: true }} value={checkOut} error={checkIn && checkOut && checkOut <= checkIn} inputProps={{ min: checkIn || minCI }} onChange={(e) => { setCheckOut(e.target.value); setQuote(null); }} />
            <TextField select label="Guests" value={guests} onChange={(e) => setGuests(e.target.value)}>
              {Array.from({ length: room.category?.capacity || 1 }, (_, i) => i + 1).map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </TextField>
            <Button variant="outlined" onClick={getQuote} disabled={!validDates}>Check availability</Button>
            {submitErr && <Alert severity="error">{submitErr}</Alert>}
            <Button variant="contained" color="secondary" size="large" onClick={bookNow} disabled={submitting}>
              {submitting ? 'Reserving…' : 'Reserve with demo payment'}
            </Button>
            {!user && <Alert severity="info">You will be asked to sign in to complete the reservation.</Alert>}
            <Divider />
            {quote?.preview && <Alert severity="success">Room appears available for the selected dates. Final pricing is confirmed on the server at checkout.</Alert>}
            <Typography variant="body2" color="text.secondary">
              Payment uses <strong>Roomly Demo Pay (simulation)</strong> — no real money moves; bookings can be paid in test mode for the demo.
            </Typography>
          </Stack>
          <Button component={RouterLink} to={`/hotels/${room.hotel?._id || room.hotel}`} sx={{ mt: 2 }}>View hotel</Button>
        </Paper>
      </Grid>
    </Grid>
  );
}
